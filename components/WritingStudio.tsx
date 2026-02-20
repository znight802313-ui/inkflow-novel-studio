
import React, { useState, useEffect, useRef } from 'react';
import { NovelSettings, Chapter, AvailableModel } from '../types';
import { streamChapterDraft, chatWithChapter, ChapterCreationOptions, generateChapterPlan } from '../services/geminiService';

interface WritingStudioProps {
  settings: NovelSettings;
  chapters: Chapter[];
  onProceedToReview: (draft: { title: string; content: string }) => void;
  onUpdateSettings?: (settings: Partial<NovelSettings>) => void;
  setIsLoading: (loading: boolean) => void;
  model: AvailableModel;
}

// Track if AI is currently generating content
let isGenerating = false;

const DRAFT_STORAGE_KEY = 'inkflow_current_draft';
const CHAT_HISTORY_KEY = 'inkflow_chat_history';
const CHAPTER_CONFIG_KEY = 'inkflow_chapter_config';

type ChatMessage = {
  role: 'user' | 'model';
  content: string;
};

// 章节创作配置
interface ChapterConfig {
  wordCount: number | null;  // 目标字数，null 表示默认 2000+
  selectedCharacters: string[];  // 已选择的出场角色名
  newCharacters: { name: string; description: string }[];  // 新增角色
  plotPoints: { content: string; importance: 'major' | 'minor' }[];  // 剧情情节点（带重要度）
  synopsis: string;  // 章节梗概
  authorNote: string;  // 作者备注（本章特殊要求）
}

const DEFAULT_CHAPTER_CONFIG: ChapterConfig = {
  wordCount: null,
  selectedCharacters: [],
  newCharacters: [],
  plotPoints: [],
  synopsis: '',
  authorNote: ''
};

const WORD_COUNT_OPTIONS = [
  { value: null, label: '默认 (2000字)' },
  { value: 1500, label: '1500 字' },
  { value: 2000, label: '2000 字' },
  { value: 3000, label: '3000 字' },
  { value: 4000, label: '4000 字' },
  { value: 5000, label: '5000 字' },
  { value: 6000, label: '6000 字' },
  { value: -1, label: '自定义' },  // -1 表示自定义
];

const WritingStudio: React.FC<WritingStudioProps> = ({ 
  settings, 
  chapters, 
  onProceedToReview,
  setIsLoading,
  model
}) => {
  const [currentChapter, setCurrentChapter] = useState<{ title: string; content: string } | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Chapter Config State
  const [chapterConfig, setChapterConfig] = useState<ChapterConfig>(DEFAULT_CHAPTER_CONFIG);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<ChapterConfig | null>(null);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [newPlotPoint, setNewPlotPoint] = useState('');
  const [customWordCount, setCustomWordCount] = useState('');
  const [isCustomWordCount, setIsCustomWordCount] = useState(false);

  // UI State
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  // Load persistence
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    const savedChat = localStorage.getItem(CHAT_HISTORY_KEY);

    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.title || parsed.content) {
          setCurrentChapter(parsed);
        }
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }

    if (savedChat) {
      try {
        setChatHistory(JSON.parse(savedChat));
      } catch (e) {
        console.error("Failed to load chat", e);
      }
    }

    const savedConfig = localStorage.getItem(CHAPTER_CONFIG_KEY);
    if (savedConfig) {
      try {
        setChapterConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error("Failed to load chapter config", e);
      }
    }
  }, []);

  // Save persistence
  useEffect(() => {
    if (currentChapter) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(currentChapter));
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [currentChapter]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      localStorage.removeItem(CHAT_HISTORY_KEY);
    }
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem(CHAPTER_CONFIG_KEY, JSON.stringify(chapterConfig));
  }, [chapterConfig]);

  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      // 获取目标字数，如果用户已选择则使用，否则使用默认值3000
      const targetWordCount = chapterConfig.wordCount || 3000;

      // Call AI to generate chapter plan based on settings and chapters
      const plan = await generateChapterPlan(settings, chapters, model, chapterConfig.authorNote, targetWordCount);

      const generatedConfig: ChapterConfig = {
        wordCount: null, // 不生成字数，由用户手动选择
        selectedCharacters: plan.selectedCharacters,
        newCharacters: plan.newCharacters,
        plotPoints: plan.plotPoints,
        synopsis: plan.synopsis,
        authorNote: chapterConfig.authorNote // 保留用户输入的作者备注
      };

      setGeneratedPlan(generatedConfig);
      setShowPlanConfirm(true);
    } catch (e: any) {
      console.error('AI生成失败:', e);
      alert(`智能规划失败: ${e.message || '请检查网络连接或稍后重试'}`);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleConfirmPlan = () => {
    if (generatedPlan) {
      // 保留用户已选择的字数，只应用AI生成的其他配置
      setChapterConfig({
        ...generatedPlan,
        wordCount: chapterConfig.wordCount // 保留当前字数设置
      });
    }
    setShowPlanConfirm(false);
    setGeneratedPlan(null);
  };

  const handleDraftNext = async () => {
    if (currentChapter && currentChapter.content.length > 50) {
        if (!confirm("⚠️ 警告：当前编辑器内已有未归档的草稿。\n\n继续生成将覆盖当前内容（建议先备份或归档）。是否确定覆盖？")) {
            return;
        }
    }

    setIsLoading(true);
    isGenerating = true; // Mark as generating
    // Initialize empty draft to switch view immediately
    const initialDraft = { title: `第${chapters.length + 1}章`, content: '' };
    setCurrentChapter(initialDraft);
    setViewMode('edit');
    // Clear chat history for new draft
    setChatHistory([]);

    // Build creation options from config
    const creationOptions: ChapterCreationOptions = {
      synopsis: chapterConfig.synopsis || undefined,
      targetWordCount: chapterConfig.wordCount || undefined,
      featuredCharacters: chapterConfig.selectedCharacters.length > 0 ? chapterConfig.selectedCharacters : undefined,
      newCharacters: chapterConfig.newCharacters.length > 0 ? chapterConfig.newCharacters : undefined,
      plotPoints: chapterConfig.plotPoints.length > 0 ? chapterConfig.plotPoints : undefined,
    };

    try {
      await streamChapterDraft(
        settings,
        chapters,
        model,
        '', // No instruction needed
        creationOptions,
        (updatedData) => {
           setCurrentChapter(prev => ({
             title: updatedData.title || prev?.title || '',
             content: updatedData.content
           }));
        }
      );
    } catch (e) {
      console.error(e);
      alert('创作失败，请检查网络或设定。');
    } finally {
      setIsLoading(false);
      isGenerating = false; // Mark as finished
    }
  };

  const handleAbandonDraft = () => {
    setShowAbandonConfirm(true);
  };

  const confirmAbandon = () => {
    setCurrentChapter(null);
    setChatHistory([]); // Clear chat history
    setChapterConfig(DEFAULT_CHAPTER_CONFIG); // Reset chapter config
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(CHAPTER_CONFIG_KEY);
    setShowAbandonConfirm(false);
  };

  const handleRegenerate = async () => {
    if (isGenerating) return;

    // 确认是否重新生成
    if (!confirm('确定要重新生成吗？当前内容将被覆盖。')) {
      return;
    }

    // 使用当前的章节配置重新生成
    await handleStartCreation();
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentChapter) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatting(true);

    try {
      const responseText = await chatWithChapter(
        newHistory, 
        currentChapter.content, 
        settings, 
        model
      );
      setChatHistory(prev => [...prev, { role: 'model', content: responseText }]);
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { role: 'model', content: "⚠️ 智库连接失败，请重试。" }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleApplyContent = (content: string) => {
    if (confirm("确认使用 AI 生成的内容替换当前编辑器中的所有正文吗？")) {
       setCurrentChapter(prev => prev ? ({ ...prev, content: content }) : null);
    }
  };

  const handleHandover = () => {
    if (!currentChapter) return;
    onProceedToReview(currentChapter);
  };

  // 计算短篇小说进度
  const isShortNovel = settings.novelType === 'short';
  const targetChapterCount = settings.targetChapterCount;
  const currentChapterNum = chapters.length + 1;
  const isLastChapter = isShortNovel && targetChapterCount && currentChapterNum >= targetChapterCount;
  const progress = isShortNovel && targetChapterCount ? Math.round((currentChapterNum / targetChapterCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-bottom duration-500 relative">

      {/* AI Plan Confirmation Modal */}
      {showPlanConfirm && generatedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 max-w-3xl w-full shadow-2xl space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-4 text-purple-400">
              <div className="w-12 h-12 bg-purple-400/10 rounded-full flex items-center justify-center text-2xl">
                🤖
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-200">AI 智能规划结果</h3>
                <p className="text-xs text-purple-400/80">请确认或修改以下创作要素</p>
              </div>
            </div>

            {/* Synopsis */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span>📋</span> 章节梗概
              </label>
              <textarea
                value={generatedPlan.synopsis}
                onChange={(e) => setGeneratedPlan({ ...generatedPlan, synopsis: e.target.value })}
                className="w-full bg-slate-900/80 border border-amber-500/40 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/60 resize-none"
                rows={3}
                placeholder="简要描述本章的主要内容和发展方向..."
              />
            </div>

            {/* Featured Characters */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span>👥</span> 出场角色
              </label>
              <div className="flex flex-wrap gap-2">
                {settings.characters && settings.characters.length > 0 ? (
                  settings.characters.map(char => (
                    <button
                      key={char.name}
                      onClick={() => {
                        setGeneratedPlan({
                          ...generatedPlan,
                          selectedCharacters: generatedPlan.selectedCharacters.includes(char.name)
                            ? generatedPlan.selectedCharacters.filter(n => n !== char.name)
                            : [...generatedPlan.selectedCharacters, char.name]
                        });
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        generatedPlan.selectedCharacters.includes(char.name)
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {char.name}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">暂无已定义角色</p>
                )}
              </div>
            </div>

            {/* New Characters */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span>➕</span> 新增角色
              </label>
              <div className="space-y-2">
                {generatedPlan.newCharacters.map((char, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-950/50 p-2 rounded-lg border border-green-600/30">
                    <input
                      value={char.name}
                      onChange={(e) => {
                        const updated = [...generatedPlan.newCharacters];
                        updated[idx].name = e.target.value;
                        setGeneratedPlan({ ...generatedPlan, newCharacters: updated });
                      }}
                      className="flex-1 bg-slate-900/80 border border-amber-500/40 rounded px-2 py-1 text-sm text-slate-200"
                      placeholder="角色名"
                    />
                    <input
                      value={char.description}
                      onChange={(e) => {
                        const updated = [...generatedPlan.newCharacters];
                        updated[idx].description = e.target.value;
                        setGeneratedPlan({ ...generatedPlan, newCharacters: updated });
                      }}
                      className="flex-[2] bg-slate-900/80 border border-amber-500/40 rounded px-2 py-1 text-sm text-slate-200"
                      placeholder="描述"
                    />
                    <button
                      onClick={() => {
                        setGeneratedPlan({
                          ...generatedPlan,
                          newCharacters: generatedPlan.newCharacters.filter((_, i) => i !== idx)
                        });
                      }}
                      className="text-red-400 hover:text-red-300 px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setGeneratedPlan({
                      ...generatedPlan,
                      newCharacters: [...generatedPlan.newCharacters, { name: '', description: '' }]
                    });
                  }}
                  className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                >
                  <span>+</span> 添加新角色
                </button>
              </div>
            </div>

            {/* Plot Points with Importance */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span>🎯</span> 剧情节点
                <span className="text-[10px] text-slate-500">(标记重要度：重点详写 / 略写带过)</span>
              </label>
              <div className="space-y-2">
                {generatedPlan.plotPoints.map((point, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-950/50 p-2 rounded-lg border border-amber-600/30">
                    <input
                      value={point.content}
                      onChange={(e) => {
                        const updated = [...generatedPlan.plotPoints];
                        updated[idx].content = e.target.value;
                        setGeneratedPlan({ ...generatedPlan, plotPoints: updated });
                      }}
                      className="flex-1 bg-slate-900/80 border border-amber-500/40 rounded px-2 py-1 text-sm text-slate-200"
                      placeholder="剧情节点"
                    />
                    <select
                      value={point.importance}
                      onChange={(e) => {
                        const updated = [...generatedPlan.plotPoints];
                        updated[idx].importance = e.target.value as 'major' | 'minor';
                        setGeneratedPlan({ ...generatedPlan, plotPoints: updated });
                      }}
                      className="bg-slate-900/80 border border-amber-500/40 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                    >
                      <option value="major">🔥 重点</option>
                      <option value="minor">💨 略写</option>
                    </select>
                    <button
                      onClick={() => {
                        setGeneratedPlan({
                          ...generatedPlan,
                          plotPoints: generatedPlan.plotPoints.filter((_, i) => i !== idx)
                        });
                      }}
                      className="text-red-400 hover:text-red-300 px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setGeneratedPlan({
                      ...generatedPlan,
                      plotPoints: [...generatedPlan.plotPoints, { content: '', importance: 'major' }]
                    });
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span>+</span> 添加剧情节点
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowPlanConfirm(false);
                  setGeneratedPlan(null);
                }}
                className="flex-1 py-3 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-amber-400 rounded-xl font-bold transition-all border border-slate-700/50 hover:border-amber-500/30"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPlan}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-purple-900/20"
              >
                确认并应用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abandon Confirmation Modal */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95">
             <div className="flex items-center gap-4 text-red-400">
               <div className="w-12 h-12 bg-red-400/10 rounded-full flex items-center justify-center text-2xl">
                 🗑️
               </div>
               <div>
                 <h3 className="font-bold text-lg text-slate-200">放弃稿件？</h3>
                 <p className="text-xs text-red-400/80">此操作不可撤销</p>
               </div>
             </div>

             <p className="text-sm text-slate-400 leading-relaxed">
               确定要放弃当前创作的所有内容吗？<br/>
               执行此操作将：
             </p>
             <ul className="text-sm text-slate-500 list-disc list-inside space-y-1 ml-2">
                <li>清空当前章节正文</li>
                <li>删除所有对话历史记录</li>
                <li>返回初始"生成新章节"状态</li>
             </ul>

             <div className="flex gap-3 pt-2">
               <button
                 onClick={() => setShowAbandonConfirm(false)}
                 className="flex-1 py-3 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-amber-400 rounded-xl font-bold transition-all border border-slate-700/50 hover:border-amber-500/30"
               >
                 取消
               </button>
               <button
                 onClick={confirmAbandon}
                 className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-900/20"
               >
                 确认放弃
               </button>
             </div>
          </div>
        </div>
      )}

      {!currentChapter ? (
        <div className="flex-1 flex flex-col backdrop-blur-xl bg-gradient-to-br from-amber-500/5 via-purple-600/5 to-blue-600/5 border border-dashed border-amber-500/20 rounded-3xl p-8 overflow-y-auto">
          {isShortNovel && targetChapterCount && (
            <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-purple-400 text-sm font-bold">📖 短篇模式</span>
                <span className="text-slate-400 text-sm">第 {currentChapterNum}/{targetChapterCount} 章</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              {isLastChapter && (
                <p className="text-xs text-amber-400 mt-2 font-medium text-center">⚠️ 这是最后一章，AI 将自动完成故事收尾</p>
              )}
            </div>
          )}

          <div className="w-full max-w-5xl mx-auto space-y-6">
            {/* Author Note - Input for AI Planning */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span>✍️</span> 作者备注
                <span className="text-xs text-amber-400/70">(为AI智能生成配置提供参考)</span>
              </label>
              <div className="flex gap-3 items-stretch">
                <textarea
                  value={chapterConfig.authorNote}
                  onChange={(e) => setChapterConfig(prev => ({ ...prev, authorNote: e.target.value }))}
                  placeholder="本章特殊要求，如：重点描写战斗场面、增加感情戏、引入新势力等..."
                  className="flex-1 bg-slate-900/80 border border-amber-500/40 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg resize-none"
                  rows={2}
                />
                {/* AI Smart Planning Button - Right Side */}
                <button
                  onClick={handleGeneratePlan}
                  disabled={isGeneratingPlan}
                  className="group relative overflow-hidden px-4 rounded-lg text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 bg-[length:200%_100%] animate-[gradient_3s_ease_infinite]" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 blur-lg opacity-40" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                  <span className="relative flex items-center justify-center gap-1.5 text-white">
                    {isGeneratingPlan ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>AI 规划中...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-base">🧠</span>
                        <span>AI 智能生成配置</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-5">
                    {/* Synopsis */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <span>📋</span> 章节梗概
                      </label>
                      <textarea
                        value={chapterConfig.synopsis}
                        onChange={(e) => setChapterConfig(prev => ({ ...prev, synopsis: e.target.value }))}
                        placeholder="简要描述本章的主要内容和发展方向..."
                        className="w-full bg-slate-900/80 border border-amber-500/40 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Word Count Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <span>📝</span> 目标字数
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {WORD_COUNT_OPTIONS.map(opt => (
                          <button
                            key={opt.value ?? 'default'}
                            onClick={() => {
                              if (opt.value === -1) {
                                setIsCustomWordCount(true);
                              } else {
                                setIsCustomWordCount(false);
                                setChapterConfig(prev => ({ ...prev, wordCount: opt.value }));
                              }
                            }}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                              (opt.value === -1 && isCustomWordCount) || (!isCustomWordCount && chapterConfig.wordCount === opt.value)
                                ? 'bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 border-amber-500 text-white shadow-lg'
                                : 'bg-slate-900/60 border-amber-500/20 text-slate-400 hover:border-amber-500/40'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {isCustomWordCount && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            value={customWordCount}
                            onChange={(e) => {
                              setCustomWordCount(e.target.value);
                              const num = parseInt(e.target.value);
                              if (num > 0) {
                                setChapterConfig(prev => ({ ...prev, wordCount: num }));
                              }
                            }}
                            placeholder="输入目标字数"
                            min="500"
                            max="20000"
                            className="w-32 bg-slate-900/80 border border-amber-500/40 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg"
                          />
                          <span className="text-xs text-slate-500">字 (500-20000)</span>
                        </div>
                      )}
                    </div>

                    {/* Featured Characters Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <span>👥</span> 出场角色
                      </label>
                      {settings.characters && settings.characters.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {settings.characters.map(char => (
                            <button
                              key={char.name}
                              onClick={() => {
                                setChapterConfig(prev => ({
                                  ...prev,
                                  selectedCharacters: prev.selectedCharacters.includes(char.name)
                                    ? prev.selectedCharacters.filter(n => n !== char.name)
                                    : [...prev.selectedCharacters, char.name]
                                }));
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                chapterConfig.selectedCharacters.includes(char.name)
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                              }`}
                              title={char.description}
                            >
                              {char.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">暂无已定义角色</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-5">
                    {/* New Characters */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <span>➕</span> 新增角色
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={newCharName}
                          onChange={(e) => setNewCharName(e.target.value)}
                          placeholder="角色名"
                          className="flex-1 bg-slate-900/80 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg"
                        />
                        <input
                          value={newCharDesc}
                          onChange={(e) => setNewCharDesc(e.target.value)}
                          placeholder="描述"
                          className="flex-[2] bg-slate-900/80 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg"
                        />
                        <button
                          onClick={() => {
                            if (newCharName.trim()) {
                              setChapterConfig(prev => ({
                                ...prev,
                                newCharacters: [...prev.newCharacters, { name: newCharName.trim(), description: newCharDesc.trim() }]
                              }));
                              setNewCharName('');
                              setNewCharDesc('');
                            }
                          }}
                          className="px-3 py-1.5 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-amber-400 rounded-lg text-xs transition-all border border-slate-700/50 hover:border-amber-500/30"
                        >
                          +
                        </button>
                      </div>
                      {chapterConfig.newCharacters.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {chapterConfig.newCharacters.map((char, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 p-2.5 bg-green-600/10 rounded-lg border border-green-600/30 hover:border-green-500/50 transition-all"
                            >
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={char.name}
                                    onChange={(e) => {
                                      const updated = [...chapterConfig.newCharacters];
                                      updated[idx].name = e.target.value;
                                      setChapterConfig(prev => ({ ...prev, newCharacters: updated }));
                                    }}
                                    className="flex-1 bg-slate-900/60 border border-green-500/40 rounded px-2 py-1 text-xs font-semibold text-green-400 focus:outline-none focus:ring-1 focus:ring-green-500/60"
                                    placeholder="角色名"
                                  />
                                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded border border-green-500/30">新角色</span>
                                </div>
                                <textarea
                                  value={char.description}
                                  onChange={(e) => {
                                    const updated = [...chapterConfig.newCharacters];
                                    updated[idx].description = e.target.value;
                                    setChapterConfig(prev => ({ ...prev, newCharacters: updated }));
                                  }}
                                  className="w-full bg-slate-900/60 border border-green-500/40 rounded px-2 py-1 text-[11px] text-slate-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-green-500/60 resize-none"
                                  placeholder="角色描述"
                                  rows={2}
                                />
                              </div>
                              <button
                                onClick={() => setChapterConfig(prev => ({
                                  ...prev,
                                  newCharacters: prev.newCharacters.filter((_, i) => i !== idx)
                                }))}
                                className="text-green-400/60 hover:text-red-400 text-sm transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Plot Points with Importance */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <span>🎯</span> 剧情节点
                        <span className="text-[10px] text-slate-500">(🔥重点 💨略写)</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={newPlotPoint}
                          onChange={(e) => setNewPlotPoint(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newPlotPoint.trim()) {
                              setChapterConfig(prev => ({
                                ...prev,
                                plotPoints: [...prev.plotPoints, { content: newPlotPoint.trim(), importance: 'major' }]
                              }));
                              setNewPlotPoint('');
                            }
                          }}
                          placeholder="例如：主角获得神秘传承..."
                          className="flex-1 bg-slate-900/80 border border-amber-500/40 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg"
                        />
                        <button
                          onClick={() => {
                            if (newPlotPoint.trim()) {
                              setChapterConfig(prev => ({
                                ...prev,
                                plotPoints: [...prev.plotPoints, { content: newPlotPoint.trim(), importance: 'major' }]
                              }));
                              setNewPlotPoint('');
                            }
                          }}
                          className="px-4 py-2 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-amber-400 rounded-lg text-sm transition-all border border-slate-700/50 hover:border-amber-500/30"
                        >
                          +
                        </button>
                      </div>
                      {chapterConfig.plotPoints.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {chapterConfig.plotPoints.map((point, idx) => (
                            <div
                              key={idx}
                              className={`flex items-start gap-2 p-2.5 rounded-lg border transition-all ${
                                point.importance === 'major'
                                  ? 'bg-red-600/10 border-red-600/30 hover:border-red-500/50'
                                  : 'bg-slate-600/10 border-slate-600/30 hover:border-slate-500/50'
                              }`}
                            >
                              <span className="text-base mt-0.5">{point.importance === 'major' ? '🔥' : '💨'}</span>
                              <textarea
                                value={point.content}
                                onChange={(e) => {
                                  const updated = [...chapterConfig.plotPoints];
                                  updated[idx].content = e.target.value;
                                  setChapterConfig(prev => ({ ...prev, plotPoints: updated }));
                                }}
                                className={`flex-1 bg-slate-900/60 border rounded px-2 py-1 text-xs leading-relaxed focus:outline-none focus:ring-1 resize-none ${
                                  point.importance === 'major'
                                    ? 'border-red-500/40 text-red-300 focus:ring-red-500/60'
                                    : 'border-slate-500/40 text-slate-300 focus:ring-slate-500/60'
                                }`}
                                placeholder="剧情节点内容"
                                rows={2}
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => {
                                    const updated = [...chapterConfig.plotPoints];
                                    updated[idx].importance = updated[idx].importance === 'major' ? 'minor' : 'major';
                                    setChapterConfig(prev => ({ ...prev, plotPoints: updated }));
                                  }}
                                  className="text-xs opacity-60 hover:opacity-100 transition-opacity"
                                  title="切换重要度"
                                >
                                  ⇄
                                </button>
                                <button
                                  onClick={() => setChapterConfig(prev => ({
                                    ...prev,
                                    plotPoints: prev.plotPoints.filter((_, i) => i !== idx)
                                  }))}
                                  className="text-xs opacity-60 hover:text-red-400 transition-colors"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

            {/* Generate Button with Enhanced Animation */}
            <button
              onClick={handleDraftNext}
              className="group relative w-full overflow-hidden px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-[length:200%_100%] animate-[gradient_3s_ease_infinite]" />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 blur-xl opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              <span className="relative flex items-center justify-center gap-2 text-white">
                <span className="text-xl">✨</span>
                <span>一键生成第 {chapters.length + 1} 章</span>
                <span className="text-sm opacity-80">({chapterConfig.wordCount ? `${chapterConfig.wordCount}字` : '2000字+'})</span>
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px]">
          {/* Main Editor */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 flex flex-col flex-1 shadow-xl overflow-hidden">
              <div className="flex justify-between items-start mb-4 gap-4">
                <input
                  value={currentChapter.title}
                  onChange={(e) => setCurrentChapter({ ...currentChapter, title: e.target.value })}
                  className="bg-transparent text-2xl font-bold serif-font border-b border-amber-500/20 pb-2 focus:outline-none focus:border-amber-500/60 flex-1 min-w-0"
                  placeholder="输入章节标题..."
                />
                <div className="flex bg-slate-900/60 rounded-lg p-1 border border-amber-500/20 shrink-0">
                  <button 
                    onClick={() => setViewMode('edit')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'edit' ? 'bg-slate-800 text-slate-200 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    ✏️ 编辑
                  </button>
                  <button 
                    onClick={() => setViewMode('preview')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'preview' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    👁️ 预览
                  </button>
                </div>
              </div>

              {viewMode === 'edit' ? (
                <textarea
                  value={currentChapter.content}
                  onChange={(e) => setCurrentChapter({ ...currentChapter, content: e.target.value })}
                  className="flex-1 bg-transparent text-slate-300 leading-relaxed text-lg serif-font focus:outline-none resize-none overflow-y-auto pr-2"
                  style={{ scrollbarWidth: 'thin' }}
                  placeholder="AI正在撰写正文..."
                />
              ) : (
                <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                  <div className="prose prose-invert prose-lg max-w-none serif-font leading-loose text-slate-300 whitespace-pre-wrap">
                    {currentChapter.content}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-amber-500/20">
              <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-500 px-3 font-medium">当前字数：{currentChapter.content.length} / 目标 {chapterConfig.wordCount || 2000}+</span>
                 <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">草稿已自动保存</span>
              </div>
              <div className="flex gap-2">
                 <button
                  onClick={handleAbandonDraft}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
                >
                  放弃稿件
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="px-4 py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-900/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={isGenerating ? 'AI 正在生成中，请稍候...' : '使用当前配置重新生成章节'}
                >
                  <span>🔄</span>
                  重新生成
                </button>
                <button
                  onClick={handleHandover}
                  disabled={!currentChapter.content.trim() || isGenerating}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm transition-all font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2"
                  title={!currentChapter.content.trim() ? '内容为空，无法归档' : isGenerating ? 'AI 正在生成中，请稍候...' : ''}
                >
                  下一步：校对与归档 ➡️
                </button>
              </div>
            </div>
          </div>

          {/* AI Chat / Consultant */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 rounded-2xl flex flex-col shadow-xl overflow-hidden h-full max-h-[calc(100vh-140px)]">
            <div className="p-4 border-b border-amber-500/20 bg-slate-900/50 flex justify-between items-center">
               <h3 className="font-semibold flex items-center gap-2 text-sm">
                 <span className="text-purple-400 text-lg">🤖</span> 智库调优
               </h3>
               <button 
                 onClick={() => setChatHistory([])}
                 className="text-[10px] text-slate-500 hover:text-white px-2 py-1 rounded border border-slate-800 hover:bg-slate-800"
               >
                 清空对话
               </button>
            </div>
            
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/20">
               {chatHistory.length === 0 ? (
                  <div className="text-center text-slate-600 text-xs py-8 italic space-y-2">
                     <p>我是您的专属责编。</p>
                     <p>您可以让我：</p>
                     <ul className="text-slate-500 list-disc list-inside">
                        <li>润色选定段落</li>
                        <li>提供后续剧情灵感</li>
                        <li>检查逻辑漏洞</li>
                     </ul>
                  </div>
               ) : (
                  chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                       <div className={`max-w-[90%] rounded-2xl p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user' 
                          ? 'bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 text-white rounded-br-none shadow-lg' 
                          : 'bg-slate-800 text-slate-300 rounded-bl-none border border-slate-700'
                       }`}>
                          {msg.content}
                       </div>
                       {/* Apply Button for AI messages that look like content */}
                       {msg.role === 'model' && msg.content.length > 50 && (
                          <button 
                            onClick={() => handleApplyContent(msg.content)}
                            className="mt-1 mr-auto text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                          >
                             <span>↪️</span> 使用此内容替换正文
                          </button>
                       )}
                    </div>
                  ))
               )}
               {isChatting && (
                 <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-150"></div>
                 </div>
               )}
               <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-slate-900/60 border-t border-amber-500/20">
               <div className="relative">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                       }
                    }}
                    placeholder="输入指令 (Shift+Enter 换行)..."
                    className="w-full bg-slate-900/80 border border-amber-500/40 rounded-xl pl-3 pr-10 py-3 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg resize-none text-sm custom-scrollbar"
                    rows={3}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatting}
                    className="absolute right-2 bottom-2 p-1.5 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 hover:from-amber-400 hover:via-purple-500 hover:to-blue-500 disabled:bg-slate-800 text-white rounded-lg transition-all shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WritingStudio;
