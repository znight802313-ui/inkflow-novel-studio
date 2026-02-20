
// 人物关系网中的单个关系
export interface CharacterRelation {
  characterName: string;      // 关联角色名
  relationType: string;       // 关系类型（如：妻子、仇人、师父等）
  attitude: string;           // 态度（如：深爱、仇恨、尊敬等）
  background: string;         // 关系渊源/背景故事
  latestInteraction?: string; // 最新互动（可选，记录最近一次交互的情况）
  relationStatus?: string;    // 关系状态（可选，如：紧张、和睦、冷战、升温等）
}

// 道具/灵宠
export interface CharacterItem {
  name: string;               // 道具/灵宠名称
  description: string;        // 能力描述
}

// 技能
export interface CharacterSkill {
  name: string;               // 技能名称
  description: string;        // 技能详细能力描述
}

// 势力
export interface Faction {
  name: string;               // 势力名称
  description: string;        // 势力描述
  territory: string;          // 所属地域
  members: string[];          // 势力人物列表（角色名称数组）
}

// 地点档案
export interface Location {
  name: string;               // 地点名称
  description: string;        // 地点描述
  factions: string[];         // 拥有或归属的势力列表（势力名称数组）
}

export interface Character {
  name: string;
  role: string;
  description: string;
  relationToProtagonist: string;
  avatar?: string;              // 角色头像（Base64 或 URL）

  // 基础属性标签
  gender?: string;              // 性别
  age?: string;                 // 年龄
  personality?: string;         // 性格特征

  // 状态信息
  currentStatus?: string;       // 当前状态（健康、受伤、昏迷、中毒等）
  currentLocation?: string;     // 当前所在地（地点名称，未知则填"未知"）
  faction?: string;             // 所属势力
  cultivationLevel?: string;    // 当前境界等级（选填，修仙/玄幻类小说用）

  // 关系与能力
  relations?: CharacterRelation[];  // 人物关系网（可选）
  items?: CharacterItem[];          // 道具/灵宠列表（可选）
  skills?: CharacterSkill[];        // 技能列表（可选）
}

export interface NovelSettings {
  title: string;
  style: string;
  tags: string[];
  goldFinger: string;
  synopsis: string;
  levelingSystem: string;
  background: string;
  worldRules?: string;        // 世界规律法则（出行方式、金钱体系、社会制度等）
  authorNote: string;
  characters: Character[];
  factions: Faction[];          // 势力列表
  locations: Location[];        // 地点档案列表
  currentPlotProgress: string;
  coverImage?: string;       // Base64 string of the generated cover
  coverVisualPrompt?: string; // Prompt used to generate the cover

  // 小说类型配置
  novelType?: 'long' | 'short';  // 长篇或短篇
  targetTotalWords?: number;      // 目标总字数（短篇小说用）
  targetChapterCount?: number;    // 目标章节数（短篇小说用）
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  createdAt: number;
}

export interface WorkflowState {
  settings: NovelSettings;
  chapters: Chapter[];
  currentView: 'world' | 'writing' | 'reading' | 'settings';
}

export enum AppViews {
  WORLD = 'world',
  WRITING = 'writing',
  REVIEW = 'review',
  READING = 'reading',
}

// Model IDs with their prefixes (e.g., [限时], [次]) must be preserved for correct API routing
export type AvailableModel =
  | '[次]claude-sonnet-4-5-thinking'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-opus-4-5-20251101'
  | '[次]gemini-3-pro-preview-thinking'
  | '[次]gemini-3.1-pro-preview'
  | '[次]grok-4.1-thinking'
  | '[限时]kimi-k2.5'
  | '[次]deepseek-v3.2';

// Image generation model
export type ImageModel = 'jimeng-4.5';

// Model display configuration
export interface ModelConfig {
  id: AvailableModel;
  label: string;
  badge: string;
  category: string;
  provider: 'Claude' | 'Gemini' | 'Grok' | 'Kimi' | 'DeepSeek';
}

export const MODEL_OPTIONS: ModelConfig[] = [
  { id: '[次]claude-sonnet-4-5-thinking', label: 'Sonnet 4.5 Thinking', badge: '按次计费', category: 'Thinking', provider: 'Claude' },
  { id: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', badge: '最新版', category: 'Standard', provider: 'Claude' },
  { id: 'claude-opus-4-5-20251101', label: 'Opus 4.5', badge: '旗舰版', category: 'Premium', provider: 'Claude' },
  { id: '[次]gemini-3-pro-preview-thinking', label: '3.0 Pro Thinking', badge: '深度思考', category: 'Thinking', provider: 'Gemini' },
  { id: '[次]gemini-3.1-pro-preview', label: '3.1 Pro', badge: '最新版', category: 'Standard', provider: 'Gemini' },
  { id: '[次]grok-4.1-thinking', label: '4.1 Thinking', badge: '按次计费', category: 'Thinking', provider: 'Grok' },
  { id: '[限时]kimi-k2.5', label: 'K2.5', badge: '限时优惠', category: 'Standard', provider: 'Kimi' },
  { id: '[次]deepseek-v3.2', label: 'V3.2', badge: '按次计费', category: 'Standard', provider: 'DeepSeek' },
];

// Group models by provider
export const MODEL_GROUPS = {
  Claude: MODEL_OPTIONS.filter(m => m.provider === 'Claude'),
  Gemini: MODEL_OPTIONS.filter(m => m.provider === 'Gemini'),
  Grok: MODEL_OPTIONS.filter(m => m.provider === 'Grok'),
  Kimi: MODEL_OPTIONS.filter(m => m.provider === 'Kimi'),
  DeepSeek: MODEL_OPTIONS.filter(m => m.provider === 'DeepSeek'),
};

export const DEFAULT_NOVEL_SETTINGS: NovelSettings = {
  title: '',
  style: '',
  tags: [],
  goldFinger: '',
  synopsis: '',
  levelingSystem: '',
  background: '',
  worldRules: '',
  authorNote: '文风要求：\n1. 节奏紧凑，拒绝流水账。\n2. 多用动作描写体现人物心理（"动作叙事"）。\n3. 画面感强，一句话一段，适合移动端阅读。',
  characters: [],
  factions: [],
  locations: [],
  currentPlotProgress: '故事刚刚开始。',
  coverImage: '',
  coverVisualPrompt: '',
  novelType: 'long',
  targetTotalWords: undefined,
  targetChapterCount: undefined
};
