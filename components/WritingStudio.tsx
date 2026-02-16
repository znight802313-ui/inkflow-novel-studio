
import React, { useState, useEffect, useRef } from 'react';
import { NovelSettings, Chapter, AvailableModel } from '../types';
import { streamChapterDraft, chatWithChapter, ChapterCreationOptions } from '../services/geminiService';

interface WritingStudioProps {
  settings: NovelSettings;
  chapters: Chapter[];
  onProceedToReview: (draft: { title: string; content: string }) => void;
  onUpdateSettings?: (settings: Partial<NovelSettings>) => void;
  setIsLoading: (loading: boolean) => void;
  model: AvailableModel;
}

const DRAFT_STORAGE_KEY = 'inkflow_current_draft';
const INSTRUCTION_STORAGE_KEY = 'inkflow_current_instruction';
const CHAT_HISTORY_KEY = 'inkflow_chat_history';
const CHAPTER_CONFIG_KEY = 'inkflow_chapter_config';

type ChatMessage = {
  role: 'user' | 'model';
  content: string;
};

// 章节创作配置
interface ChapterConfig {
  wordCount: number | null;  // 目标字数，null 表示默认 3000+
  selectedCharacters: string[];  // 已选择的出场角色名
  newCharacters: { name: string; description: string }[];  // 新增角色
  plotPoints: string[];  // 剧情情节点
}

const DEFAULT_CHAPTER_CONFIG: ChapterConfig = {
  wordCount: null,
  selectedCharacters: [],
  newCharacters: [],
  plotPoints: []
};

const WORD_COUNT_OPTIONS = [
  { value: null, label: '默认 (3000+)' },
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
  const [instruction, setInstruction] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Chapter Config State
  const [chapterConfig, setChapterConfig] = useState<ChapterConfig>(DEFAULT_CHAPTER_CONFIG);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
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
    const savedInstruction = localStorage.getItem(INSTRUCTION_STORAGE_KEY);
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
    
    if (savedInstruction) {
      setInstruction(savedInstruction);
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
    localStorage.setItem(INSTRUCTION_STORAGE_KEY, instruction);
  }, [instruction]);

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

  const handleDraftNext = async () => {
    if (currentChapter && currentChapter.content.length > 50) {
        if (!confirm("⚠️ 警告：当前编辑器内已有未归档的草稿。\n\n继续生成将覆盖当前内容（建议先备份或归档）。是否确定覆盖？")) {
            return;
        }
    }

    setIsLoading(true);
    // Initialize empty draft to switch view immediately
    const initialDraft = { title: `第${chapters.length + 1}章`, content: '' };
    setCurrentChapter(initialDraft);
    setViewMode('edit');
    // Clear chat history for new draft
    setChatHistory([]);

    // Build creation options from config
    const creationOptions: ChapterCreationOptions = {
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
        instruction,
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
    }
  };

  const handleAbandonDraft = () => {
    setShowAbandonConfirm(true);
  };

  const confirmAbandon = () => {
    setCurrentChapter(null);
    setInstruction('');
    setChatHistory([]); // Clear chat history
    setChapterConfig(DEFAULT_CHAPTER_CONFIG); // Reset chapter config
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(INSTRUCTION_STORAGE_KEY);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    localStorage.removeItem(CHAPTER_CONFIG_KEY);
    setShowAbandonConfirm(false);
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
      
      {/* Abandon Confirmation Modal */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95">
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
                <li>返回初始“生成新章节”状态</li>
             </ul>

             <div className="flex gap-3 pt-2">
               <button 
                 onClick={() => setShowAbandonConfirm(false)}
                 className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
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
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl p-12 overflow-y-auto">
          <div className="text-center space-y-4 max-w-lg">
            <h2 className="text-4xl font-bold serif-font italic text-slate-300">笔耕不辍，动作叙事</h2>
            <p className="text-slate-500">
              已启用「番茄大神」创作模式：极致动作叙事，一句话一段，目标 3000 字以上。
            </p>
            {isShortNovel && targetChapterCount && (
              <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
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
                  <p className="text-xs text-amber-400 mt-2 font-medium">⚠️ 这是最后一章，AI 将自动完成故事收尾</p>
                )}
              </div>
            )}
          </div>

          <div className="w-full max-w-2xl space-y-4">
            <textarea
              placeholder="特别创作要求（可选，例如：让林黛玉展现出泼辣的一面，重点描写主角如何夺取贾府大权...）"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 h-24 resize-none"
            />

            {/* Advanced Config Toggle */}
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all"
            >
              <span className="flex items-center gap-2">
                <span>⚙️</span>
                <span className="text-sm font-medium">高级创作配置</span>
                {(chapterConfig.wordCount || chapterConfig.selectedCharacters.length > 0 || chapterConfig.newCharacters.length > 0 || chapterConfig.plotPoints.length > 0) && (
                  <span className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full">已配置</span>
                )}
              </span>
              <svg className={`w-4 h-4 transition-transform ${showConfigPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Advanced Config Panel */}
            {showConfigPanel && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 animate-in slide-in-from-top duration-300">
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
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
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
                        className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      />
                      <span className="text-xs text-slate-500">字 (500-20000)</span>
                    </div>
                  )}
                </div>

                {/* Featured Characters Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <span>👥</span> 出场角色（从已有角色中选择）
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
                          {char.name} ({char.role})
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">暂无已定义角色，请先在「核心设定」中添加角色</p>
                  )}
                </div>

                {/* New Characters */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <span>➕</span> 新增角色（本章临时出场）
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      placeholder="角色名"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                    <input
                      value={newCharDesc}
                      onChange={(e) => setNewCharDesc(e.target.value)}
                      placeholder="简短描述（可选）"
                      className="flex-[2] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
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
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                    >
                      添加
                    </button>
                  </div>
                  {chapterConfig.newCharacters.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {chapterConfig.newCharacters.map((char, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-lg border border-green-600/30"
                        >
                          {char.name}
                          {char.description && <span className="text-green-500/60">({char.description})</span>}
                          <button
                            onClick={() => setChapterConfig(prev => ({
                              ...prev,
                              newCharacters: prev.newCharacters.filter((_, i) => i !== idx)
                            }))}
                            className="ml-1 text-green-400/60 hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Plot Points */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <span>🎯</span> 剧情情节点（希望本章出现的情节）
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newPlotPoint}
                      onChange={(e) => setNewPlotPoint(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPlotPoint.trim()) {
                          setChapterConfig(prev => ({
                            ...prev,
                            plotPoints: [...prev.plotPoints, newPlotPoint.trim()]
                          }));
                          setNewPlotPoint('');
                        }
                      }}
                      placeholder="例如：主角获得神秘传承、与反派首次交锋..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    />
                    <button
                      onClick={() => {
                        if (newPlotPoint.trim()) {
                          setChapterConfig(prev => ({
                            ...prev,
                            plotPoints: [...prev.plotPoints, newPlotPoint.trim()]
                          }));
                          setNewPlotPoint('');
                        }
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                    >
                      添加
                    </button>
                  </div>
                  {chapterConfig.plotPoints.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {chapterConfig.plotPoints.map((point, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600/20 text-amber-400 text-xs rounded-lg border border-amber-600/30"
                        >
                          {point}
                          <button
                            onClick={() => setChapterConfig(prev => ({
                              ...prev,
                              plotPoints: prev.plotPoints.filter((_, i) => i !== idx)
                            }))}
                            className="ml-1 text-amber-400/60 hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reset Config */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setChapterConfig(DEFAULT_CHAPTER_CONFIG)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    重置所有配置
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleDraftNext}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all active:scale-95"
            >
              一键生成第 {chapters.length + 1} 章 ({chapterConfig.wordCount ? `${chapterConfig.wordCount}字` : '3000字+'})
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px]">
          {/* Main Editor */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col flex-1 shadow-xl overflow-hidden">
              <div className="flex justify-between items-start mb-4 gap-4">
                <input
                  value={currentChapter.title}
                  onChange={(e) => setCurrentChapter({ ...currentChapter, title: e.target.value })}
                  className="bg-transparent text-2xl font-bold serif-font border-b border-slate-800 pb-2 focus:outline-none focus:border-purple-500 flex-1 min-w-0"
                  placeholder="输入章节标题..."
                />
                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 shrink-0">
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

            <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-500 px-3 font-medium">当前字数：{currentChapter.content.length} / 目标 {chapterConfig.wordCount || 3000}+</span>
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
                  onClick={handleHandover}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg text-sm transition-all font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2"
                >
                  下一步：校对与归档 ➡️
                </button>
              </div>
            </div>
          </div>

          {/* AI Chat / Consultant */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden h-full max-h-[calc(100vh-140px)]">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
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
                          ? 'bg-purple-600 text-white rounded-br-none' 
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
            <div className="p-3 bg-slate-900 border-t border-slate-800">
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-10 py-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none text-sm custom-scrollbar"
                    rows={3}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatting}
                    className="absolute right-2 bottom-2 p-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-lg transition-colors"
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
