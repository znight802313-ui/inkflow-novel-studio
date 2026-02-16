
import { NovelSettings, Chapter, AvailableModel, Character } from "../types";

// API Configuration from environment variables
const API_BASE_URL = process.env.API_BASE_URL || 'https://once.novai.su/v1';
const API_KEY = process.env.API_KEY || '';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || '';
const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';

// Hardcoded fallback for Anthropic API (to bypass env variable issues)
const ANTHROPIC_CONFIG = {
  baseUrl: '/api/anthropic',
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
  plotPoints?: string[];  // Plot points that should occur in this chapter
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
 * Helper to clean AI response text which often contains markdown formatting
 */
const parseAIResponse = (text: string | undefined) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    // Attempt to extract from Markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e2) {
        // Continue to fallback
      }
    }

    // Fallback: Find the first '{' and last '}'
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      try {
        return JSON.parse(text.substring(firstOpen, lastClose + 1));
      } catch (e3) {
        console.error("Fallback JSON Parse also failed", e3);
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

export const generateWorldBuilding = async (idea: string, model: AvailableModel, novelType?: 'long' | 'short', targetWords?: number, targetChapters?: number): Promise<Partial<NovelSettings>> => {
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

    const systemPrompt = `你是一位专业的网络小说世界观设计师。请根据用户提供的创意核心，生成完整的小说基本设定。${typeGuidance}

请以 JSON 格式返回，包含以下字段：
- title: 小说标题
- style: 小说风格/类型
- tags: 标签数组
- goldFinger: 主角金手指/特殊能力
- synopsis: 故事简介
- levelingSystem: 等级/修炼体系
- background: 世界观背景
- currentPlotProgress: 当前剧情进度
- coverVisualPrompt: 英文封面图片生成提示词（描述画面主体、氛围、光影、构图，不要包含文字）
- characters: 角色数组，每个角色包含 name, role, description, relationToProtagonist`;

    const userPrompt = `基于创意核心 "${idea}"，为一部网络小说生成完整的基本设定。要求内容详尽、富有新意、符合网文逻辑。`;

    const response = await withRetry(() => callChatAPI(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      response_format: { type: 'json_object' },
      max_tokens: 4096
    }));

    const result = parseAIResponse(response);
    if (!result) throw new Error("Generated world building data is invalid.");
    return result;
  } catch (error) {
    console.error("API Error (generateWorldBuilding):", error);
    throw error;
  }
};

export const generateCoverImage = async (settings: NovelSettings): Promise<string> => {
  try {
    // Use seedream-5.0 for image generation with the same API configuration
    const { baseUrl, apiKey } = getApiConfig('[次]gemini-3-flash-preview' as AvailableModel);

    // Build prompt from settings
    let prompt = settings.coverVisualPrompt || '';

    // If no custom prompt, generate one from settings
    if (!prompt) {
      const elements = [
        settings.title ? `Book title: "${settings.title}"` : '',
        settings.style ? `Genre: ${settings.style}` : '',
        settings.synopsis ? `Story: ${settings.synopsis.substring(0, 200)}` : '',
      ].filter(Boolean).join(', ');

      prompt = `Create a stunning book cover for a novel. ${elements}. Professional, eye-catching design with dramatic lighting and composition.`;
    }

    console.log('[DEBUG] Generating cover with seedream-5.0, prompt:', prompt);

    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'seedream-5.0',
        prompt: prompt,
        n: 1,
        size: '768x1024',  // 3:4 aspect ratio (width:height)
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ERROR] Image generation failed:', errorText);
      throw new Error(`Image generation failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      throw new Error('Invalid response format from image generation API');
    }

    // Return base64 image with data URI prefix
    return `data:image/png;base64,${data.data[0].b64_json}`;
  } catch (error) {
    console.error("API Error (generateCoverImage):", error);
    throw error;
  }
};

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

    // Build character context
    let characterContext = '';
    if (creationOptions.featuredCharacters && creationOptions.featuredCharacters.length > 0) {
      const featuredChars = settings.characters?.filter(c =>
        creationOptions.featuredCharacters!.includes(c.name)
      ) || [];
      if (featuredChars.length > 0) {
        characterContext = `\n\n=== 本章重点出场角色 ===\n${featuredChars.map(c =>
          `- ${c.name}（${c.role}）：${c.description}，与主角关系：${c.relationToProtagonist}`
        ).join('\n')}`;
      }
    }

    // Build new characters context
    let newCharContext = '';
    if (creationOptions.newCharacters && creationOptions.newCharacters.length > 0) {
      newCharContext = `\n\n=== 本章新增角色（请在剧情中自然引入） ===\n${creationOptions.newCharacters.map(c =>
        `- ${c.name}${c.description ? `：${c.description}` : ''}`
      ).join('\n')}`;
    }

    // Build plot points context
    let plotPointsContext = '';
    if (creationOptions.plotPoints && creationOptions.plotPoints.length > 0) {
      plotPointsContext = `\n\n=== 本章剧情要点（请在正文中体现以下情节） ===\n${creationOptions.plotPoints.map((p, i) =>
        `${i + 1}. ${p}`
      ).join('\n')}`;
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
4. **字数要求：** 本章目标字数为 ${adjustedWordCount} 字左右，请确保内容充实饱满。${shortNovelGuidance}`;

    const contextPrompt = `=== 作品档案 ===
书名：${settings.title}
风格：${settings.style}
核心设定/金手指：${settings.goldFinger}
简介：${settings.synopsis}
世界观背景：${settings.background}
当前剧情综述：${settings.currentPlotProgress}
${characterContext}${newCharContext}${plotPointsContext}

=== 历史章节摘要（最近3章） ===
${previousChapters.slice(-3).map(c => `第${c.number}章 ${c.title}: ${c.summary}`).join('\n')}

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
5. 确保正文字数务必达到 ${adjustedWordCount} 字左右${isLastChapter ? '，并完成所有剧情收尾' : '（除非剧情自然结束）'}。`;

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
 * Multi-turn Chat for Editing/Refining
 */
export const chatWithChapter = async (
  history: { role: 'user' | 'model', content: string }[],
  currentChapterContent: string,
  settings: NovelSettings,
  model: AvailableModel
): Promise<string> => {
  try {
    const systemPrompt = `Role: You are an expert Web Novel Editor and Co-author.
Your Task: Help the user refine, rewrite, or brainstorm the CURRENT CHAPTER.

Context:
- Novel Title: ${settings.title}
- Style: ${settings.style}
- Author's Note: ${settings.authorNote}

=== CURRENT CHAPTER CONTENT (Read-Only Context) ===
${currentChapterContent}
===================================================

Guidelines:
1. Provide constructive feedback or direct rewrites as requested.
2. If the user asks for a rewrite, provide the full text of the revised section clearly.
3. Maintain the novel's tone (e.g., fast-paced, action-oriented).`;

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

// STEP 1: Info Sync (Extraction)
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
[Current Power Level/System]: ${currentSettings.levelingSystem}
[Current World/Locations]: ${currentSettings.background}

=== TASK ===
Analyze the content and return a VALID JSON object with these exact keys. If a field has no updates, return null or empty string.

1. **chapterSummary** (string): "[第X章：Title] Summary of events. Hook/Cliffhanger: ..."
2. **newCharacters** (array): New characters introduced. Objects with: name, role, description, relationToProtagonist.
3. **updatedExistingCharacters** (array): Significant status changes to existing characters (e.g. death, betrayal, power up).
4. **protagonistStateUpdate** (string | null): SPECIFICALLY track the protagonist's status: Level up? New Item? New Skill? Injury? If nothing changed, return null.
5. **worldLocationUpdate** (string | null): New locations discovered or changes to world rules/factions.

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
          finalCharacters[index] = { ...finalCharacters[index], ...updatedChar };
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

    // 3. World & System: Intelligent Merge
    if (delta.worldLocationUpdate) {
      finalUpdates.background = (currentSettings.background || "") + "\n\n[新地点/势力记录]: " + delta.worldLocationUpdate;
    }

    if (delta.protagonistStateUpdate) {
      finalUpdates.levelingSystem = (currentSettings.levelingSystem || "") + "\n\n[主角状态更新]: " + delta.protagonistStateUpdate;
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
