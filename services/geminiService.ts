
import { NovelSettings, Chapter, AvailableModel, Character, Faction, Location } from "../types";

// API Configuration from environment variables
const API_BASE_URL = process.env.API_BASE_URL || 'https://once.novai.su/v1';
const API_KEY = process.env.API_KEY || '';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || '';
const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';

// Hardcoded fallback for Anthropic API (to bypass env variable issues)
const ANTHROPIC_CONFIG = {
  baseUrl: 'https://mixai.cc/v1',
  apiKey: 'sk-a7YqF4A9MnkAWjxq'
};

// Configuration for Claude Opus 4.5
const CLAUDE_OPUS_CONFIG = {
  baseUrl: 'https://mixai.cc/v1',
  apiKey: 'sk-aaCKnSEWcfy8GVzd'
};

/**
 * Chapter creation options for advanced configuration
 */
export interface ChapterCreationOptions {
  targetWordCount?: number;  // Target word count for the chapter
  featuredCharacters?: string[];  // Names of characters that should appear
  newCharacters?: { name: string; description: string }[];  // New characters to introduce
  plotPoints?: { content: string; importance: 'major' | 'minor' }[];  // Plot points with importance level
  synopsis?: string;  // Chapter synopsis/overview
}

/**
 * Get the appropriate API configuration based on model
 */
function getApiConfig(model: AvailableModel): { baseUrl: string; apiKey: string } {
  console.log('[DEBUG] getApiConfig called with model:', model);

  // Claude Opus 4.5 uses specific config
  if (model === 'claude-opus-4-5-20251101') {
    console.log('[DEBUG] Using Claude Opus config:', { baseUrl: CLAUDE_OPUS_CONFIG.baseUrl, apiKey: CLAUDE_OPUS_CONFIG.apiKey.substring(0, 10) + '...' });
    return CLAUDE_OPUS_CONFIG;
  }

  // Anthropic-specific model uses hardcoded config to bypass env issues
  if (model === 'claude-sonnet-4-5-20250929') {
    console.log('[DEBUG] Using Anthropic hardcoded config:', { baseUrl: ANTHROPIC_CONFIG.baseUrl, apiKey: ANTHROPIC_CONFIG.apiKey.substring(0, 10) + '...' });
    return ANTHROPIC_CONFIG;
  }

  // Claude models use separate API key (including models with [次] prefix)
  if (model.includes('claude')) {
    const config = {
      baseUrl: API_BASE_URL,
      apiKey: CLAUDE_API_KEY || API_KEY
    };
    console.log('[DEBUG] Using Claude config:', { baseUrl: config.baseUrl, apiKey: config.apiKey.substring(0, 10) + '...' });
    return config;
  }

  const config = {
    baseUrl: API_BASE_URL,
    apiKey: API_KEY
  };
  console.log('[DEBUG] Using default config:', { baseUrl: config.baseUrl, apiKey: config.apiKey.substring(0, 10) + '...' });
  return config;
}

/**
 * Retry helper for 429/503 errors with exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    let isRateLimit = false;
    let isServerOverload = false;
    let isTransient = false;

    // Check standard properties
    if (error.status === 429) isRateLimit = true;
    if (error.status === 503 || error.status === 500) isServerOverload = true;

    // Check message strings
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit')) isRateLimit = true;
    if (msg.includes('503') || msg.includes('overloaded') || msg.includes('500') || msg.includes('internal')) isServerOverload = true;
    if (msg.includes('fetch failed') || msg.includes('network')) isTransient = true;
    if (msg.includes('retriable')) isTransient = true;

    if (retries > 0 && (isRateLimit || isServerOverload || isTransient)) {
      const delay = baseDelay * (Math.pow(2, 3 - retries));
      console.warn(`API Warning: ${isRateLimit ? 'Rate Limit' : 'Error'}. Retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, baseDelay);
    }
    throw error;
  }
}

/**
 * Use AI to fix malformed JSON
 */
const fixJSONWithAI = async (brokenJSON: string, model: AvailableModel): Promise<any> => {
  try {
    console.log('Attempting to fix JSON with AI...');

    const systemPrompt = `你是一个 JSON 修复专家。用户会给你一段格式错误的 JSON，你需要修复它并返回正确的 JSON。

修复规则：
1. 修复未转义的引号
2. 移除尾随逗号
3. 确保所有字符串值都正确转义
4. 保持原始数据内容不变，只修复格式
5. 必须返回有效的 JSON 对象

直接返回修复后的 JSON，不要添加任何解释或 markdown 代码块。`;

    const userPrompt = `请修复以下 JSON：

${brokenJSON}`;

    const response = await callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      max_tokens: 8192,
      temperature: 0
    });

    // Try to parse the fixed JSON
    return parseAIResponse(response);
  } catch (error) {
    console.error('AI JSON fix failed:', error);
    return null;
  }
};

/**
 * Helper to clean AI response text which often contains markdown formatting
 */
const parseAIResponse = (text: string | undefined) => {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (e) {
    console.log('Initial JSON parse failed, trying fallbacks...');

    // Attempt to extract from Markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e2) {
        console.log('Code block extraction failed');
      }
    }

    // Fallback: Find the first '{' and last '}'
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      let jsonStr = text.substring(firstOpen, lastClose + 1);

      try {
        // Try to fix common JSON issues
        // 1. Remove trailing commas before } or ]
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

        // 2. Fix common escape issues
        // Replace unescaped newlines in strings
        jsonStr = jsonStr.replace(/:\s*"([^"]*?)\\n([^"]*?)"/g, (match, p1, p2) => {
          return `: "${p1}\\n${p2}"`;
        });

        // 3. Try to fix unescaped quotes (very basic)
        // This is a heuristic and may not work for all cases

        return JSON.parse(jsonStr);
      } catch (e3) {
        console.error("Fallback JSON Parse also failed", e3);
        console.error("Attempted to parse:", jsonStr.substring(0, 500));

        // Last resort: try to fix more aggressively
        try {
          // Remove all control characters except newlines and tabs
          jsonStr = jsonStr.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '');

          // Try one more time
          return JSON.parse(jsonStr);
        } catch (e4) {
          console.error("Final fallback also failed");
        }
      }
    }
    return null;
  }
};

/**
 * Generic OpenAI-compatible API call
 */
async function callChatAPI(
  model: AvailableModel,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: {
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' | 'text' };
  } = {}
): Promise<string> {
  const { baseUrl, apiKey } = getApiConfig(model);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 8192,
      ...(options.response_format && { response_format: options.response_format }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Streaming API call using Server-Sent Events
 */
async function* streamChatAPI(
  model: AvailableModel,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: {
    temperature?: number;
    max_tokens?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const { baseUrl, apiKey } = getApiConfig(model);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 8192,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
  }
}

// ============ 分步生成世界观 ============

/**
 * 第一步：生成基础身份和文风设定
 */
export const generateBasicIdentity = async (idea: string, model: AvailableModel, novelType?: 'long' | 'short'): Promise<Partial<NovelSettings>> => {
  try {
    let typeGuidance = '';
    if (novelType === 'short') {
      typeGuidance = '\n注意：这是短篇小说，设定要简洁明了。';
    } else if (novelType === 'long') {
      typeGuidance = '\n注意：这是长篇小说，可以构建宏大的世界观。';
    }

    const systemPrompt = `你是资深网络小说策划师。根据创意核心生成小说的基础身份和文风设定。${typeGuidance}

请以 JSON 格式返回以下字段：

1. **title**（小说标题）- 有冲击力和记忆点，符合网文命名规律
2. **style**（小说类型）- 如：玄幻、修仙、都市、科幻、言情等
3. **tags**（核心标签数组）- 3-8个标签，如：["系统流", "扮猪吃虎", "热血"]
4. **authorNote**（AI创作指南）- 定义文风特征、叙事节奏、语言风格、描写侧重点，150-300字

要求：
- 标题要吸引人，避免过于文艺
- 标签要精准，体现主角特质和爽点元素
- authorNote要详细，这将指导后续所有AI创作`;

    const userPrompt = `创意核心："${idea}"\n\n请生成小说的基础身份和文风设定。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 1024
    }));

    const result = parseAIResponse(response);
    if (!result) throw new Error("生成基础身份失败");

    return {
      title: typeof result.title === 'string' ? result.title : '',
      style: typeof result.style === 'string' ? result.style : '',
      tags: Array.isArray(result.tags) ? result.tags : [],
      authorNote: typeof result.authorNote === 'string' ? result.authorNote : ''
    };
  } catch (error) {
    console.error("生成基础身份错误:", error);
    throw error;
  }
};

/**
 * 第二步：基于基础身份生成核心卖点和世界法则
 */
export const generateCoreWorldRules = async (
  idea: string,
  basicIdentity: Partial<NovelSettings>,
  model: AvailableModel
): Promise<Partial<NovelSettings>> => {
  try {
    const systemPrompt = `你是资深网络小说世界观架构师。基于已有的基础设定，生成小说的核心卖点和世界法则。

请以 JSON 格式返回以下字段：

1. **goldFinger**（主角金手指）- 详细描述能力机制、特性、成长路径、限制，200-400字
2. **synopsis**（故事简介）- 概括核心冲突、主角背景、目标和挑战，150-300字
3. **levelingSystem**（等级体系）- 完整的等级划分、特征、突破条件，200-400字
4. **background**（世界背景）- 地理格局、势力分布、历史沿革、核心矛盾，200-400字
5. **worldRules**（世界规律）- 出行方式、金钱体系、社会制度、交易规则、通讯方式等，200-400字
6. **currentPlotProgress**（故事开局）- 开局场景、主角状态、触发事件、第一个挑战，150-250字

要求：
- 金手指要有独特性和合理性
- 世界观要自洽，各元素相互呼应
- 符合"${basicIdentity.style}"类型的特点
- 遵循文风要求：${basicIdentity.authorNote}`;

    const userPrompt = `创意核心："${idea}"

已有设定：
- 标题：${basicIdentity.title}
- 类型：${basicIdentity.style}
- 标签：${basicIdentity.tags?.join('、')}

请生成核心卖点和世界法则。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 2048
    }));

    const result = parseAIResponse(response);
    if (!result) throw new Error("生成核心卖点失败");

    return {
      goldFinger: typeof result.goldFinger === 'string' ? result.goldFinger : '',
      synopsis: typeof result.synopsis === 'string' ? result.synopsis : '',
      levelingSystem: typeof result.levelingSystem === 'string' ? result.levelingSystem : '',
      background: typeof result.background === 'string' ? result.background : '',
      worldRules: typeof result.worldRules === 'string' ? result.worldRules : '',
      currentPlotProgress: typeof result.currentPlotProgress === 'string' ? result.currentPlotProgress : ''
    };
  } catch (error) {
    console.error("生成核心卖点错误:", error);
    throw error;
  }
};

/**
 * 第三步：基于前两步生成人物档案和势力档案
 */
export const generateCharactersAndFactions = async (
  idea: string,
  fullSettings: Partial<NovelSettings>,
  model: AvailableModel,
  novelType?: 'long' | 'short'
): Promise<{ characters: Character[], factions: Faction[], locations: Location[] }> => {
  try {
    const characterCount = novelType === 'short' ? '3-5个' : '5-8个';
    const locationCount = novelType === 'short' ? '3-5个' : '5-8个';

    const systemPrompt = `你是资深网络小说角色设计师。基于已有的完整世界观设定，生成人物档案、势力档案和地点档案。

请以 JSON 格式返回，包含三个字段：

1. **characters**（人物档案数组）- 生成${characterCount}主要角色，每个角色包含：
   基础信息：
   - name（姓名）
   - role（角色定位：男主/女主/反派/配角等）
   - description（外貌性格能力描述，100-200字）
   - relationToProtagonist（与主角关系）
   - gender（性别）
   - age（年龄）
   - personality（性格特征，如：冷静、热血）
   - currentStatus（当前状态，默认"健康"）
   - currentLocation（当前所在地，填写地点名称，未知则填"未知"）
   - faction（所属势力）
   - cultivationLevel（境界等级，修仙类必填）

   关系与能力（可选，建议主角和重要角色填写开局已知信息）：
   - relations（人物关系网数组，每个关系包含）：
     * characterName: 关联角色名
     * relationType: 关系类型（如：妻子、仇人、师父）
     * attitude: 态度（如：深爱、仇恨、尊敬）
     * background: 关系渊源（50-100字）

   - items（道具/灵宠数组）：
     * name: 道具/灵宠名称
     * description: 能力描述（50-150字）

   - skills（技能数组）：
     * name: 技能名称
     * description: 技能详细能力描述（50-150字）

2. **factions**（势力档案数组）- 生成3-5个主要势力，每个势力包含：
   - name（势力名称）
   - description（势力描述，100-200字）
   - territory（所属地域）
   - members（势力人物列表，填入角色名称数组）

3. **locations**（地点档案数组）- 生成${locationCount}重要地点，每个地点包含：
   - name（地点名称）
   - description（地点描述，包括地理特征、环境氛围、特殊设定等，100-200字）
   - factions（拥有或归属的势力列表，填入势力名称数组）

要求：
- 主角建议配置开局已有的道具/灵宠和技能（如果有的话）
- 重要配角和反派可以配置关键道具和技能
- 主角建议填写开局已知的关键人物关系
- 这些信息会随着剧情发展动态更新，只需填写开局已知的即可
- 角色要有鲜明特点和戏剧冲突
- 势力要与世界背景呼应
- 地点要与世界观和势力分布相匹配，具有故事性和画面感
- 角色的faction字段要对应势力的name
- 角色的currentLocation字段要对应地点的name（如果角色在某个已知地点）
- 势力的members要包含对应角色的name
- 地点的factions要对应势力的name
- 符合"${fullSettings.style}"类型特点
- 遵循文风：${fullSettings.authorNote}`;

    const userPrompt = `创意核心："${idea}"

已有完整设定：
- 标题：${fullSettings.title}
- 类型：${fullSettings.style}
- 标签：${fullSettings.tags?.join('、')}
- 金手指：${fullSettings.goldFinger?.substring(0, 100)}...
- 等级体系：${fullSettings.levelingSystem?.substring(0, 100)}...
- 世界背景：${fullSettings.background?.substring(0, 100)}...

请生成人物档案、势力档案和地点档案。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 4096
    }));

    const result = parseAIResponse(response);
    if (!result) throw new Error("生成人物、势力和地点失败");

    return {
      characters: Array.isArray(result.characters) ? result.characters : [],
      factions: Array.isArray(result.factions) ? result.factions : [],
      locations: Array.isArray(result.locations) ? result.locations : []
    };
  } catch (error) {
    console.error("生成人物、势力和地点错误:", error);
    throw error;
  }
};

/**
 * 完整的世界观生成（三步合一）
 */
export const generateWorldBuilding = async (idea: string, model: AvailableModel, novelType?: 'long' | 'short', targetWords?: number, targetChapters?: number): Promise<Partial<NovelSettings>> => {
  try {
    // 第一步：生成基础身份和文风
    console.log("第一步：生成基础身份和文风...");
    const basicIdentity = await generateBasicIdentity(idea, model, novelType);

    // 第二步：生成核心卖点和世界法则
    console.log("第二步：生成核心卖点和世界法则...");
    const coreWorld = await generateCoreWorldRules(idea, basicIdentity, model);

    // 合并前两步结果
    const fullSettings = {
      ...basicIdentity,
      ...coreWorld
    };

    // 第三步：生成人物档案、势力档案和地点档案
    console.log("第三步：生成人物档案、势力档案和地点档案...");
    const { characters, factions, locations } = await generateCharactersAndFactions(idea, fullSettings, model, novelType);

    // 返回完整结果
    return {
      ...fullSettings,
      characters,
      factions,
      locations
    };
  } catch (error) {
    console.error("生成世界观错误:", error);
    throw error;
  }
};

// ============ 原有的生成函数（已废弃，保留以防需要） ============

export const generateWorldBuilding_OLD = async (idea: string, model: AvailableModel, novelType?: 'long' | 'short', targetWords?: number, targetChapters?: number): Promise<Partial<NovelSettings>> => {
  try {
    // 根据小说类型调整提示
    let typeGuidance = '';
    if (novelType === 'short' && targetWords && targetChapters) {
      typeGuidance = `\n\n⚠️ 注意：这是一部短篇小说（目标${targetWords}字，${targetChapters}章）。请确保：
- 故事结构紧凑，冲突集中
- 角色数量适中（3-5个主要角色即可）
- 世界观设定简洁明了，避免过于复杂的体系
- 剧情线索清晰，能在有限篇幅内完成闭环`;
    } else if (novelType === 'long' && targetWords && targetChapters) {
      typeGuidance = `\n\n💡 这是一部长篇小说（目标${targetWords}字，${targetChapters}章）。可以：
- 构建宏大的世界观和复杂的力量体系
- 设计多条剧情线和丰富的角色关系网
- 预留足够的伏笔和发展空间`;
    }

    const systemPrompt = `你是一位资深的网络小说世界观架构师和创意总监。请根据用户提供的创意核心，生成一套完整、专业、富有深度的小说基础设定体系。${typeGuidance}

请以 JSON 格式返回，包含以下字段（所有字段必须是字符串或数组，不要返回嵌套对象）：

📋 字段说明与生成要求：

1️⃣ **authorNote**（AI创作指南 - 优先生成，指导后续所有内容的文风）
   - 这个字段会直接作为后续AI创作的指导方针
   - 定义核心文风特征（如：暗黑流、爽文、虐文、治愈系等）
   - 明确叙事节奏（快节奏/慢热型/张弛有度）
   - 确定语言风格（简洁凌厉/细腻婉约/幽默诙谐/庄重史诗）
   - 指定描写侧重点（动作/心理/环境/对话）
   - 示例："暗黑流爽文风格，快节奏叙事，语言简洁凌厉，多用短句，侧重动作和画面描写，减少心理独白，主角杀伐果断不拖泥带水"

2️⃣ **title**（小说标题）
   - 标题要有冲击力和记忆点，符合网文命名规律
   - 可使用数字、对比、悬念等技巧（如"万劫魔主"、"九星毒奶"）
   - 避免过于文艺或晦涩的标题

3️⃣ **style**（小说类型/题材）
   - 明确主类型（玄幻/修仙/都市/科幻/武侠/言情/悬疑/历史/规则怪谈/末日生存/灵异/重生/无限流/快穿/洪荒等）
   - 可添加子类型或融合类型（如"都市修仙"、"科幻无限流"）

4️⃣ **tags**（核心标签数组）
   - 3-8个精准标签，涵盖：主角特质、故事主线、爽点元素
   - 示例：["系统流", "扮猪吃虎", "热血", "复仇", "逆袭"]

5️⃣ **goldFinger**（主角金手指/核心能力系统 - 详细机制说明）
   - 详细描述金手指/系统/异能的名称、来源、核心机制
   - 列出关键特性和能力（至少3-5条具体功能）
   - 说明能力的成长路径、使用限制、消耗代价
   - 阐述能力如何帮助主角解决核心矛盾
   - 字数要求：200-400字，要有具体的运作逻辑和独特性
   - 示例："主角林渊觉醒的异能名为【规则编纂者】，可以感知、解析并改写现实中的规则。初期只能微调小范围规则（如改变一个房间内的重力方向、修改某个诡异的行动逻辑），随着能力提升，可以编写更复杂的规则覆盖更大范围。关键特性：1）可以看到诡异遵循的隐藏规则条文；2）消耗精神力改写规则，改写越复杂消耗越大；3）可以将有利规则固化为永久效果；4）后期能创造独立规则领域，在领域内他就是绝对的神。配合觉醒的【规则之眼】，能直接看穿任何诡异的弱点和规则漏洞，堪称诡异的天敌。"

6️⃣ **synopsis**（故事简介/内容梗概）
   - 概括故事的核心冲突和主线剧情
   - 介绍主角的身份背景和初始处境
   - 说明主角的目标和面临的挑战
   - 突出故事的独特卖点和吸引力
   - 字数要求：150-300字，要有戏剧张力和代入感
   - 示例："林焚，曾经的炼药世家少主，因血脉被堂兄夺走沦为废人，未婚妻当众退婚，家族被仇敌灭门。绝望之际，他意外激活体内沉睡的【九劫焚天塔】，获得九种天地异火的传承。从此，这个曾经的废材开始了逆天崛起之路。他要夺回一切，让那些曾经羞辱他的人付出代价，更要查清当年灭门真相，为家族复仇。"

7️⃣ **levelingSystem**（等级/力量体系）
   - 完整的等级划分（至少5-10个大境界）
   - 每个境界的特征、能力差异、寿命变化
   - 突破条件、修炼方式、境界瓶颈
   - 字数要求：200-400字，要有清晰的层次感和递进关系
   - 示例："修炼体系分为：炼体期（1-9层）→筑基期（初/中/后期）→金丹期→元婴期→化神期→渡劫期→大乘期→仙人境。炼体期淬炼肉身，筑基期凝聚灵力根基，金丹期凝结金丹可御空飞行，元婴期元婴出窍寿命千年，化神期神识覆盖万里，渡劫期需渡天劫，大乘期可撕裂空间，仙人境超脱凡俗。每个大境界之间实力差距巨大，跨境界战斗极为困难。"

8️⃣ **background**（世界观背景）
   - 世界的基本构成（地理格局、势力分布、历史沿革）
   - 核心矛盾和冲突来源
   - 世界运行的基本规则和特殊设定
   - 字数要求：200-400字，要有画面感和代入感
   - 示例："故事发生在天元大陆，大陆分为东南西北中五域。千年前，魔族入侵，人族修士联手封印魔族，但封印正在松动。大陆由五大宗门统治：剑宗、丹宗、器宗、阵宗、符宗，各宗门明争暗斗。普通人无法修炼，只有觉醒灵根者才能踏入修仙之路，灵根分为金木水火土五行，以及稀有的雷、冰、风等变异灵根。大陆灵气正在逐渐枯竭，修炼资源日益稀缺，各方势力为争夺资源明争暗斗。"

8️⃣.5 **worldRules**（世界规律法则 - 可选但建议填写）
   - 详细描述世界的运行规则和日常生活机制
   - 包含但不限于：
     * 出行方式：普通人和修士的交通工具（飞行法宝、传送阵、灵兽坐骑、空间通道等）
     * 金钱体系：货币种类、汇率、经济体系（灵石、金币、贡献点等）
     * 社会制度：权力结构、阶级划分、法律规则
     * 交易规则：拍卖行、黑市、以物易物、契约制度
     * 通讯方式：传音符、传讯玉简、灵识传音的距离限制
     * 时间历法：一天多少时辰、一年多少天、特殊节日
     * 其他特殊规则：如禁空阵法、禁制区域、特殊禁忌等
   - 字数要求：200-400字，要具体实用，能指导后续创作
   - 示例："天元大陆通用货币为灵石，分为下品、中品、上品、极品四个等级，1中品=100下品，1上品=100中品。普通人使用金银铜币，1下品灵石=1000金币。修士出行主要依靠：筑基期以下使用灵兽坐骑或飞舟，金丹期以上可御剑飞行，元婴期可瞬移短距离，各大城市间有传送阵但费用昂贵（100上品灵石/次）。通讯方面，修士使用传音符（一次性，百里内有效）或传讯玉简（可重复使用，需要配对），元婴期以上可灵识传音千里。大陆实行宗门制度，各宗门内部有贡献点系统，可兑换功法、丹药、法宝。主要城市都有修仙者联盟设立的执法堂，禁止在城内私斗，违者轻则罚灵石，重则废除修为。"

9️⃣ **currentPlotProgress**（故事开局/当前剧情进度）
   - 描述故事开始时的具体场景和时间点
   - 主角当前的状态和处境
   - 开局的触发事件或转折点
   - 主角即将面临的第一个挑战
   - 字数要求：150-250字，要有画面感和紧迫感
   - 示例："故事开始于退婚现场，未婚妻苏倾城当着全城修士的面羞辱林焚，将退婚书扔在他脸上。就在林焚绝望之际，体内沉睡的【九劫焚天塔】突然觉醒，第一层异火【青莲地心火】涌入体内。林焚决定隐藏实力，暗中修炼，等待复仇的时机。三天后，苏家将举办订婚宴，苏倾城要嫁给夺走林焚血脉的堂兄林傲，这将是林焚复仇的第一步。"

⚠️ 重要提示：
- authorNote字段的文风设定会影响后续所有AI创作的风格，请认真设计
- goldFinger字段要详细描述能力机制，synopsis字段侧重故事梗概
- 各字段之间要相互呼应，形成完整的故事世界
- 内容要富有新意和独特性，避免套路化和同质化
- 人物档案和势力档案将在后续单独生成，本次只需生成基础世界观设定`;

    const userPrompt = `基于创意核心 "${idea}"，为一部网络小说生成完整的专业设定体系。

🎯 生成要求：
1. 首先确定authorNote（文风笔调），让它贯穿后续所有内容
2. goldFinger字段详细描述能力机制，synopsis字段概括故事梗概
3. 每个字段都要详实具体，避免空洞和模糊
4. 金手指、等级体系、世界观要有独特性和合理性
5. 整体风格要符合网络小说的爽点逻辑
6. 人物档案和势力档案将在后续单独生成

💡 创意提示：可以融合多种元素创新，但要保持核心逻辑自洽。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 4096
    }));

    const result = parseAIResponse(response);
    if (!result) throw new Error("Generated world building data is invalid.");

    // 确保所有字段都是正确的类型
    const sanitizedResult: Partial<NovelSettings> = {
      authorNote: typeof result.authorNote === 'string' ? result.authorNote : '', // 优先处理文风设定
      title: typeof result.title === 'string' ? result.title : '',
      style: typeof result.style === 'string' ? result.style : '',
      tags: Array.isArray(result.tags) ? result.tags : [],
      goldFinger: typeof result.goldFinger === 'string' ? result.goldFinger : (typeof result.goldFinger === 'object' ? JSON.stringify(result.goldFinger) : ''),
      synopsis: typeof result.synopsis === 'string' ? result.synopsis : '',
      levelingSystem: typeof result.levelingSystem === 'string' ? result.levelingSystem : (typeof result.levelingSystem === 'object' ? JSON.stringify(result.levelingSystem) : ''),
      background: typeof result.background === 'string' ? result.background : (typeof result.background === 'object' ? JSON.stringify(result.background) : ''),
      worldRules: typeof result.worldRules === 'string' ? result.worldRules : (typeof result.worldRules === 'object' ? JSON.stringify(result.worldRules) : ''),
      currentPlotProgress: typeof result.currentPlotProgress === 'string' ? result.currentPlotProgress : ''
      // 不再包含 characters 和 factions，这些将单独生成
    };

    return sanitizedResult;
  } catch (error) {
    console.error("API Error (generateWorldBuilding):", error);
    throw error;
  }
};

export const generateCoverImage = async (settings: NovelSettings): Promise<string> => {
  try {
    // Use jimeng-4.5 model with dedicated API configuration
    const IMAGE_CONFIG = {
      baseUrl: 'https://api.newcoin.tech',
      apiKey: 'sk-3r6UM9oKHp1GJcuFNpcfXRedeD3AS74gS3r0IapOgpmDsGOd',
      model: 'jimeng-4.5'
    };

    // Build Chinese-style prompt from settings
    let prompt = settings.coverVisualPrompt || '';

    // If no custom prompt, generate a Chinese-style one from settings
    if (!prompt) {
      // 根据小说风格生成中文指令词
      const styleMap: { [key: string]: string } = {
        '玄幻': '中国风玄幻电影感海报，强光影对比，细节丰富的场景',
        '修仙': '仙侠意境海报，云雾缭绕，仙山楼阁，飘逸灵动',
        '都市': '现代都市电影海报，高楼大厦，霓虹灯光，时尚质感',
        '科幻': '科幻电影感海报，未来科技，机械质感，冷色调光影',
        '武侠': '中国武侠电影海报，江湖意境，刀光剑影，水墨质感',
        '言情': '唯美浪漫电影海报，柔和光影，温馨氛围，细腻情感',
        '悬疑': '悬疑惊悚电影海报，暗黑氛围，神秘光影，紧张感',
        '历史': '历史史诗电影海报，古代建筑，宏大场景，厚重质感'
      };

      // 匹配风格关键词
      let stylePrompt = '电影感海报，强光影对比，细节丰富';
      for (const [key, value] of Object.entries(styleMap)) {
        if (settings.style?.includes(key)) {
          stylePrompt = value;
          break;
        }
      }

      // 构建中文指令词
      const titleText = settings.title || '小说';
      const synopsis = settings.synopsis?.substring(0, 100) || '';

      prompt = `${stylePrompt}。画面主体：${synopsis ? synopsis + '。' : ''}书名文字"${titleText}"占据画面上方，创意书法变形字体，渐变，文字加大，大气磅礴，笔锋顿挫有力，延长飞白效果，紧凑，居中，部分笔画带有光效，文字周围带有光晕。二维插画，CG，高清，细节刻画，色彩对比强烈，视觉冲击力强。`;
    }

    console.log('[DEBUG] Generating cover with jimeng-4.5, Chinese prompt:', prompt);
    console.log('[DEBUG] API Config:', { baseUrl: IMAGE_CONFIG.baseUrl, model: IMAGE_CONFIG.model });

    // 使用 AbortController 实现超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300秒(5分钟)超时

    try {
      const response = await fetch(`${IMAGE_CONFIG.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${IMAGE_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: IMAGE_CONFIG.model,
          prompt: prompt,
          n: 1,
          size: '768x1024',  // 3:4 aspect ratio (width:height)
          response_format: 'b64_json'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ERROR] jimeng-4.5 generation failed:', errorText);
        throw new Error(`Image generation failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error('Invalid response format from image generation API');
      }

      console.log('[SUCCESS] Cover generated with jimeng-4.5');
      // Return base64 image with data URI prefix
      return `data:image/png;base64,${data.data[0].b64_json}`;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('图片生成超时（5分钟），请检查网络或联系API提供商');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("API Error (generateCoverImage):", error);
    throw error;
  }
};

/**
 * Generate character avatars (4 avatars in one image, then split)
 * @param characters Array of character info (name, gender, age, description)
 * @param novelStyle Novel genre/style for consistent art style
 * @returns Array of base64 avatar images
 */
export const generateCharacterAvatars = async (
  characters: Array<{ name: string; gender?: string; age?: string; description?: string }>,
  novelStyle: string
): Promise<string[]> => {
  try {
    const IMAGE_CONFIG = {
      baseUrl: 'https://api.newcoin.tech',
      apiKey: 'sk-3r6UM9oKHp1GJcuFNpcfXRedeD3AS74gS3r0IapOgpmDsGOd',
      model: 'jimeng-4.5'
    };

    // 根据小说风格确定画风
    const styleMap: { [key: string]: string } = {
      '玄幻': '中国风玄幻插画，古风服饰，仙气飘逸',
      '修仙': '仙侠风格插画，仙袍飘逸，灵气环绕',
      '都市': '现代都市风格，时尚服装，写实画风',
      '科幻': '科幻未来风格，科技装备，赛博朋克',
      '武侠': '中国武侠风格，古装侠客，水墨质感',
      '言情': '唯美浪漫风格，精致五官，柔和光影',
      '悬疑': '写实风格，现代服装，神秘氛围',
      '历史': '古代历史风格，朝代服饰，厚重质感'
    };

    let artStyle = '精美插画，细节丰富';
    for (const [key, value] of Object.entries(styleMap)) {
      if (novelStyle?.includes(key)) {
        artStyle = value;
        break;
      }
    }

    // 构建4个角色的组合提示词
    const characterPrompts = characters.slice(0, 4).map((char, idx) => {
      const genderDesc = char.gender === '女' ? '女性' : char.gender === '男' ? '男性' : '人物';
      const ageDesc = char.age ? `${char.age}岁` : '';
      const desc = char.description?.substring(0, 50) || '';
      return `${genderDesc}${ageDesc ? ` ${ageDesc}` : ''}角色${desc ? `，${desc}` : ''}`;
    }).join('；');

    const prompt = `2x2网格布局，四个角色头像肖像，${artStyle}。${characterPrompts}。每个角色独立的正面半身肖像，清晰的五官特征，统一的艺术风格，高质量CG插画，细节刻画，色彩鲜明。`;

    console.log('[DEBUG] Generating 4 character avatars with prompt:', prompt);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch(`${IMAGE_CONFIG.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${IMAGE_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: IMAGE_CONFIG.model,
          prompt: prompt,
          n: 1,
          size: '1024x1024',  // Square for easy splitting
          response_format: 'b64_json'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ERROR] Avatar generation failed:', errorText);
        throw new Error(`Avatar generation failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error('Invalid response from avatar generation API');
      }

      const fullImageBase64 = data.data[0].b64_json;
      console.log('[SUCCESS] 4-avatar image generated, now splitting...');

      // Split the image into 4 parts
      const avatars = await splitImageInto4(fullImageBase64);
      return avatars;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('头像生成超时（5分钟）');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error generating character avatars:", error);
    throw error;
  }
};

/**
 * Generate single character avatar with custom prompt
 * Uses the user-provided prompt directly for better control
 */
export const generateSingleAvatar = async (
  customPrompt: string
): Promise<string> => {
  try {
    const IMAGE_CONFIG = {
      baseUrl: 'https://api.newcoin.tech',
      apiKey: 'sk-3r6UM9oKHp1GJcuFNpcfXRedeD3AS74gS3r0IapOgpmDsGOd',
      model: 'jimeng-4.5'
    };

    console.log('[DEBUG] Generating single avatar with custom prompt:', customPrompt);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch(`${IMAGE_CONFIG.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${IMAGE_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: IMAGE_CONFIG.model,
          prompt: customPrompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ERROR] Single avatar generation failed:', errorText);
        throw new Error(`Avatar generation failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error('Invalid response from avatar generation API');
      }

      const imageBase64 = data.data[0].b64_json;
      console.log('[SUCCESS] Single avatar generated');

      return `data:image/png;base64,${imageBase64}`;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('头像生成超时（5分钟）');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error generating single avatar:", error);
    throw error;
  }
};

/**
 * Generate image prompt for character avatar
 * Uses AI to create a detailed prompt based on character info
 * Optimized for Chinese AI image models like JiMeng (即梦)
 */
export const generateAvatarPrompt = async (
  character: { name: string; gender?: string; age?: string; description?: string },
  novelStyle: string,
  model: AvailableModel = 'claude-sonnet-4-5-20250929'
): Promise<string> => {
  try {
    const config = getApiConfig(model);

    const systemPrompt = `你是一个专业的中文AI绘画提示词生成专家，专门为即梦（JiMeng）等中文AI绘画模型生成提示词。

要求：
1. 必须使用纯中文，不要使用任何英文单词
2. 必须包含"画面禁止出现文字"或"禁止文字"
3. 详细描述角色的外貌特征、服装、气质、表情、视角
4. 包含画面构图、氛围感、光影效果
5. 根据小说类型选择合适的画风和艺术风格
6. 强调画质：高质量、极致细节、64K、超高清
7. 只输出提示词本身，用逗号分隔，不要有其他解释
8. 提示词长度控制在150-200字之间

禁止使用的词汇（会干扰头像生成）：
- 身高相关：身高、高大、矮小、修长等
- 黑白配色
- 动态模糊、背景动态模糊
- 屏幕四角偏暗、四角偏暗

参考优质示例：
动漫头像，二次元头像，主题风格，画面完美比例，高级感配色，脸部特写，参考网红模版，氛围感，二次元氛围感头像，男生，18岁，随机搭配，眼神犀利，彰显气质，动漫风格，高质量，极致细节，64K，超高清，男神，小说男主，蔑视的眼神，仰视视角凸显角色的威压，画面禁止出现文字

关键要素：
- 画面构图：脸部特写、仰视视角、俯视视角、平视视角
- 氛围感：氛围感、大面积留白、参考网红模版
- 配色：高级感配色、冷色调、暖色调（不要黑白配色）
- 眼神：犀利、温柔、冷漠、坚定、蔑视等
- 气质：彰显气质、威压感、温柔感、神秘感
- 画质：高质量、极致细节、64K、超高清`;

    const userPrompt = `小说类型：${novelStyle || '现代'}
角色信息：
- 姓名：${character.name}
- 性别：${character.gender || '未知'}
- 年龄：${character.age || '未知'}
- 描述：${character.description || '无'}

请生成一个纯中文的角色头像绘画提示词，适合即梦AI绘画模型，必须包含"画面禁止出现文字"。`;

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 600
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate prompt: ${response.status}`);
    }

    const data = await response.json();
    let generatedPrompt = data.choices[0]?.message?.content?.trim() || '';

    // Ensure "禁止文字" is included
    if (!generatedPrompt.includes('禁止') && !generatedPrompt.includes('文字')) {
      generatedPrompt += '，画面禁止出现文字';
    }

    console.log('[SUCCESS] Generated avatar prompt:', generatedPrompt);
    return generatedPrompt;
  } catch (error) {
    console.error("Error generating avatar prompt:", error);
    // Fallback to high-quality Chinese prompt
    const genderDesc = character.gender === '女' ? '女性' : character.gender === '男' ? '男性' : '人物';
    const ageDesc = character.age ? `${character.age}岁` : '青年';
    const desc = character.description?.substring(0, 80) || '';

    // Style mapping with enhanced details (removed: 身高, 黑白配色, 动态模糊, 四角偏暗)
    const styleMap: { [key: string]: string } = {
      '玄幻': '动漫头像，二次元头像，中国风玄幻风格，古风服饰，仙气飘逸，脸部特写，眼神深邃，彰显仙侠气质，大面积留白，氛围感，高级感配色',
      '修仙': '动漫头像，二次元头像，仙侠风格，仙袍飘逸，灵气环绕，脸部特写，眼神坚定，修仙者气质，大面积留白，氛围感，高级感配色',
      '都市': '动漫头像，二次元头像，现代都市风格，时尚服装，写实画风，脸部特写，眼神自信，都市精英气质，参考网红模版，氛围感，高级感配色',
      '科幻': '动漫头像，二次元头像，科幻未来风格，科技装备，赛博朋克，脸部特写，眼神犀利，科技感，氛围感，冷色调配色',
      '武侠': '动漫头像，二次元头像，中国武侠风格，古装侠客，水墨质感，脸部特写，眼神凌厉，侠客气质，大面积留白，氛围感，高级感配色',
      '言情': '动漫头像，二次元头像，唯美浪漫风格，精致五官，柔和光影，脸部特写，眼神温柔，浪漫气质，参考网红模版，氛围感，暖色调配色',
      '悬疑': '动漫头像，二次元头像，写实风格，现代服装，神秘氛围，脸部特写，眼神深邃，神秘气质，氛围感，冷色调配色',
      '历史': '动漫头像，二次元头像，古代历史风格，朝代服饰，厚重质感，脸部特写，眼神威严，历史人物气质，大面积留白，氛围感，高级感配色'
    };

    let artStyle = '动漫头像，二次元头像，主题风格，画面完美比例，高级感配色，脸部特写，氛围感';
    for (const [key, value] of Object.entries(styleMap)) {
      if (novelStyle?.includes(key)) {
        artStyle = value;
        break;
      }
    }

    // Build comprehensive prompt
    const eyeExpression = character.gender === '女' ? '眼神温柔' : '眼神犀利';
    const characterType = character.gender === '女' ? '小说女主' : '小说男主';

    return `${artStyle}，${genderDesc}，${ageDesc}，${desc}，${eyeExpression}，彰显气质，动漫风格，高质量，极致细节，64K，超高清，${characterType}，画面禁止出现文字`;
  }
};

/**
 * Split a 1024x1024 image into 4 equal parts (2x2 grid)
 * @param base64Image Base64 encoded image
 * @returns Array of 4 base64 images
 */
async function splitImageInto4(base64Image: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      const halfWidth = width / 2;
      const halfHeight = height / 2;

      const avatars: string[] = [];

      // Create 4 canvases for each quadrant
      const positions = [
        { x: 0, y: 0 },              // Top-left
        { x: halfWidth, y: 0 },      // Top-right
        { x: 0, y: halfHeight },     // Bottom-left
        { x: halfWidth, y: halfHeight } // Bottom-right
      ];

      for (const pos of positions) {
        const canvas = document.createElement('canvas');
        canvas.width = halfWidth;
        canvas.height = halfHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw the specific quadrant
        ctx.drawImage(
          img,
          pos.x, pos.y, halfWidth, halfHeight,  // Source rectangle
          0, 0, halfWidth, halfHeight            // Destination rectangle
        );

        // Convert to base64
        const avatarBase64 = canvas.toDataURL('image/png');
        avatars.push(avatarBase64);
      }

      console.log('[SUCCESS] Image split into 4 avatars');
      resolve(avatars);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for splitting'));
    };

    // Load the base64 image
    img.src = `data:image/png;base64,${base64Image}`;
  });
}

/**
 * Extract writing style from uploaded novel text
 */
export const extractWritingStyle = async (
  novelText: string,
  model: AvailableModel
): Promise<string> => {
  try {
    const { baseUrl, apiKey } = getApiConfig(model);

    // Limit text length to avoid token limits (use first 10000 characters)
    const sampleText = novelText.substring(0, 10000);

    const prompt = `请仔细分析以下小说文本的写作风格，并生成一份详细的文风指南，用于指导 AI 模仿这种风格进行创作。

⚠️ 重要要求：
- 只提取通用的写作风格特征，不要提及任何具体的角色名、地名、组织名等专有名词
- 用"主角"、"配角"、"反派"等通用称呼代替具体角色名
- 用"某地"、"某城"等通用词代替具体地名
- 聚焦于写作技巧和风格特点，而非故事内容

分析维度：
1. 叙事视角：第一人称/第三人称/全知视角等
2. 句式特点：长句/短句、简洁/华丽、节奏快慢
3. 用词风格：文言/白话、书面/口语、专业术语使用
4. 描写手法：心理描写、动作描写、环境描写的比重和特点
5. 对话风格：对话占比、对话方式（直接/间接）、语气特点
6. 情感基调：冷峻/温暖、幽默/严肃、悲观/乐观
7. 叙事节奏：快节奏/慢节奏、详略处理方式
8. 特色表达：常用修辞手法、独特的表达习惯

请基于以下文本样本，生成一份简洁但全面的文风指南（200-400字），直接用于指导 AI 创作：

---
${sampleText}
---

请直接输出文风指南，不要包含"分析如下"等前缀，不要提及具体角色名或地名，直接给出可用于 AI 创作指导的通用描述性文本。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'user', content: prompt }
    ]));

    return response.trim();
  } catch (error) {
    console.error("API Error (extractWritingStyle):", error);
    throw error;
  }
};

export const draftChapterContent = async (
  settings: NovelSettings,
  previousChapters: Chapter[],
  model: AvailableModel,
  customInstruction: string = ""
): Promise<{ title: string; content: string }> => {
  return { title: "Deprecated in UI", content: "Please use streaming." };
};

export const streamChapterDraft = async (
  settings: NovelSettings,
  previousChapters: Chapter[],
  model: AvailableModel,
  customInstruction: string = "",
  creationOptions: ChapterCreationOptions = {},
  onUpdate: (data: { title: string; content: string }) => void
): Promise<void> => {
  try {
    const lastChapter = previousChapters[previousChapters.length - 1];
    const currentChapterNum = previousChapters.length + 1;
    const targetWordCount = creationOptions.targetWordCount || 3000;

    // 短篇小说模式检测
    const isShortNovel = settings.novelType === 'short';
    const targetChapterCount = settings.targetChapterCount;
    const targetTotalWords = settings.targetTotalWords;
    const isLastChapter = isShortNovel && targetChapterCount && currentChapterNum >= targetChapterCount;
    const isFinalPhase = isShortNovel && targetChapterCount && currentChapterNum >= targetChapterCount - 1;

    // 计算短篇小说的建议字数
    let adjustedWordCount = targetWordCount;
    if (isShortNovel && targetTotalWords && targetChapterCount) {
      const totalWrittenWords = previousChapters.reduce((sum, ch) => sum + ch.content.length, 0);
      const remainingWords = targetTotalWords - totalWrittenWords;
      const remainingChapters = targetChapterCount - previousChapters.length;

      if (remainingChapters > 0) {
        adjustedWordCount = Math.max(1000, Math.floor(remainingWords / remainingChapters));
      }
    }

    // Safety truncation
    const MAX_PREV_CONTEXT_LEN = 20000;
    let safeLastChapterContent = '';
    if (lastChapter) {
      safeLastChapterContent = lastChapter.content.length > MAX_PREV_CONTEXT_LEN
        ? "..." + lastChapter.content.slice(-MAX_PREV_CONTEXT_LEN)
        : lastChapter.content;
    }

    // ============================================
    // RAG 检索逻辑（三步走）
    // ============================================

    // 构建检索上下文：章节梗概 + 剧情要点 + 指定出场角色 + 上一章内容片段
    const retrievalContext = [
      creationOptions.synopsis || '',
      creationOptions.plotPoints?.map(p => p.content).join(' ') || '',
      creationOptions.featuredCharacters?.join(' ') || '',
      safeLastChapterContent.slice(-500) // 上一章结尾500字
    ].filter(Boolean).join(' ').toLowerCase();

    // ============================================
    // 第一步：检索相关角色（基于出场角色和梗概）
    // ============================================
    const relevantCharacters = new Set<string>();

    // 1. 添加指定出场角色
    if (creationOptions.featuredCharacters) {
      creationOptions.featuredCharacters.forEach(name => relevantCharacters.add(name));
    }

    // 2. 检索在上下文中被提及的角色
    if (settings.characters && settings.characters.length > 0) {
      settings.characters.forEach(char => {
        // 检查角色名是否在上下文中出现
        if (retrievalContext.includes(char.name.toLowerCase())) {
          relevantCharacters.add(char.name);
        }
        // 检查角色关系网中的角色是否在上下文中
        if (char.relations) {
          char.relations.forEach(rel => {
            if (retrievalContext.includes(rel.characterName.toLowerCase())) {
              relevantCharacters.add(char.name); // 如果关系人物被提及，也添加该角色
            }
          });
        }
      });
    }

    // ============================================
    // 第二步：根据完整角色信息检索势力和地点
    // ============================================

    // 获取检索到的完整角色信息
    const retrievedCharacters = settings.characters?.filter(c =>
      relevantCharacters.has(c.name)
    ) || [];

    // 2.1 检索相关势力（基于角色的faction字段 + 上下文提及）
    const relevantFactions = new Set<string>();

    // 从角色的faction字段收集势力
    retrievedCharacters.forEach(char => {
      if (char.faction) {
        relevantFactions.add(char.faction);
      }
    });

    // 检查上下文中直接提及的势力
    if (settings.factions && settings.factions.length > 0) {
      settings.factions.forEach(faction => {
        if (retrievalContext.includes(faction.name.toLowerCase())) {
          relevantFactions.add(faction.name);
        }
      });
    }

    // 2.2 检索相关地点（基于角色的currentLocation字段 + 上下文提及）
    const relevantLocations = new Set<string>();

    // 从角色的currentLocation字段收集地点
    retrievedCharacters.forEach(char => {
      if (char.currentLocation && char.currentLocation !== '未知') {
        relevantLocations.add(char.currentLocation);
      }
    });

    // 检查上下文中直接提及的地点
    if (settings.locations && settings.locations.length > 0) {
      settings.locations.forEach(location => {
        if (retrievalContext.includes(location.name.toLowerCase())) {
          relevantLocations.add(location.name);
        }
      });
    }

    // 从势力的territory字段收集地点（势力所在地域）
    if (settings.factions && settings.factions.length > 0) {
      settings.factions.forEach(faction => {
        if (relevantFactions.has(faction.name) && faction.territory) {
          // 检查territory是否匹配某个地点名称
          settings.locations?.forEach(location => {
            if (faction.territory.includes(location.name) || location.name.includes(faction.territory)) {
              relevantLocations.add(location.name);
            }
          });
        }
      });
    }

    // ============================================
    // 第三步：构建上下文信息（角色、势力、地点）
    // ============================================

    // 3.1 构建角色上下文（使用检索到的角色）
    let characterContext = '';
    if (relevantCharacters.size > 0) {
      const featuredChars = retrievedCharacters;
      if (featuredChars.length > 0) {
        characterContext = `\n\n=== 本章相关角色档案 ===\n${featuredChars.map(c => {
          let charInfo = `- ${c.name}（${c.role}）：${c.description}，与主角关系：${c.relationToProtagonist}`;

          // 添加状态信息
          if (c.currentStatus) charInfo += `，当前状态：${c.currentStatus}`;
          if (c.cultivationLevel) charInfo += `，境界：${c.cultivationLevel}`;
          if (c.faction) charInfo += `，所属势力：${c.faction}`;
          if (c.currentLocation) charInfo += `，当前所在地：${c.currentLocation}`;

          // 添加关系网(简化版)
          if (c.relations && c.relations.length > 0) {
            const relations = c.relations.slice(0, 3).map(r => `${r.characterName}(${r.relationType})`).join('、');
            charInfo += `，关系网：${relations}`;
          }

          // 添加关键道具/技能
          if (c.items && c.items.length > 0) {
            const items = c.items.slice(0, 2).map(i => i.name).join('、');
            charInfo += `，道具：${items}`;
          }
          if (c.skills && c.skills.length > 0) {
            const skills = c.skills.slice(0, 2).map(s => s.name).join('、');
            charInfo += `，技能：${skills}`;
          }

          return charInfo;
        }).join('\n')}`;
      }
    }

    // 3.2 构建势力上下文（使用检索到的势力）
    let factionContext = '';
    if (relevantFactions.size > 0) {
      const featuredFactions = settings.factions?.filter(f =>
        relevantFactions.has(f.name)
      ) || [];
      if (featuredFactions.length > 0) {
        factionContext = `\n\n=== 本章相关势力档案 ===\n${featuredFactions.map(f =>
          `- ${f.name}：${f.description}，地域：${f.territory}，成员：${f.members.join('、')}`
        ).join('\n')}`;
      }
    }

    // 3.3 构建地点上下文（使用检索到的地点）
    let locationContext = '';
    if (relevantLocations.size > 0) {
      const featuredLocations = settings.locations?.filter(l =>
        relevantLocations.has(l.name)
      ) || [];
      if (featuredLocations.length > 0) {
        locationContext = `\n\n=== 本章相关地点档案 ===\n${featuredLocations.map(l => {
          let locInfo = `- ${l.name}：${l.description}`;
          if (l.factions && l.factions.length > 0) {
            locInfo += `，归属势力：${l.factions.join('、')}`;
          }
          return locInfo;
        }).join('\n')}`;
      }
    }

    // Build new characters context
    let newCharContext = '';
    if (creationOptions.newCharacters && creationOptions.newCharacters.length > 0) {
      newCharContext = `\n\n=== 本章新增角色（请在剧情中自然引入） ===\n${creationOptions.newCharacters.map(c =>
        `- ${c.name}${c.description ? `：${c.description}` : ''}`
      ).join('\n')}`;
    }

    // Build plot points context with importance levels
    let plotPointsContext = '';
    if (creationOptions.plotPoints && creationOptions.plotPoints.length > 0) {
      const majorPoints = creationOptions.plotPoints.filter(p => p.importance === 'major');
      const minorPoints = creationOptions.plotPoints.filter(p => p.importance === 'minor');

      plotPointsContext = `\n\n=== 本章剧情要点 ===`;

      if (majorPoints.length > 0) {
        plotPointsContext += `\n【重点情节 - 需详细描写】\n${majorPoints.map((p, i) =>
          `${i + 1}. ${p.content}`
        ).join('\n')}`;
      }

      if (minorPoints.length > 0) {
        plotPointsContext += `\n【次要情节 - 可简略带过】\n${minorPoints.map((p, i) =>
          `${i + 1}. ${p.content}`
        ).join('\n')}`;
      }
    }

    // 短篇小说特殊提示
    let shortNovelGuidance = '';
    if (isShortNovel && targetChapterCount) {
      if (isLastChapter) {
        shortNovelGuidance = `\n\n⚠️ **这是最后一章（第${currentChapterNum}/${targetChapterCount}章）**\n- 必须完成所有主要剧情线的收尾\n- 给予主角和重要角色明确的结局\n- 营造完整的故事闭环感\n- 避免留下未解决的重大悬念`;
      } else if (isFinalPhase) {
        shortNovelGuidance = `\n\n⚠️ **即将进入尾声（第${currentChapterNum}/${targetChapterCount}章）**\n- 开始推动主要冲突走向高潮\n- 逐步解决次要剧情线\n- 为最终章做好铺垫`;
      } else {
        const progress = Math.round((currentChapterNum / targetChapterCount) * 100);
        shortNovelGuidance = `\n\n📊 **短篇进度：第${currentChapterNum}/${targetChapterCount}章（${progress}%）**\n- 注意控制剧情节奏，避免拖沓\n- 确保每章都有实质性的剧情推进`;
      }
    } else if (!isShortNovel && targetChapterCount && targetTotalWords) {
      // 长篇小说进度提示
      const progress = Math.round((currentChapterNum / targetChapterCount) * 100);
      const totalWrittenWords = previousChapters.reduce((sum, ch) => sum + ch.content.length, 0);
      const wordProgress = Math.round((totalWrittenWords / targetTotalWords) * 100);
      shortNovelGuidance = `\n\n📊 **长篇进度：第${currentChapterNum}/${targetChapterCount}章（${progress}%）| 已写${totalWrittenWords}/${targetTotalWords}字（${wordProgress}%）**\n- 保持稳定的剧情推进节奏\n- 注意伏笔的铺设与回收`;
    }

    const systemPrompt = `# Role
你是一位专业的网文小说创作大师，擅长驾驭 "${settings.style || '通俗爽文'}" 风格。
你的目标是根据用户的设定，创作出极具吸引力、节奏感强且符合逻辑的章节。

# Writing Guidelines (创作指南)
${settings.authorNote || '请保持快节奏，注重画面感，减少无效心理描写，多用动作推动剧情。'}

# General Rules
1. **剧情衔接（最高优先级）：** 必须仔细阅读提供的【上一章完整内容】。本章开头必须紧承上一章的动作、对话或悬念，确保连贯性。
2. **格式规范：** 建议采用"一句话一段"的排版格式（除非用户有其他要求），以适应移动端阅读体验。
3. **沉浸感：** 避免枯燥的设定堆砌或过多的心理独白，通过环境互动、肢体语言和对话来展现人物与冲突。
4. **字数要求（严格遵守）：** 本章目标字数为 ${adjustedWordCount} 字，误差范围 ±10%（${Math.floor(adjustedWordCount * 0.9)}-${Math.ceil(adjustedWordCount * 1.1)}字）。请严格控制字数，不要超出范围。${shortNovelGuidance}`;

    const contextPrompt = `=== 作品档案 ===
书名：${settings.title}
风格：${settings.style}
核心设定/金手指：${settings.goldFinger}
升级体系：${settings.levelingSystem}
世界背景：${settings.background}
世界规律法则：${settings.worldRules || '无'}
${currentChapterNum === 1 ? `简介：${settings.synopsis}` : ''}

=== 剧情沙盘（包含所有已归档章节的剧情进展） ===
${settings.currentPlotProgress}
${characterContext}${factionContext}${locationContext}${newCharContext}${plotPointsContext}

${lastChapter ? `
=== 上一章（第${lastChapter.number}章）完整内容 [必须阅读] ===
（请确保新章节的内容与下方结尾完美衔接）
${safeLastChapterContent}
================================================
` : ''}`;

    const taskPrompt = `请根据提供的核心设定与前文脉络，续写下一个章节（第${currentChapterNum}章）。
${customInstruction ? `特别创作要求：${customInstruction}` : ""}
${isLastChapter ? '\n⚠️ **重要：这是全书最后一章，必须完成故事收尾！**' : ''}

输出格式要求：
1. **严禁使用 JSON 格式**。请直接输出文本。
2. **严禁使用 Markdown 代码块**。
3. 第一行必须是：TITLE: 章节标题
4. 之后空两行，直接开始正文内容。
5. **字数严格要求：正文必须控制在 ${Math.floor(adjustedWordCount * 0.9)}-${Math.ceil(adjustedWordCount * 1.1)} 字之间（目标${adjustedWordCount}字，误差±10%）**
6. 如果剧情节点较多导致字数超标，请适当精简描写，保持节奏紧凑。
7. 如果剧情节点较少导致字数不足，请适当增加细节描写和对话。`;

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextPrompt + '\n\n' + taskPrompt }
    ];

    let fullText = "";

    const stream = streamChatAPI(model, messages, { max_tokens: 8192 });

    for await (const chunk of stream) {
      fullText += chunk;

      let title = "";
      let content = "";

      // Simple robust parsing for "TITLE: <Title>\n\n<Content>"
      if (fullText.startsWith("TITLE:")) {
        const firstLineEnd = fullText.indexOf('\n');
        if (firstLineEnd !== -1) {
          title = fullText.substring(6, firstLineEnd).trim();
          content = fullText.substring(firstLineEnd).trim();
        } else {
          title = fullText.substring(6).trim();
        }
      } else {
        content = fullText;
      }

      onUpdate({ title, content });
    }

  } catch (error) {
    console.error("API Error (streamChapterDraft):", error);
    throw error;
  }
};

/**
 * Generate chapter configuration based on novel settings and previous chapter
 */
export const generateChapterPlan = async (
  settings: NovelSettings,
  chapters: Chapter[],
  model: AvailableModel,
  authorNote?: string,
  targetWordCount?: number
): Promise<{
  synopsis: string;
  selectedCharacters: string[];
  newCharacters: { name: string; description: string }[];
  plotPoints: { content: string; importance: 'major' | 'minor' }[];
}> => {
  try {
    const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
    const nextChapterNum = chapters.length + 1;

    // Build character context with detailed information
    const characterContext = settings.characters && settings.characters.length > 0
      ? settings.characters.map(c => {
          let charInfo = `${c.name} (${c.role}): ${c.description}`;

          // 添加基础属性
          if (c.gender || c.age || c.personality) {
            const attrs = [];
            if (c.gender) attrs.push(`性别: ${c.gender}`);
            if (c.age) attrs.push(`年龄: ${c.age}`);
            if (c.personality) attrs.push(`性格: ${c.personality}`);
            charInfo += ` | ${attrs.join(', ')}`;
          }

          // 添加状态信息
          if (c.currentStatus) charInfo += ` | 当前状态: ${c.currentStatus}`;
          if (c.currentLocation) charInfo += ` | 当前所在地: ${c.currentLocation}`;
          if (c.faction) charInfo += ` | 所属势力: ${c.faction}`;
          if (c.cultivationLevel) charInfo += ` | 境界: ${c.cultivationLevel}`;

          // 添加关系网
          if (c.relations && c.relations.length > 0) {
            const relations = c.relations.map(r =>
              `与${r.characterName}的关系: ${r.relationType}(${r.attitude})`
            ).join('; ');
            charInfo += ` | 关系网: ${relations}`;
          }

          // 添加道具/灵宠
          if (c.items && c.items.length > 0) {
            const items = c.items.map(i => `${i.name}(${i.description})`).join(', ');
            charInfo += ` | 道具/灵宠: ${items}`;
          }

          // 添加技能
          if (c.skills && c.skills.length > 0) {
            const skills = c.skills.map(s => `${s.name}(${s.description})`).join(', ');
            charInfo += ` | 技能: ${skills}`;
          }

          return charInfo;
        }).join('\n')
      : '暂无已定义角色';

    // Build faction context
    const factionContext = settings.factions && settings.factions.length > 0
      ? settings.factions.map(f => `${f.name}: ${f.description} | 地域: ${f.territory} | 成员: ${f.members.join('、')}`).join('\n')
      : '暂无势力档案';

    // Build location context
    const locationContext = settings.locations && settings.locations.length > 0
      ? settings.locations.map(l => {
          let locInfo = `${l.name}: ${l.description}`;
          if (l.factions && l.factions.length > 0) {
            locInfo += ` | 归属势力: ${l.factions.join('、')}`;
          }
          return locInfo;
        }).join('\n')
      : '暂无地点档案';

    // 获取上一章结尾内容（约1000字，保证完整句型）
    let lastChapterEndContent = '';
    if (lastChapter && lastChapter.content) {
      const fullContent = lastChapter.content;
      const targetLength = 1000;

      if (fullContent.length <= targetLength) {
        lastChapterEndContent = fullContent;
      } else {
        // 从后往前取约1000字
        let startPos = fullContent.length - targetLength;

        // 向后查找第一个完整句子的开头（句号、问号、感叹号、换行后）
        const sentenceEnders = ['。', '！', '？', '\n'];
        while (startPos < fullContent.length - 1) {
          const char = fullContent[startPos];
          if (sentenceEnders.includes(char)) {
            startPos++; // 跳过标点符号本身
            break;
          }
          startPos++;
        }

        lastChapterEndContent = fullContent.substring(startPos).trim();
      }
    }

    // 根据目标字数确定剧情节点数量和详细程度
    const wordCount = targetWordCount || 3000;
    let plotPointsGuidance = '';
    let plotPointsCount = '';

    if (wordCount <= 1500) {
      plotPointsCount = '2-3个';
      plotPointsGuidance = '字数较少，剧情节点要精简，每个节点用一句话概括即可（10-20字）';
    } else if (wordCount <= 3000) {
      plotPointsCount = '3-4个';
      plotPointsGuidance = '标准字数，剧情节点适中，每个节点简要描述（20-30字）';
    } else if (wordCount <= 5000) {
      plotPointsCount = '4-5个';
      plotPointsGuidance = '字数较多，可以增加剧情节点，每个节点可以稍微详细（30-40字）';
    } else {
      plotPointsCount = '5-6个';
      plotPointsGuidance = '字数很多，剧情节点可以更丰富，每个节点可以详细描述（40-50字）';
    }

    const systemPrompt = `你是一位资深网文编辑和大纲策划师。请根据小说的核心设定和上一章内容，为下一章生成创作配置。

## 小说核心设定
- 标题: ${settings.title || '未命名'}
- 风格: ${settings.style || '未设定'}
- 题材标签: ${settings.tags?.join('、') || '无'}
- 金手指: ${settings.goldFinger || '无'}
- 升级体系: ${settings.levelingSystem || '无'}
- 世界背景: ${settings.background || '无'}
- 世界规律法则: ${settings.worldRules || '无'}
- 大纲简介: ${settings.synopsis || '无'}
- 作者备注(全局文风): ${settings.authorNote || '无'}

## 已有角色
${characterContext}

## 势力档案
${factionContext}

## 地点档案
${locationContext}

## 当前剧情进度（剧情沙盘）
${settings.currentPlotProgress || '刚开始'}

${lastChapter ? `## 上一章结尾内容 (第${lastChapter.number}章: ${lastChapter.title})
${lastChapterEndContent || '暂无内容'}
` : '## 上一章内容\n这是第一章，暂无上文。'}

${authorNote ? `## 本章特殊要求（作者备注）
${authorNote}
` : ''}

## 目标字数
本章目标字数：${wordCount}字

## 任务要求
请为第${nextChapterNum}章生成创作配置，包括:
1. **章节梗概** (synopsis): 简要描述本章的主要内容和发展方向 (50-100字)
2. **出场角色** (selectedCharacters): 从已有角色中选择2-4个本章会出场的角色名字
3. **新增角色** (newCharacters): 如果需要引入新角色，提供角色名和简短描述 (0-2个)
4. **剧情节点** (plotPoints): 本章需要发生的${plotPointsCount}关键情节，每个节点标记重要度:
   - "major" (重点): 需要详细描写的核心情节
   - "minor" (略写): 可以一笔带过的次要情节

   **重要：${plotPointsGuidance}**
   **剧情节点要简洁，避免过于详细的描述，否则会导致生成的正文字数远超目标**

## 输出格式
请严格按照以下JSON格式输出，不要添加任何其他文字:
\`\`\`json
{
  "synopsis": "章节梗概文字",
  "selectedCharacters": ["角色名1", "角色名2"],
  "newCharacters": [
    {"name": "新角色名", "description": "角色描述"}
  ],
  "plotPoints": [
    {"content": "情节描述", "importance": "major"},
    {"content": "情节描述", "importance": "minor"}
  ]
}
\`\`\`

注意事项:
- 确保剧情连贯，承接上一章结尾内容
- 符合小说的题材风格和金手指设定
- 遵循世界规律法则的设定
- 考虑势力之间的关系和冲突
- 考虑地点的环境特征和氛围
- 重点情节(major)应该是推动剧情的核心事件
- 略写情节(minor)是过渡性的次要事件
- 如果没有新角色，newCharacters可以为空数组
- **剧情节点数量要严格控制在${plotPointsCount}，每个节点描述要简洁**
${authorNote ? '- 必须考虑本章特殊要求（作者备注）' : ''}`;

    const response = await callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请为下一章生成创作配置。' }
    ], {
      temperature: 0.8,
      max_tokens: 2000
    });

    const parsed = parseAIResponse(response);
    if (!parsed) {
      throw new Error('Failed to parse AI response');
    }

    return {
      synopsis: parsed.synopsis || '',
      selectedCharacters: Array.isArray(parsed.selectedCharacters) ? parsed.selectedCharacters : [],
      newCharacters: Array.isArray(parsed.newCharacters) ? parsed.newCharacters : [],
      plotPoints: Array.isArray(parsed.plotPoints) ? parsed.plotPoints : []
    };
  } catch (error) {
    console.error('Error generating chapter plan:', error);
    throw error;
  }
};

/**
 * Multi-turn Chat for Editing/Refining with selected text support
 */
export const chatWithChapter = async (
  history: { role: 'user' | 'model', content: string }[],
  currentChapterContent: string,
  settings: NovelSettings,
  model: AvailableModel,
  selectedText?: string
): Promise<string> => {
  try {
    let systemPrompt = `你是一位专业的网文编辑和创作助手。你的任务是帮助用户优化、改写或提供创作建议。

小说信息：
- 书名：${settings.title}
- 风格：${settings.style}
- 文风要求：${settings.authorNote}

=== 当前章节完整内容（参考上下文） ===
${currentChapterContent.length > 10000 ? currentChapterContent.substring(0, 10000) + '...(内容过长已截断)' : currentChapterContent}
===================================================

${selectedText ? `
=== 用户选中的文本片段 ===
${selectedText}
===================================================

⚠️ 重要提示：用户已选中上述文本片段，他们的问题很可能是针对这段文本的。
` : ''}

工作指南：
1. 如果用户要求改写或润色，请直接提供修改后的完整文本，用清晰的格式标注
2. 如果用户询问建议，提供具体可操作的改进意见
3. 保持小说的整体风格和节奏
4. 对于选中的文本，优先针对该片段提供帮助
5. 改写时要保持原文的核心意图和剧情逻辑

常见任务示例：
- "润色这段" → 直接输出润色后的文本
- "这段太平淡了" → 提供更有张力的改写版本
- "增加细节描写" → 在原文基础上扩充细节
- "简化这段" → 提供精简版本
- "改成第一人称" → 转换视角后的版本`;

    // Convert history to OpenAI format
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: (msg.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.content
      }))
    ];

    const response = await withRetry(() => callChatAPI(model, messages, {
      max_tokens: 4096
    }));

    return response || "AI 暂时无法回应";
  } catch (error) {
    console.error("API Error (chatWithChapter):", error);
    throw error;
  }
};

/**
 * Smart text editing based on selected text and user instruction
 * Returns the edited version of the selected text
 */
export const editSelectedText = async (
  selectedText: string,
  instruction: string,
  fullChapterContent: string,
  settings: NovelSettings,
  model: AvailableModel
): Promise<string> => {
  try {
    const systemPrompt = `你是一位专业的网文编辑。用户选中了章节中的一段文本，并提出了修改要求。

小说信息：
- 书名：${settings.title}
- 风格：${settings.style}
- 文风要求：${settings.authorNote}

=== 章节上下文（供参考） ===
${fullChapterContent.length > 8000 ? fullChapterContent.substring(0, 8000) + '...(内容过长已截断)' : fullChapterContent}
===================================================

任务要求：
1. 根据用户的指令修改选中的文本
2. 保持与章节整体风格的一致性
3. 确保修改后的文本与前后文衔接自然
4. 只输出修改后的文本，不要添加任何解释或前缀
5. 保持原文的核心意图和剧情逻辑

常见修改类型：
- 润色/优化：提升文字质量，增强表现力
- 扩写：增加细节描写，丰富内容
- 缩写：精简冗余，保留核心
- 改写：调整表达方式，改变叙述角度
- 修正：纠正逻辑问题或文字错误`;

    const userPrompt = `用户选中的文本：
"""
${selectedText}
"""

修改要求：${instruction}

请直接输出修改后的文本，不要有任何其他内容。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      max_tokens: 4096,
      temperature: 0.7
    }));

    return response.trim();
  } catch (error) {
    console.error("API Error (editSelectedText):", error);
    throw error;
  }
};

export const refineChapter = async (
  content: string,
  instruction: string,
  settings: NovelSettings,
  model: AvailableModel
): Promise<string> => {
  try {
    const systemPrompt = `你是一位顶级网文修改专家。请在保持原有"${settings.style || '网文'}"风格的前提下，根据用户的意见修改正文。

参考创作指南：
${settings.authorNote}`;

    const userPrompt = `修改要求：${instruction}

原正文：
${content}

请直接输出修改后的完整正文，严禁废话。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      max_tokens: 8192
    }));

    return response || content;
  } catch (error) {
    console.error("API Error (refineChapter):", error);
    throw error;
  }
};

// ============================================
// 剧情沙盘滚动压缩工具
// ============================================

/**
 * 滚动压缩策略：
 * - 始终保持最新5章为一章一条梗概
 * - 第6章开始，最老的章节逐步合并压缩
 * - 压缩粒度随时间递增：2章→3章→5章→10章→20章
 */
export async function compressPlotSandbox(
  chapters: Chapter[],
  model: AvailableModel
): Promise<string> {
  if (chapters.length === 0) return '';

  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);

  // 如果章节数 <= 5，直接返回所有章节梗概
  if (sortedChapters.length <= 5) {
    return sortedChapters.map(c => c.summary).join('\n\n');
  }

  // 最新5章保持原样
  const recent5 = sortedChapters.slice(-5);
  const olderChapters = sortedChapters.slice(0, -5);

  // 对历史章节进行滚动压缩
  const compressedOlder = await rollingSummaryCompression(olderChapters, model);

  // 组合结果
  const result = [
    '=== 历史剧情（压缩） ===',
    compressedOlder,
    '',
    '=== 最新5章 ===',
    recent5.map(c => c.summary).join('\n\n')
  ].join('\n\n');

  return result;
}

/**
 * 滚动压缩历史章节
 * 策略：越老的章节压缩粒度越大
 */
async function rollingSummaryCompression(
  chapters: Chapter[],
  model: AvailableModel
): Promise<string> {
  if (chapters.length === 0) return '';
  if (chapters.length === 1) return chapters[0].summary;

  // 定义压缩分组策略
  const compressionLevels = [
    { threshold: 0, groupSize: 2 },    // 最近的历史章节：每2章合并
    { threshold: 10, groupSize: 3 },   // 10章以前：每3章合并
    { threshold: 30, groupSize: 5 },   // 30章以前：每5章合并
    { threshold: 80, groupSize: 10 },  // 80章以前：每10章合并
    { threshold: 200, groupSize: 20 }, // 200章以前：每20章合并
  ];

  const totalOlderChapters = chapters.length;
  const groups: { range: string; summaries: string[] }[] = [];

  let currentIndex = 0;
  while (currentIndex < totalOlderChapters) {
    // 确定当前位置应该使用的压缩粒度
    const distanceFromEnd = totalOlderChapters - currentIndex;
    let groupSize = 2;

    for (const level of compressionLevels) {
      if (distanceFromEnd > level.threshold) {
        groupSize = level.groupSize;
      }
    }

    // 收集当前组的章节
    const groupEnd = Math.min(currentIndex + groupSize, totalOlderChapters);
    const groupChapters = chapters.slice(currentIndex, groupEnd);
    const rangeStart = groupChapters[0].number;
    const rangeEnd = groupChapters[groupChapters.length - 1].number;

    groups.push({
      range: rangeStart === rangeEnd ? `第${rangeStart}章` : `第${rangeStart}-${rangeEnd}章`,
      summaries: groupChapters.map(c => c.summary)
    });

    currentIndex = groupEnd;
  }

  // 对每个组进行AI压缩
  const compressedGroups: string[] = [];
  for (const group of groups) {
    if (group.summaries.length === 1) {
      // 单章不需要压缩
      compressedGroups.push(`${group.range}：${group.summaries[0]}`);
    } else {
      // 多章需要压缩
      const compressed = await compressChapterGroup(group.summaries, group.range, model);
      compressedGroups.push(`${group.range}：${compressed}`);
    }
  }

  return compressedGroups.join('\n\n');
}

/**
 * 使用AI压缩一组章节梗概（网络文学风格）
 */
async function compressChapterGroup(
  summaries: string[],
  rangeLabel: string,
  model: AvailableModel
): Promise<string> {
  const prompt = `你是一个专业的网络小说编辑。请将以下章节梗概压缩合并成一段简洁的剧情概述（150字以内）。

**严格要求：**
1. 只描述该章节范围内实际发生的具体事件
2. 使用陈述句，格式："XX做了YY，结果ZZ"
3. **禁止添加任何结尾渲染**，如：
   - ❌ "未知的危险等待着他们"
   - ❌ "充满未知的旅程"
   - ❌ "命运的转折点"
   - ❌ "新的挑战即将到来"
   - ❌ "他们的逃生之路充满未知危险"
4. 只记录：关键剧情转折、人物状态变化、重要事件结果
5. 如果章节结尾是悬念，直接描述悬念的具体内容，不要用"未知"等模糊词汇

**正确示例：**
✅ "林焚击败了张三，获得了火焰剑，随后前往天剑宗报名参加大比。"
❌ "林焚击败了张三，获得了火焰剑，未知的挑战在前方等待。"

**章节范围：** ${rangeLabel}

**原始梗概：**
${summaries.join('\n\n')}

**压缩后的剧情概述：**`;

  try {
    const response = await withRetry(() => callChatAPI(model, [
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
      max_tokens: 400
    }));
    return response.trim();
  } catch (error) {
    console.error('压缩章节梗概失败:', error);
    // 降级方案：简单拼接
    return summaries.join('；').substring(0, 150) + '...';
  }
}

// ============================================
// STEP 1: Info Sync (Extraction)
// ============================================
export const extractWorldUpdates = async (
  chapterContent: string,
  currentSettings: NovelSettings,
  model: AvailableModel
): Promise<{ updates: Partial<NovelSettings>, analysisRaw: any }> => {
  try {
    const systemPrompt = `Role: You are the "Database Manager" for a web novel.
Goal: Analyze the APPROVED CHAPTER CONTENT and extract new data to update the novel's wiki/database.

=== EXISTING DATABASE ===
[Current Plot Status]: ${currentSettings.currentPlotProgress}
[Character Roster]: ${JSON.stringify((currentSettings.characters || []).map(c => c.name))}
[Faction Roster]: ${JSON.stringify((currentSettings.factions || []).map(f => f.name))}
[Current Power Level/System]: ${currentSettings.levelingSystem}
[Current World/Locations]: ${currentSettings.background}

=== TASK ===
Analyze the content and return a VALID JSON object with these exact keys. If a field has no updates, return null or empty string/array.

1. **chapterSummary** (string): "第X章：直接描述本章发生的具体事件，使用陈述句，不要添加'Hook/Cliffhanger'等标签"

2. **newCharacters** (array): New characters introduced. Each object should include:
   **重要：只提取有持续影响的重要角色，不要提取一次性路人角色**
   - 提取标准：
     * 有名字且在剧情中有重要作用的角色
     * 可能在后续章节再次出现的角色
     * 与主角或主要角色有重要关系的角色
   - 不要提取：
     * 无名路人（如：店小二、路人甲、守卫等）
     * 一次性出场的功能性角色（如：只是问路的路人、只是卖东西的商贩）
     * 只是用来推动剧情但没有后续价值的角色

   Each object should include:
   - name (string): 角色名
   - role (string): 角色定位(如：主角、配角、反派等)
   - description (string): 角色描述
   - relationToProtagonist (string): 与主角的关系
   - gender (string, optional): 性别
   - age (string, optional): 年龄
   - personality (string, optional): 性格特征
   - currentStatus (string, optional): 当前状态(健康、受伤等)
   - faction (string, optional): 所属势力
   - cultivationLevel (string, optional): 境界等级
   - relations (array, optional): 人物关系网，每个关系包含:
     * characterName: 关联角色名
     * relationType: 关系类型(如：妻子、仇人、师父等)
     * attitude: 态度(如：深爱、仇恨、尊敬等)
     * background: 关系渊源/背景故事
   - items (array, optional): 道具/灵宠列表，每个道具包含:
     * name: 道具/灵宠名称
     * description: 能力描述
   - skills (array, optional): 技能列表，每个技能包含:
     * name: 技能名称
     * description: 技能详细能力描述

3. **updatedExistingCharacters** (array): Significant status changes to existing characters. Each object should include:
   - name (string): 角色名(必须是已存在的角色)
   - currentStatus (string, optional): 更新后的状态
   - cultivationLevel (string, optional): 更新后的境界
   - faction (string, optional): 更新后的势力(如果角色换势力)
   - description (string, optional): 更新后的描述
   - relations (array, optional): 新增或更新的人物关系
     * 如果关系已存在(相同characterName)，则更新关系内容(如：好友→仇人)
     * 如果关系不存在，则追加新关系
     * **重要：如果关系类型或态度发生变化，必须在background字段中说明变化原因**
     * 例如：原本是好友，现在变成仇人，background应该写："因XX事件反目成仇"
   - items (array, optional): 新增或更新的道具/灵宠
     * 如果道具已存在(相同name)，则更新道具描述(如：道具升级、进化)
     * 如果道具不存在，则追加新道具
   - skills (array, optional): 新增或更新的技能
     * 如果技能已存在(相同name)，则更新技能描述(如：技能升级、突破)
     * 如果技能不存在，则追加新技能
   (只包含有变化的字段)

4. **newFactions** (array): New factions/organizations introduced. Each object should include:
   - name (string): 势力名称
   - description (string): 势力描述
   - territory (string): 所属地域
   - members (array): 势力成员名称列表

5. **updatedExistingFactions** (array): Changes to existing factions. Each object should include:
   - name (string): 势力名称(必须是已存在的势力)
   - description (string, optional): 更新后的描述(如：被灭门、势力衰落等)
   - territory (string, optional): 更新后的地域
   - members (array, optional): 更新后的成员列表
   (只包含有变化的字段)

6. **newLocations** (array): New locations discovered. Each object should include:
   - name (string): 地点名称
   - description (string): 地点描述(地理特征、环境、氛围等)
   - factions (array): 拥有或归属的势力名称列表(如果该地点被某个势力控制)

7. **updatedExistingLocations** (array): Changes to existing locations. Each object should include:
   - name (string): 地点名称(必须是已存在的地点)
   - description (string, optional): 更新后的描述
   - factions (array, optional): 更新后的势力列表
   (只包含有变化的字段)

8. **protagonistStateUpdate** (string | null): SPECIFICALLY track the protagonist's status: Level up? New Item? New Skill? Injury? If nothing changed, return null.

Ensure the output is strictly valid JSON.`;

    const safeContent = chapterContent.length > 50000 ? chapterContent.slice(0, 50000) + "...(truncated)" : chapterContent;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `=== CHAPTER CONTENT ===\n${safeContent}` }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 8192
    }));

    const delta = parseAIResponse(response);

    if (!delta || Object.keys(delta).length === 0) {
      console.warn("extractWorldUpdates failed to parse.", response);
      throw new Error("AI analysis returned empty or invalid data (Parse Failure)");
    }

    // --- MANUAL MERGE LOGIC ---
    const finalUpdates: Partial<NovelSettings> = {};

    // 1. Plot Progress: Append (Summary + Hook)
    if (delta.chapterSummary) {
      finalUpdates.currentPlotProgress =
        (currentSettings.currentPlotProgress || "") + `\n\n${delta.chapterSummary}`;
    }

    // 2. Characters: Merge New and Updates
    let finalCharacters = [...(currentSettings.characters || [])];

    // Process Updates to Existing
    if (delta.updatedExistingCharacters && Array.isArray(delta.updatedExistingCharacters)) {
      delta.updatedExistingCharacters.forEach((updatedChar: Character) => {
        const index = finalCharacters.findIndex(c => c.name === updatedChar.name);
        if (index !== -1) {
          const existingChar = finalCharacters[index];

          // 对于数组字段（relations, items, skills），采用智能合并策略：
          // - 如果已存在同名项，则更新（覆盖）
          // - 如果不存在，则追加
          const mergedChar = { ...existingChar, ...updatedChar };

          // 智能合并 relations（更新已有关系，追加新关系）
          if (updatedChar.relations && Array.isArray(updatedChar.relations)) {
            const existingRelations = existingChar.relations || [];
            const mergedRelations = [...existingRelations];

            updatedChar.relations.forEach(newRel => {
              const existingIndex = mergedRelations.findIndex(
                existingRel => existingRel.characterName === newRel.characterName
              );
              if (existingIndex !== -1) {
                // 更新已有关系
                const existingRel = mergedRelations[existingIndex];

                // 如果关系类型或态度发生变化，将变化原因追加到 background
                const relationChanged =
                  (newRel.relationType && newRel.relationType !== existingRel.relationType) ||
                  (newRel.attitude && newRel.attitude !== existingRel.attitude);

                if (relationChanged && newRel.background) {
                  // 将新的背景信息追加到原有背景中
                  const updatedBackground = existingRel.background
                    ? `${existingRel.background}；${newRel.background}`
                    : newRel.background;

                  mergedRelations[existingIndex] = {
                    ...existingRel,
                    ...newRel,
                    background: updatedBackground
                  };
                } else {
                  // 没有变化或没有新背景信息，直接覆盖
                  mergedRelations[existingIndex] = { ...existingRel, ...newRel };
                }
              } else {
                // 追加新关系
                mergedRelations.push(newRel);
              }
            });

            mergedChar.relations = mergedRelations;
          }

          // 智能合并 items（更新已有道具，追加新道具）
          if (updatedChar.items && Array.isArray(updatedChar.items)) {
            const existingItems = existingChar.items || [];
            const mergedItems = [...existingItems];

            updatedChar.items.forEach(newItem => {
              const existingIndex = mergedItems.findIndex(
                existingItem => existingItem.name === newItem.name
              );
              if (existingIndex !== -1) {
                // 更新已有道具（如：道具升级）
                mergedItems[existingIndex] = { ...mergedItems[existingIndex], ...newItem };
              } else {
                // 追加新道具
                mergedItems.push(newItem);
              }
            });

            mergedChar.items = mergedItems;
          }

          // 智能合并 skills（更新已有技能，追加新技能）
          if (updatedChar.skills && Array.isArray(updatedChar.skills)) {
            const existingSkills = existingChar.skills || [];
            const mergedSkills = [...existingSkills];

            updatedChar.skills.forEach(newSkill => {
              const existingIndex = mergedSkills.findIndex(
                existingSkill => existingSkill.name === newSkill.name
              );
              if (existingIndex !== -1) {
                // 更新已有技能（如：技能升级）
                mergedSkills[existingIndex] = { ...mergedSkills[existingIndex], ...newSkill };
              } else {
                // 追加新技能
                mergedSkills.push(newSkill);
              }
            });

            mergedChar.skills = mergedSkills;
          }

          finalCharacters[index] = mergedChar;
        }
      });
    }

    // Process New Characters
    if (delta.newCharacters && Array.isArray(delta.newCharacters)) {
      const trulyNew = delta.newCharacters.filter((nc: Character) =>
        !finalCharacters.some(ec => ec.name === nc.name)
      );
      finalCharacters = [...finalCharacters, ...trulyNew];
    }

    finalUpdates.characters = finalCharacters;

    // 3. Factions: Merge New and Updates
    let finalFactions = [...(currentSettings.factions || [])];

    // Process Updates to Existing Factions
    if (delta.updatedExistingFactions && Array.isArray(delta.updatedExistingFactions)) {
      delta.updatedExistingFactions.forEach((updatedFaction: Faction) => {
        const index = finalFactions.findIndex(f => f.name === updatedFaction.name);
        if (index !== -1) {
          finalFactions[index] = { ...finalFactions[index], ...updatedFaction };
        }
      });
    }

    // Process New Factions
    if (delta.newFactions && Array.isArray(delta.newFactions)) {
      const trulyNew = delta.newFactions.filter((nf: Faction) =>
        !finalFactions.some(ef => ef.name === nf.name)
      );
      finalFactions = [...finalFactions, ...trulyNew];
    }

    finalUpdates.factions = finalFactions;

    // 4. Locations: Merge New and Updates
    let finalLocations = [...(currentSettings.locations || [])];

    // Process Updates to Existing Locations
    if (delta.updatedExistingLocations && Array.isArray(delta.updatedExistingLocations)) {
      delta.updatedExistingLocations.forEach((updatedLocation: Location) => {
        const index = finalLocations.findIndex(l => l.name === updatedLocation.name);
        if (index !== -1) {
          finalLocations[index] = { ...finalLocations[index], ...updatedLocation };
        }
      });
    }

    // Process New Locations
    if (delta.newLocations && Array.isArray(delta.newLocations)) {
      const trulyNew = delta.newLocations.filter((nl: Location) =>
        !finalLocations.some(el => el.name === nl.name)
      );
      finalLocations = [...finalLocations, ...trulyNew];
    }

    finalUpdates.locations = finalLocations;

    // 5. Protagonist State: 追加到剧情沙盘
    if (delta.protagonistStateUpdate) {
      // 追加到剧情沙盘而不是升级体系
      finalUpdates.currentPlotProgress =
        (finalUpdates.currentPlotProgress || currentSettings.currentPlotProgress || "") +
        `\n\n[主角状态]: ${delta.protagonistStateUpdate}`;
    }

    return {
      updates: finalUpdates,
      analysisRaw: delta
    };

  } catch (error) {
    console.error("API Error (extractWorldUpdates):", error);
    throw error;
  }
};

/**
 * Kept for backward compatibility
 */
export const analyzeAndSync = extractWorldUpdates;
export const checkConsistency = extractWorldUpdates;

export const syncPlotBatch = async (
  chaptersContent: string,
  currentSettings: NovelSettings,
  model: AvailableModel
): Promise<Partial<NovelSettings>> => {
  try {
    const systemPrompt = `Role: You are the Continuity Director for a web novel.
Task: The user has uploaded a BATCH of missing chapters (from X to Y). You must analyze them to update the database.

=== EXISTING DATABASE ===
[Current Plot Progress]: ${currentSettings.currentPlotProgress}
[Character Roster]: ${JSON.stringify((currentSettings.characters || []).map(c => c.name))}

=== REQUIREMENTS ===
Analyze the BATCH CONTENT and return a VALID JSON object with:

1. **plotSummaryBatch** (string): Sequential summary of these chapters. Format each: "第X章：[Summary] —— 钩子：[Hook]". Join with newlines.
2. **newCharacters** (array): New characters not in roster. Objects with details.
3. **updatedExistingCharacters** (array): Updates to existing characters.
4. **worldUpdate** (string | null): New locations/history.
5. **levelingSystemUpdate** (string | null): New power tiers/items.

Ensure output is valid JSON.`;

    const safeContent = chaptersContent.length > 50000 ? chaptersContent.slice(0, 50000) + "...(truncated)" : chaptersContent;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `=== BATCH CHAPTER CONTENT ===\n${safeContent}` }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 8192
    }));

    const delta = parseAIResponse(response);

    if (!delta || Object.keys(delta).length === 0) {
      console.warn("Raw AI response for syncPlotBatch was empty or invalid:", response);
      throw new Error("Batch sync failed: Invalid JSON");
    }

    const finalUpdates: Partial<NovelSettings> = {};

    // 1. Append Plot
    if (delta.plotSummaryBatch) {
      finalUpdates.currentPlotProgress =
        (currentSettings.currentPlotProgress || "") + `\n\n${delta.plotSummaryBatch}`;
    }

    // 2. Characters: Merge New and Updates
    let finalCharacters = [...(currentSettings.characters || [])];

    // Update Existing
    if (delta.updatedExistingCharacters && Array.isArray(delta.updatedExistingCharacters)) {
      delta.updatedExistingCharacters.forEach((updatedChar: Character) => {
        const index = finalCharacters.findIndex(c => c.name === updatedChar.name);
        if (index !== -1) {
          finalCharacters[index] = { ...finalCharacters[index], ...updatedChar };
        }
      });
    }

    // Add New
    if (delta.newCharacters && Array.isArray(delta.newCharacters)) {
      const existingNames = finalCharacters.map(c => c.name);
      const trulyNew = delta.newCharacters.filter((nc: Character) =>
        !existingNames.includes(nc.name)
      );
      finalCharacters = [...finalCharacters, ...trulyNew];
    }
    finalUpdates.characters = finalCharacters;

    // 3. World & System
    if (delta.worldUpdate) {
      finalUpdates.background = (currentSettings.background || "") + "\n\n" + delta.worldUpdate;
    }

    if (delta.levelingSystemUpdate) {
      finalUpdates.levelingSystem = (currentSettings.levelingSystem || "") + "\n\n" + delta.levelingSystemUpdate;
    }

    return finalUpdates;

  } catch (error) {
    console.error("API Error (syncPlotBatch):", error);
    throw error;
  }
};

// ============================================
// Chapter Review System (Editor Perspective)
// ============================================

/**
 * Specific edit suggestion with location and replacement text
 */
export interface EditSuggestion {
  id: string; // 唯一标识
  category: '节奏' | '对话' | '描写' | '逻辑' | '文笔' | '其他'; // 问题类型
  severity: 'critical' | 'major' | 'minor'; // 严重程度
  originalText: string; // 原文片段（用于定位）
  issue: string; // 问题描述
  suggestion: string; // 修改建议
  replacementText?: string; // 建议的替换文本（可选）
}

/**
 * Comprehensive chapter review from editor's perspective
 * Analyzes chapter quality across multiple dimensions
 */
export interface ChapterReview {
  overallScore: number; // 0-100
  dimensions: {
    plotCoherence: { score: number; feedback: string }; // 剧情连贯性
    characterConsistency: { score: number; feedback: string }; // 人物一致性
    pacing: { score: number; feedback: string }; // 节奏把控
    writingQuality: { score: number; feedback: string }; // 文笔质量
    emotionalImpact: { score: number; feedback: string }; // 情感张力
    worldConsistency: { score: number; feedback: string }; // 世界观一致性
  };
  strengths: string[]; // 优点列表
  weaknesses: string[]; // 问题列表
  suggestions: string[]; // 改进建议（已废弃，使用editSuggestions）
  criticalIssues: string[]; // 严重问题（如逻辑漏洞、人物OOC等）
  editSuggestions: EditSuggestion[]; // 具体的编辑建议列表
}

export const reviewChapter = async (
  chapterTitle: string,
  chapterContent: string,
  settings: NovelSettings,
  previousChapters: Chapter[],
  model: AvailableModel
): Promise<ChapterReview> => {
  try {
    // 获取上一章完整内容作为上下文
    const lastChapter = previousChapters.length > 0 ? previousChapters[previousChapters.length - 1] : null;
    const lastChapterContext = lastChapter
      ? `\n\n=== 上一章内容（完整） ===\n标题：${lastChapter.title}\n${lastChapter.content}`
      : '';

    // 简单的RAG检索：基于章节内容提取相关档案
    const relevantCharacters: Character[] = [];
    const relevantFactions: Faction[] = [];
    const relevantLocations: Location[] = [];

    // 检索相关角色
    if (settings.characters && settings.characters.length > 0) {
      settings.characters.forEach(char => {
        // 如果章节内容中提到了角色名字，则认为相关
        if (chapterContent.includes(char.name)) {
          relevantCharacters.push(char);
        }
      });
    }

    // 检索相关势力
    if (settings.factions && settings.factions.length > 0) {
      settings.factions.forEach(faction => {
        if (chapterContent.includes(faction.name)) {
          relevantFactions.push(faction);
        }
      });
    }

    // 检索相关地点
    if (settings.locations && settings.locations.length > 0) {
      settings.locations.forEach(location => {
        if (chapterContent.includes(location.name)) {
          relevantLocations.push(location);
        }
      });
    }

    // 构建档案信息
    const characterInfo = relevantCharacters.length > 0
      ? relevantCharacters.map(c => `【${c.name}】（${c.role}）\n${c.description}`).join('\n\n')
      : '本章未检索到相关角色档案';

    const factionInfo = relevantFactions.length > 0
      ? relevantFactions.map(f => `【${f.name}】\n${f.description}`).join('\n\n')
      : '本章未检索到相关势力档案';

    const locationInfo = relevantLocations.length > 0
      ? relevantLocations.map(l => `【${l.name}】\n${l.description}`).join('\n\n')
      : '本章未检索到相关地点档案';

    const systemPrompt = `你是一位资深的网络小说主编，拥有丰富的审稿经验。你的任务是对章节进行全面、专业的审稿分析。

## 小说基础信息
- 书名：${settings.title}
- 风格：${settings.style}
- 核心设定/金手指：${settings.goldFinger || '无'}
- 世界观背景：${settings.background || '无'}
- 升级/战力体系：${settings.levelingSystem || '无'}
- 世界规律法则：${settings.worldRules || '无'}
- 文风要求：${settings.authorNote || '无'}

## 相关档案信息（基于RAG检索）

### 角色档案
${characterInfo}

### 势力档案
${factionInfo}

### 地点档案
${locationInfo}

## 剧情沙盘（完整）
${settings.currentPlotProgress || '刚开始'}
${lastChapterContext}

## 审稿维度说明

请从以下6个维度对章节进行评分（0-100分）和分析：

**评分标准（严格执行）：**
- 95-100分：卓越水平，几乎完美，可作为范文
- 90-94分：优秀水平，仅有极小瑕疵
- 85-89分：良好水平，有明显优点但存在可改进空间
- 80-84分：中上水平，基本达标但有较多改进空间
- 75-79分：中等水平，勉强及格，需要较大改进
- 70-74分：中下水平，存在明显问题
- 65-69分：较差水平，问题较多
- 60-64分：差，严重问题
- 60分以下：极差，需要重写

**评分原则：**
- 采用严格的专业编辑标准，不轻易给高分
- 80分以上需要有明确的优秀表现
- 90分以上需要接近完美，极少瑕疵
- 发现任何明显问题都应扣分
- 综合评分应略低于各维度平均分（体现严格性）

1. **剧情连贯性 (plotCoherence)** - 权重：20%
   - 与上一章的衔接是否自然（5分）
   - 剧情推进是否合理（5分）
   - 是否有突兀或跳跃的情节（5分）
   - 伏笔和铺垫是否到位（5分）

   **扣分项：**
   - 剧情跳跃、缺乏过渡：-10分
   - 与前文矛盾：-15分
   - 逻辑不通：-10分
   - 伏笔处理不当：-5分

2. **人物一致性 (characterConsistency)** - 权重：20%
   - 角色行为是否符合人设（5分）
   - 对话是否符合角色性格（5分）
   - 是否出现OOC（Out of Character）（5分）
   - 角色关系处理是否合理（5分）

   **扣分项：**
   - 严重OOC：-20分
   - 对话千篇一律：-10分
   - 人物关系混乱：-10分
   - 角色动机不明：-8分

3. **节奏把控 (pacing)** - 权重：15%
   - 叙事节奏是否合适（5分）
   - 详略是否得当（5分）
   - 是否有拖沓或过于仓促的部分（5分）
   - 高潮和低谷的安排（5分）

   **扣分项：**
   - 节奏拖沓：-10分
   - 节奏过快：-8分
   - 重点不突出：-8分
   - 缺乏起伏：-10分

4. **文笔质量 (writingQuality)** - 权重：20%
   - 语言表达是否流畅（5分）
   - 描写是否生动（5分）
   - 是否有语病或表达不清的地方（5分）
   - 是否符合文风要求（5分）

   **扣分项：**
   - 语句不通顺：-10分
   - 描写平淡：-8分
   - 语病较多：-12分
   - 用词不当：-5分

5. **情感张力 (emotionalImpact)** - 权重：15%
   - 情感渲染是否到位（5分）
   - 冲突是否有张力（5分）
   - 是否能引起读者共鸣（5分）
   - 爽点是否足够（5分）

   **扣分项：**
   - 情感平淡：-10分
   - 冲突乏力：-10分
   - 缺乏共鸣点：-8分
   - 爽点不足：-8分

6. **世界观一致性 (worldConsistency)** - 权重：10%
   - 是否符合已设定的世界观（5分）
   - 力量体系是否合理（5分）
   - 是否有设定矛盾（5分）
   - 细节是否经得起推敲（5分）

   **扣分项：**
   - 与设定矛盾：-15分
   - 力量体系混乱：-12分
   - 细节经不起推敲：-8分
   - 世界观崩坏：-20分

## 输出要求

请以JSON格式输出审稿结果，包含以下字段：

\`\`\`json
{
  "overallScore": 78,
  "dimensions": {
    "plotCoherence": {
      "score": 82,
      "feedback": "剧情衔接基本自然，但第3段与上一章的过渡略显生硬，建议增加铺垫..."
    },
    "characterConsistency": {
      "score": 75,
      "feedback": "主角的反应与人设有轻微偏差，在面对危机时表现过于冷静，不符合其冲动的性格设定..."
    },
    "pacing": {
      "score": 80,
      "feedback": "整体节奏把控尚可，但中段描写略显拖沓，建议精简..."
    },
    "writingQuality": {
      "score": 85,
      "feedback": "文笔流畅，描写较为生动，但部分对话略显生硬..."
    },
    "emotionalImpact": {
      "score": 76,
      "feedback": "情感渲染有一定力度，但高潮部分张力不足，建议强化冲突..."
    },
    "worldConsistency": {
      "score": 88,
      "feedback": "基本符合世界观设定，力量体系运用合理，细节考究..."
    }
  },
  "strengths": [
    "战斗场面描写较为精彩，动作流畅",
    "世界观细节把握到位",
    "文笔整体流畅"
  ],
  "weaknesses": [
    "主角性格表现与人设有偏差",
    "中段节奏拖沓，部分描写冗余",
    "情感高潮部分张力不足",
    "部分对话略显生硬"
  ],
  "suggestions": [
    "建议在第3段增加环境描写，增强氛围感",
    "主角的情绪转变可以更细腻一些",
    "结尾的悬念可以再强化"
  ],
  "criticalIssues": [
    "第5段中提到的'灵石'数量与上一章矛盾（上章是100块，本章变成了200块）"
  ],
  "editSuggestions": [
    {
      "id": "edit_1",
      "category": "描写",
      "severity": "major",
      "originalText": "林焚走进房间，看到桌上有一本书。",
      "issue": "描写过于简单，缺乏画面感和细节",
      "suggestion": "增加环境描写和人物动作细节，营造氛围",
      "replacementText": "林焚推开吱呀作响的木门，一股陈旧的书卷气息扑面而来。昏暗的房间里，一缕斜阳透过窗棂洒在桌案上，照亮了那本泛黄的古籍。"
    },
    {
      "id": "edit_2",
      "category": "对话",
      "severity": "minor",
      "originalText": "\"你来了。\"苏倾城说。",
      "issue": "对话缺乏情感和人物性格体现",
      "suggestion": "根据角色性格和当前情境，丰富对话的情感层次",
      "replacementText": "\"你来了。\"苏倾城淡淡地说，语气中带着几分疏离，连眼神都没有抬起。"
    }
  ]
}
\`\`\`

注意事项：
- **严格评分**：采用专业编辑标准，不轻易给高分，80分以上需要有明确优秀表现，90分以上需要接近完美
- **综合评分计算**：综合评分 = 各维度加权平均分 - 5分（体现严格性），最低不低于60分
- **分值区间细化**：
  * 95-100：卓越（可作范文）
  * 90-94：优秀（极小瑕疵）
  * 85-89：良好（有改进空间）
  * 80-84：中上（较多改进空间）
  * 75-79：中等（需较大改进）
  * 70-74：中下（明显问题）
  * 65-69：较差（问题较多）
  * 60-64：差（严重问题）
  * <60：极差（需重写）
- feedback要具体，必须指出具体的问题位置和改进方向
- strengths和weaknesses要列举3-5条，必须具体
- suggestions要具体可操作，指出具体段落或情节
- criticalIssues只列举严重的逻辑漏洞、设定矛盾、人物OOC等问题，如果没有则返回空数组
- **editSuggestions（重要）**：提供5-10条具体的编辑建议，每条建议必须包含：
  * id: 唯一标识（如 "edit_1", "edit_2"）
  * category: 问题类型（节奏/对话/描写/逻辑/文笔/其他）
  * severity: 严重程度（critical/major/minor）
  * originalText: 原文片段（20-100字，用于定位，必须是章节中的原文）
  * issue: 问题描述（简洁明了）
  * suggestion: 修改建议（具体可操作）
  * replacementText: 建议的替换文本（可选，如果有具体的改写建议）
- 所有文本必须使用中文
- **JSON格式要求**：
  * 必须返回有效的JSON对象
  * 所有字符串值中的引号必须转义
  * 不要在JSON中使用换行符，如需换行使用\\n
  * 确保所有括号和引号正确闭合
  * 不要在最后一个元素后添加逗号`;

    const userPrompt = `请审稿以下章节：

## 章节标题
${chapterTitle}

## 章节内容
${chapterContent}

请进行全面的审稿分析，并返回严格符合JSON格式的结果。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.3
    }));

    let result = parseAIResponse(response);

    // If parsing failed, try to fix with AI
    if (!result && response) {
      console.log('JSON parsing failed, attempting AI fix...');
      result = await fixJSONWithAI(response, model);
    }

    if (!result) {
      throw new Error('Failed to parse review response even after AI fix attempt');
    }

    return result as ChapterReview;
  } catch (error) {
    console.error('Error reviewing chapter:', error);
    throw error;
  }
};

// ============================================
// Batch Optimization System
// ============================================

/**
 * Batch optimize chapter content
 * Applies multiple optimization strategies to improve overall quality
 */
export interface BatchOptimizationOptions {
  enhancePacing?: boolean; // 优化节奏
  enhanceDialogue?: boolean; // 优化对话
  enhanceDescription?: boolean; // 优化描写
  enhanceEmotion?: boolean; // 增强情感
  fixGrammar?: boolean; // 修正语病
  improveReadability?: boolean; // 提升可读性
}

export const batchOptimizeChapter = async (
  chapterContent: string,
  settings: NovelSettings,
  model: AvailableModel,
  options: BatchOptimizationOptions = {}
): Promise<string> => {
  try {
    // 默认启用所有优化
    const finalOptions = {
      enhancePacing: true,
      enhanceDialogue: true,
      enhanceDescription: true,
      enhanceEmotion: true,
      fixGrammar: true,
      improveReadability: true,
      ...options
    };

    const optimizationTasks: string[] = [];
    if (finalOptions.enhancePacing) optimizationTasks.push('优化叙事节奏，确保详略得当');
    if (finalOptions.enhanceDialogue) optimizationTasks.push('优化对话，使其更生动自然');
    if (finalOptions.enhanceDescription) optimizationTasks.push('增强描写的画面感和细节');
    if (finalOptions.enhanceEmotion) optimizationTasks.push('强化情感渲染和张力');
    if (finalOptions.fixGrammar) optimizationTasks.push('修正语病和表达不清的地方');
    if (finalOptions.improveReadability) optimizationTasks.push('提升整体可读性和流畅度');

    const systemPrompt = `你是一位资深的网文编辑，擅长对章节进行全面优化。

## 小说信息
- 书名：${settings.title}
- 风格：${settings.style}
- 文风要求：${settings.authorNote}

## 优化任务
请对以下章节内容进行批量优化，具体要求：

${optimizationTasks.map((task, idx) => `${idx + 1}. ${task}`).join('\n')}

## 优化原则
1. 保持原文的核心剧情和人物设定不变
2. 保持原文的字数规模（允许±10%的浮动）
3. 严格遵循文风要求
4. 优化要自然，不要过度修饰
5. 保持网文的爽点和节奏感
6. 确保前后文衔接自然

## 输出要求
直接输出优化后的完整章节内容，不要添加任何解释或前缀。`;

    const userPrompt = `请优化以下章节内容：

${chapterContent}

请直接输出优化后的完整内容。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      max_tokens: 8192,
      temperature: 0.7
    }));

    return response.trim();
  } catch (error) {
    console.error('Error in batch optimization:', error);
    throw error;
  }
};
