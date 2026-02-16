
export interface Character {
  name: string;
  role: string;
  description: string;
  relationToProtagonist: string;
}

export interface NovelSettings {
  title: string;
  style: string;
  tags: string[];
  goldFinger: string;
  synopsis: string;
  levelingSystem: string;
  background: string;
  authorNote: string;
  characters: Character[];
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
  SETTINGS = 'settings',
}

// Model IDs with their prefixes (e.g., [限时], [次]) must be preserved for correct API routing
export type AvailableModel =
  | '[次]claude-sonnet-4-5-thinking'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-opus-4-5-20251101'
  | '[次]gemini-3-pro-preview-thinking'
  | '[次]gemini-3-flash-preview'
  | '[次]grok-4.1-thinking'
  | '[限时]kimi-k2.5'
  | '[次]deepseek-v3.2';

// Image generation model
export type ImageModel = 'seedream-5.0';

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
  { id: '[次]gemini-3-flash-preview', label: '3.0 Flash', badge: '极速', category: 'Fast', provider: 'Gemini' },
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
  authorNote: '文风要求：\n1. 节奏紧凑，拒绝流水账。\n2. 多用动作描写体现人物心理（"动作叙事"）。\n3. 画面感强，一句话一段，适合移动端阅读。',
  characters: [],
  currentPlotProgress: '故事刚刚开始。',
  coverImage: '',
  coverVisualPrompt: '',
  novelType: 'long',
  targetTotalWords: undefined,
  targetChapterCount: undefined
};
