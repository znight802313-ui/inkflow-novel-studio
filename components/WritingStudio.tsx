
import React, { useState, useEffect, useRef } from 'react';
import { NovelSettings, Chapter, AvailableModel, ChapterVersion, ChapterDraft, ChapterConfig, ChatMessage } from '../types';
import { streamChapterDraft, chatWithChapter, ChapterCreationOptions, generateChapterPlan, editSelectedText, reviewChapter, ChapterReview, EditSuggestion } from '../services/geminiService';
import DraftService from '../services/draftService';
import * as Diff from 'diff';

interface WritingStudioProps {
  settings: NovelSettings;
  chapters: Chapter[];
  onProceedToReview: (draft: { title: string; content: string }) => void;
  onUpdateSettings?: (settings: Partial<NovelSettings>) => void;
  setIsLoading: (loading: boolean) => void;
  model: AvailableModel;
  projectId?: string | null; // 添加项目ID
}

// Track if AI is currently generating content
let isGenerating = false;

// 生成带项目ID的存储键
const getStorageKey = (baseKey: string, projectId?: string | null) => {
  return projectId ? `${baseKey}_${projectId}` : baseKey;
};

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
  model,
  projectId
}) => {
  // 草稿状态
  const [currentDraft, setCurrentDraft] = useState<ChapterDraft | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // 编辑器状态
  const [currentChapter, setCurrentChapter] = useState<{ title: string; content: string } | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Version Management State
  const [versionHistory, setVersionHistory] = useState<ChapterVersion[]>([]);
  const [compareWithVersion, setCompareWithVersion] = useState<ChapterVersion | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Quick Edit Preview State
  const [editPreview, setEditPreview] = useState<{
    originalText: string;
    editedText: string;
    instruction: string;
  } | null>(null);

  // Right Panel Tab State
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'history' | 'review'>('chat');

  // Chapter Review State
  const [chapterReview, setChapterReview] = useState<ChapterReview | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFullReportModal, setShowFullReportModal] = useState(false); // 完整报告弹窗
  const [showScoringGuideModal, setShowScoringGuideModal] = useState(false); // 评分标准说明弹窗
  const [highlightedSuggestion, setHighlightedSuggestion] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false); // 定位加载状态

  // Version dropdown state
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

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
  const [showRegenerateConfig, setShowRegenerateConfig] = useState(false); // 重新生成配置弹窗
  const [showConfigPage, setShowConfigPage] = useState(true); // 是否显示配置页（true）还是编辑页（false）

  // 当项目ID变化时，加载该项目的草稿
  useEffect(() => {
    if (!projectId) return;

    const loadDraft = async () => {
      setIsLoadingDraft(true);
      try {
        // 获取当前项目的草稿
        const draft = await DraftService.getCurrentDraft(projectId);

        if (draft) {
          // 加载草稿数据
          setCurrentDraft(draft);
          setCurrentChapter({ title: draft.title, content: draft.content });
          setChapterConfig(draft.config);
          setChatHistory(draft.chatHistory || []);
          setVersionHistory(draft.versions || []);

          // 判断是否显示配置页：如果草稿有内容，直接显示编辑页
          if (draft.content && draft.content.trim().length > 0) {
            setShowConfigPage(false);
          } else {
            setShowConfigPage(true);
          }
        } else {
          // 没有草稿，创建新草稿，显示配置页
          const newDraft = DraftService.createNewDraft(projectId);
          setCurrentDraft(newDraft);
          setCurrentChapter({ title: '', content: '' });
          setChapterConfig(DEFAULT_CHAPTER_CONFIG);
          setChatHistory([]);
          setVersionHistory([]);
          setShowConfigPage(true);
        }

        // 清空其他状态
        setCompareWithVersion(null);
        setSelectedText(null);
        setEditPreview(null);
        setChapterReview(null);
        setViewMode('edit');
      } catch (error) {
        console.error('Error loading draft:', error);
      } finally {
        setIsLoadingDraft(false);
      }
    };

    loadDraft();
  }, [projectId]);

  // Save persistence (移除 localStorage，改用云端草稿)
  // useEffect(() => {
  //   ...
  // }, []);

  // Close version dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showVersionDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.version-dropdown-container')) {
          setShowVersionDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVersionDropdown]);

  // Version Management Functions
  const saveVersion = async (content: string, note: string, type: 'manual' | 'ai' | 'auto', title?: string) => {
    const newVersion: ChapterVersion = {
      id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: Date.now(),
      note,
      type
    };

    // 先更新版本历史
    const updatedVersions = [...versionHistory, newVersion];
    setVersionHistory(updatedVersions);

    // 然后立即保存草稿
    if (currentDraft && projectId) {
      setIsSavingDraft(true);
      try {
        const updatedDraft = {
          ...currentDraft,
          title: title || currentChapter?.title || '',
          content: content,
          config: chapterConfig,
          chatHistory,
          versions: updatedVersions,
          updatedAt: Date.now()
        };

        console.log('=== Saving draft details ===');
        console.log('Title:', updatedDraft.title);
        console.log('Content length:', updatedDraft.content?.length || 0);
        console.log('Versions count:', updatedDraft.versions?.length || 0);
        console.log('Full draft object:', updatedDraft);

        const saved = await DraftService.saveDraft(updatedDraft);
        if (saved) {
          setCurrentDraft(saved);
          console.log('=== Draft saved successfully ===');
          console.log('Saved title:', saved.title);
          console.log('Saved content length:', saved.content?.length || 0);
          console.log('Saved versions count:', saved.versions?.length || 0);
        }
      } catch (error) {
        console.error('Error saving draft:', error);
      } finally {
        setIsSavingDraft(false);
      }
    } else {
      console.warn('Cannot save draft: currentDraft or projectId is missing', { currentDraft, projectId });
    }
  };

  const handleManualSave = () => {
    if (!currentChapter?.content) {
      alert('没有内容可保存');
      return;
    }
    const note = prompt('请输入版本说明（可选）：');
    if (note !== null) {
      saveVersion(currentChapter.content, note || '手动保存', 'manual');
      alert('版本已保存');
    }
  };

  const handleRestoreVersion = (version: ChapterVersion) => {
    if (confirm(`确定要恢复到版本「${version.note}」吗？\n\n时间：${new Date(version.timestamp).toLocaleString()}`)) {
      if (currentChapter) {
        saveVersion(currentChapter.content, '恢复前自动保存', 'auto');
      }
      setCurrentChapter(prev => prev ? { ...prev, content: version.content } : null);
      saveVersion(version.content, `恢复版本：${version.note}`, 'manual');
      setViewMode('edit');
      alert('版本已恢复');
    }
  };

  const handleTextSelect = () => {
    if (editorRef.current) {
      const start = editorRef.current.selectionStart;
      const end = editorRef.current.selectionEnd;
      if (start !== end) {
        const text = editorRef.current.value.substring(start, end);
        if (text.trim().length > 0) {
          setSelectedText(text);
        }
      }
    }
  };

  const renderDiff = (oldText: string, newText: string) => {
    const diff = Diff.diffWordsWithSpace(oldText, newText);
    return (
      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="bg-green-500/20 text-green-300 border-b-2 border-green-500">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={index} className="bg-red-500/20 text-red-300 line-through">
                {part.value}
              </span>
            );
          }
          return <span key={index} className="text-slate-300">{part.value}</span>;
        })}
      </div>
    );
  };

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
        // Save current content before overwriting
        saveVersion(currentChapter.content, '生成新章节前自动保存', 'auto');
    }

    // 立即跳转到编辑页面
    setShowConfigPage(false);

    setIsLoading(true);
    isGenerating = true;
    const initialDraft = { title: `第${chapters.length + 1}章`, content: '' };
    setCurrentChapter(initialDraft);
    setViewMode('edit');
    setChatHistory([]);

    const creationOptions: ChapterCreationOptions = {
      synopsis: chapterConfig.synopsis || undefined,
      targetWordCount: chapterConfig.wordCount || undefined,
      featuredCharacters: chapterConfig.selectedCharacters.length > 0 ? chapterConfig.selectedCharacters : undefined,
      newCharacters: chapterConfig.newCharacters.length > 0 ? chapterConfig.newCharacters : undefined,
      plotPoints: chapterConfig.plotPoints.length > 0 ? chapterConfig.plotPoints : undefined,
    };

    let generatedContent = '';
    let generatedTitle = '';

    try {
      await streamChapterDraft(
        settings,
        chapters,
        model,
        '',
        creationOptions,
        (updatedData) => {
           generatedContent = updatedData.content;
           generatedTitle = updatedData.title || '';
           setCurrentChapter(prev => ({
             title: updatedData.title || prev?.title || '',
             content: updatedData.content
           }));
        }
      );
      // Save generated content as first version
      if (generatedContent) {
        saveVersion(generatedContent, 'AI首次生成章节', 'ai', generatedTitle);
      }
    } catch (e) {
      console.error(e);
      alert('创作失败，请检查网络或设定。');
    } finally {
      setIsLoading(false);
      isGenerating = false;
    }
  };

  const handleAbandonDraft = () => {
    setShowAbandonConfirm(true);
  };

  const confirmAbandon = async () => {
    if (currentDraft?._id) {
      // 删除云端草稿
      await DraftService.deleteDraft(currentDraft._id);
    }

    // 创建新草稿
    if (projectId) {
      const newDraft = DraftService.createNewDraft(projectId);
      setCurrentDraft(newDraft);
    }

    // 清空状态
    setCurrentChapter(null);
    setChatHistory([]);
    setChapterConfig(DEFAULT_CHAPTER_CONFIG);
    setVersionHistory([]);
    setShowAbandonConfirm(false);

    // 返回配置页
    setShowConfigPage(true);
  };

  const handleRegenerate = async () => {
    if (isGenerating) return;

    // 显示配置弹窗,让用户可以修改配置
    setShowRegenerateConfig(true);
  };

  const handleConfirmRegenerate = async () => {
    // 保存当前版本
    if (currentChapter?.content) {
      saveVersion(currentChapter.content, '重新生成前自动保存', 'auto');
    }

    setShowRegenerateConfig(false);
    setCurrentChapter(prev => prev ? { ...prev, content: '' } : null);

    setIsLoading(true);
    isGenerating = true;

    const creationOptions: ChapterCreationOptions = {
      synopsis: chapterConfig.synopsis || undefined,
      targetWordCount: chapterConfig.wordCount || undefined,
      featuredCharacters: chapterConfig.selectedCharacters.length > 0 ? chapterConfig.selectedCharacters : undefined,
      newCharacters: chapterConfig.newCharacters.length > 0 ? chapterConfig.newCharacters : undefined,
      plotPoints: chapterConfig.plotPoints.length > 0 ? chapterConfig.plotPoints : undefined,
    };

    let regeneratedContent = '';
    let regeneratedTitle = '';

    try {
      await streamChapterDraft(
        settings,
        chapters,
        model,
        '',
        creationOptions,
        (updatedData) => {
          regeneratedContent = updatedData.content;
          regeneratedTitle = updatedData.title || '';
          setCurrentChapter(prev => ({
            title: updatedData.title || prev?.title || '',
            content: updatedData.content
          }));
        }
      );
      // Save regenerated content
      if (regeneratedContent) {
        saveVersion(regeneratedContent, 'AI重新生成章节', 'ai', regeneratedTitle);
        setViewMode('diff');
        setCompareWithVersion(versionHistory[versionHistory.length - 1] || null);
      }
    } catch (e) {
      console.error(e);
      alert('创作失败，请检查网络或设定。');
    } finally {
      setIsLoading(false);
      isGenerating = false;
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentChapter) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    const currentInput = chatInput;
    const currentSelectedText = selectedText;
    setChatInput('');
    setIsChatting(true);

    try {
      const responseText = await chatWithChapter(
        newHistory,
        currentChapter.content,
        settings,
        model,
        currentSelectedText || undefined
      );
      setChatHistory(prev => [...prev, { role: 'model', content: responseText }]);
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { role: 'model', content: "⚠️ 智库连接失败，请重试。" }]);
    } finally {
      setIsChatting(false);
    }
  };

  // 快捷编辑功能：显示编辑预览
  const handleQuickEdit = async (instruction: string) => {
    if (!selectedText || !currentChapter) return;

    setIsChatting(true);
    try {
      const editedText = await editSelectedText(
        selectedText,
        instruction,
        currentChapter.content,
        settings,
        model
      );

      // 显示编辑预览
      setEditPreview({
        originalText: selectedText,
        editedText: editedText,
        instruction: instruction
      });

      // 添加到聊天记录
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: `[快捷编辑] ${instruction}\n选中文本: ${selectedText.substring(0, 100)}...` },
        { role: 'model', content: `✅ 已生成编辑结果，请在左侧预览并选择是否应用\n\n修改后的文本:\n${editedText}` }
      ]);
    } catch (e) {
      console.error(e);
      alert('编辑失败，请重试');
    } finally {
      setIsChatting(false);
    }
  };

  // 应用编辑预览
  const applyEditPreview = () => {
    if (!editPreview || !currentChapter) return;

    // 替换选中的文本
    const newContent = currentChapter.content.replace(editPreview.originalText, editPreview.editedText);

    // 保存版本
    saveVersion(currentChapter.content, `AI编辑前自动保存: ${editPreview.instruction}`, 'auto');

    // 更新内容
    setCurrentChapter({ ...currentChapter, content: newContent });

    // 保存编辑后的版本
    saveVersion(newContent, `AI编辑: ${editPreview.instruction}`, 'ai');

    // 清除预览和选中状态
    setEditPreview(null);
    setSelectedText(null);
  };

  // 取消编辑预览
  const cancelEditPreview = () => {
    setEditPreview(null);
  };

  // 主编审稿功能
  const handleReviewChapter = async () => {
    if (!currentChapter || !currentChapter.content.trim()) {
      alert('章节内容为空，无法审稿');
      return;
    }

    setIsReviewing(true);
    setRightPanelTab('review'); // 切换到审稿面板
    setChapterReview(null);

    try {
      const review = await reviewChapter(
        currentChapter.title,
        currentChapter.content,
        settings,
        chapters,
        model
      );
      setChapterReview(review);
    } catch (e) {
      console.error(e);
      alert('审稿失败，请重试');
    } finally {
      setIsReviewing(false);
    }
  };

  // 计算两个字符串的相似度（0-1之间）
  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    // 使用编辑距离算法
    const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // 删除
          matrix[i][j - 1] + 1,      // 插入
          matrix[i - 1][j - 1] + cost // 替换
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - distance / maxLen;
  };

  // 智能模糊查找文本位置（基于相似度匹配）
  const fuzzyFindText = (content: string, searchText: string): number => {
    // 1. 先尝试精确匹配
    let index = content.indexOf(searchText);
    if (index !== -1) return index;

    // 2. 尝试去除空格和标点后匹配
    const normalize = (text: string) => text.replace(/[\s\n\r\t，。！？；：""''（）《》、]/g, '');
    const normalizedContent = normalize(content);
    const normalizedSearch = normalize(searchText);

    const normalizedIndex = normalizedContent.indexOf(normalizedSearch);
    if (normalizedIndex !== -1) {
      // 映射回原文位置
      let normalizedCharCount = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const isNormalChar = !/[\s\n\r\t，。！？；：""''（）《》、]/.test(char);

        if (isNormalChar) {
          if (normalizedCharCount === normalizedIndex) {
            return i;
          }
          normalizedCharCount++;
        }
      }
    }

    // 3. 使用滑动窗口 + 相似度匹配（最智能的方式）
    const searchLen = searchText.length;
    const minLen = Math.floor(searchLen * 0.5); // 最小匹配长度为搜索文本的50%
    const maxLen = Math.ceil(searchLen * 1.5);  // 最大匹配长度为搜索文本的150%

    let bestMatch = { index: -1, similarity: 0 };
    const threshold = 0.6; // 相似度阈值

    // 使用不同长度的窗口进行滑动匹配
    for (let windowLen = minLen; windowLen <= maxLen && windowLen <= content.length; windowLen++) {
      for (let i = 0; i <= content.length - windowLen; i++) {
        const window = content.substring(i, i + windowLen);
        const similarity = calculateSimilarity(normalize(window), normalizedSearch);

        if (similarity > bestMatch.similarity) {
          bestMatch = { index: i, similarity };
        }

        // 如果找到高相似度匹配，提前返回
        if (similarity > 0.9) {
          return i;
        }
      }
    }

    // 返回最佳匹配（如果相似度超过阈值）
    return bestMatch.similarity >= threshold ? bestMatch.index : -1;
  };

  // 定位到原文位置
  const handleLocateText = async (originalText: string, suggestionId: string) => {
    if (!editorRef.current || !currentChapter) return;

    const content = currentChapter.content;

    // 显示加载状态
    setIsLocating(true);

    // 使用 setTimeout 让加载提示先显示出来
    setTimeout(async () => {
      try {
        const index = fuzzyFindText(content, originalText);

        if (index !== -1) {
          // 切换到编辑模式
          setViewMode('edit');

          // 等待 DOM 更新后再定位
          setTimeout(() => {
            if (!editorRef.current) return;

            const textarea = editorRef.current;

            // 先设置选中范围
            textarea.focus();
            textarea.setSelectionRange(index, index + originalText.length);

            // 使用更精确的方法：基于行数计算
            const textBeforeCursor = content.substring(0, index);
            const lines = textBeforeCursor.split('\n');
            const lineNumber = lines.length; // 目标在第几行（从1开始）

            // 计算每行的平均高度
            const totalLines = content.split('\n').length;
            const totalHeight = textarea.scrollHeight;
            const avgLineHeight = totalHeight / totalLines;

            // 计算目标行的像素位置
            const targetLinePosition = (lineNumber - 1) * avgLineHeight;

            // 获取可视区域高度
            const viewportHeight = textarea.clientHeight;

            // 让目标行显示在视口顶部偏下一点（留出20%的空间）
            const targetScrollTop = Math.max(0, targetLinePosition - viewportHeight * 0.2);

            // 平滑滚动到目标位置
            textarea.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth'
            });

            // 高亮显示
            setHighlightedSuggestion(suggestionId);
            setSelectedText(originalText);

            // 3秒后取消高亮
            setTimeout(() => {
              setHighlightedSuggestion(null);
            }, 3000);

            // 关闭加载状态
            setIsLocating(false);
          }, 100);
        } else {
          setIsLocating(false);
          alert('无法在原文中找到该片段，可能原文已被修改');
        }
      } catch (error) {
        setIsLocating(false);
        console.error('定位失败:', error);
        alert('定位失败，请重试');
      }
    }, 50); // 延迟50ms，让加载提示先显示
  };

  // 应用修改建议
  const handleApplySuggestion = async (suggestion: EditSuggestion) => {
    if (!currentChapter) return;

    const content = currentChapter.content;
    const index = fuzzyFindText(content, suggestion.originalText);

    if (index === -1) {
      alert('无法在原文中找到该片段，可能原文已被修改');
      return;
    }

    if (suggestion.replacementText) {
      // 如果有替换文本，显示预览界面
      setEditPreview({
        original: suggestion.originalText,
        edited: suggestion.replacementText,
        instruction: suggestion.issue
      });
    } else {
      // 如果没有替换文本，使用AI生成
      setIsChatting(true);
      try {
        const editedText = await editSelectedText(
          suggestion.originalText,
          suggestion.suggestion,
          currentChapter.content,
          settings,
          model
        );

        // 显示预览界面
        setEditPreview({
          original: suggestion.originalText,
          edited: editedText,
          instruction: suggestion.suggestion
        });
      } catch (e) {
        console.error(e);
        alert('应用建议失败，请重试');
      } finally {
        setIsChatting(false);
      }
    }
  };

  // 确认应用编辑预览
  const handleConfirmEdit = () => {
    if (!editPreview || !currentChapter) return;

    const content = currentChapter.content;
    const index = fuzzyFindText(content, editPreview.originalText);

    if (index === -1) {
      alert('无法在原文中找到该片段，可能原文已被修改');
      setEditPreview(null);
      return;
    }

    // 保存版本
    saveVersion(currentChapter.content, `应用建议前自动保存: ${editPreview.instruction}`, 'auto');

    // 应用修改
    const before = content.substring(0, index);
    const after = content.substring(index + editPreview.originalText.length);
    const newContent = before + editPreview.editedText + after;

    // 更新内容
    setCurrentChapter({ ...currentChapter, content: newContent });

    // 保存编辑后的版本
    saveVersion(newContent, `应用快捷编辑: ${editPreview.instruction}`, 'ai');

    // 关闭预览
    setEditPreview(null);

    alert('✅ 已应用修改');
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

      {/* 定位加载提示 */}
      {isLocating && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">正在智能定位文本...</span>
        </div>
      )}

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

      {showConfigPage ? (
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
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
            <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 flex flex-col flex-1 shadow-xl min-h-0">
              {/* Top Bar */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-amber-500/20">
                <input
                  value={currentChapter.title}
                  onChange={(e) => setCurrentChapter({ ...currentChapter, title: e.target.value })}
                  className="bg-transparent text-xl font-bold text-slate-200 focus:outline-none flex-1 min-w-0"
                  placeholder="输入章节标题..."
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleManualSave}
                    disabled={!currentChapter.content.trim()}
                    className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="手动保存当前版本"
                  >
                    💾 保存版本
                  </button>
                  <div className="relative version-dropdown-container">
                    <button
                      onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                      disabled={versionHistory.length === 0}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title={versionHistory.length === 0 ? '暂无历史版本' : '查看历史版本'}
                    >
                      📜 历史版本 ({versionHistory.length})
                      <span className={`transition-transform ${showVersionDropdown ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {showVersionDropdown && versionHistory.length > 0 && (
                      <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                        <div className="p-2 space-y-1">
                          {versionHistory.slice().reverse().map((version, idx) => (
                            <div
                              key={version.id}
                              className="p-3 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      version.type === 'manual' ? 'bg-blue-500/20 text-blue-400' :
                                      version.type === 'ai' ? 'bg-purple-500/20 text-purple-400' :
                                      'bg-slate-500/20 text-slate-400'
                                    }`}>
                                      {version.type === 'manual' ? '手动' : version.type === 'ai' ? 'AI' : '自动'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {new Date(version.timestamp).toLocaleString('zh-CN', {
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-300 truncate">{version.note}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCompareWithVersion(version);
                                      setViewMode('diff');
                                      setShowVersionDropdown(false);
                                    }}
                                    className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                                    title="对比此版本"
                                  >
                                    🔄
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestoreVersion(version);
                                      setShowVersionDropdown(false);
                                    }}
                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                                    title="恢复此版本"
                                  >
                                    ↩️
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {viewMode === 'edit' ? (
                <div className="flex-1 relative min-h-0">
                  {editPreview ? (
                    /* Edit Preview - 显示编辑前后对比 */
                    <div className="h-full flex flex-col">
                      {/* 固定顶部信息栏 */}
                      <div className="flex-shrink-0 flex items-center justify-between gap-2 text-sm text-slate-400 bg-blue-900/30 p-2 rounded mb-2 border border-blue-500/30">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">✨ AI 编辑预览：</span>
                          <span className="text-slate-300">{editPreview.instruction}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleConfirmEdit}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs transition-all font-medium"
                          >
                            ✓ 应用修改
                          </button>
                          <button
                            onClick={cancelEditPreview}
                            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs transition-all"
                          >
                            × 取消
                          </button>
                        </div>
                      </div>

                      {/* 可滚动对比内容区域 */}
                      <div className="flex-1 overflow-y-auto pr-2 min-h-0 space-y-3" style={{ scrollbarWidth: 'thin' }}>
                        {/* 原文 */}
                        <div className="bg-slate-950/50 p-4 rounded-lg border border-red-500/30">
                          <div className="text-xs text-red-400 mb-2 font-medium">原文：</div>
                          <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {editPreview.originalText}
                          </div>
                        </div>

                        {/* 修改后（可编辑） */}
                        <div className="bg-slate-950/50 p-4 rounded-lg border border-green-500/30">
                          <div className="text-xs text-green-400 mb-2 font-medium">修改后（可编辑）：</div>
                          <textarea
                            value={editPreview.editedText}
                            onChange={(e) => setEditPreview({ ...editPreview, editedText: e.target.value })}
                            className="w-full bg-slate-900/50 text-green-300 leading-relaxed text-base focus:outline-none resize-none border border-green-500/20 rounded p-2"
                            style={{ scrollbarWidth: 'thin', minHeight: '150px' }}
                            rows={8}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Normal Edit Mode */
                    <>
                      <textarea
                        ref={editorRef}
                        value={currentChapter.content}
                        onChange={(e) => setCurrentChapter({ ...currentChapter, content: e.target.value })}
                        onSelect={handleTextSelect}
                        className="w-full h-full bg-transparent text-slate-300 leading-relaxed text-base focus:outline-none resize-none overflow-y-auto pr-2"
                        style={{ scrollbarWidth: 'thin' }}
                        placeholder="AI正在撰写正文..."
                      />
                      {isGenerating && (
                        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
                          <div className="text-center space-y-4">
                            <div className="inline-block animate-spin text-6xl">✨</div>
                            <div className="text-amber-400 font-medium text-lg">AI 正在生成章节正文</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Diff View - 使用 flex 布局确保滚动 */
                <div className="flex-1 flex flex-col min-h-0">
                  {compareWithVersion ? (
                    <>
                      {/* 固定顶部信息栏 */}
                      <div className="flex-shrink-0 flex items-center justify-between gap-2 text-sm text-slate-400 bg-slate-800/50 p-2 rounded mb-2">
                        <div className="flex items-center gap-2">
                          <span>对比版本：</span>
                          <span className="text-amber-400">{compareWithVersion.note}</span>
                          <span className="text-slate-500">({new Date(compareWithVersion.timestamp).toLocaleString()})</span>
                        </div>
                        <button
                          onClick={() => {
                            handleRestoreVersion(compareWithVersion);
                            setCompareWithVersion(null);
                          }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs transition-all font-medium"
                          title="恢复到此版本并返回编辑"
                        >
                          ↩️ 恢复此版
                        </button>
                      </div>

                      {/* 可滚动内容区域 */}
                      <div className="flex-1 overflow-y-auto pr-2 min-h-0" style={{ scrollbarWidth: 'thin' }}>
                        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700">
                          {renderDiff(compareWithVersion.content, currentChapter.content)}
                        </div>
                      </div>

                      {/* 固定底部按钮 */}
                      <div className="flex-shrink-0 flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setViewMode('edit');
                            setCompareWithVersion(null);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-all"
                        >
                          ✏️ 返回编辑
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center text-slate-500 py-8">
                      请从历史记录中选择一个版本进行对比
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-amber-500/20">
              <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-500 px-3 font-medium">当前字数：{currentChapter.content.length} / 目标 {chapterConfig.wordCount || 2000}+</span>
                 {isSavingDraft ? (
                   <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                     <span className="inline-block animate-spin">⏳</span>
                     保存中...
                   </span>
                 ) : (
                   <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                     ✓ 已保存到云端
                   </span>
                 )}
              </div>
              <div className="flex gap-3 items-center">
                 <button
                  onClick={handleAbandonDraft}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
                >
                  放弃稿件
                </button>
                <div className="h-8 w-px bg-slate-700/50"></div>
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 hover:border-amber-400/50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2.5 shadow-lg shadow-amber-900/10 hover:shadow-amber-900/20"
                  title={isGenerating ? 'AI 正在生成中，请稍候...' : '使用当前配置重新生成章节'}
                >
                  <svg className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" className="stroke-amber-400 group-hover:stroke-amber-300" />
                  </svg>
                  <span className="text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent group-hover:from-amber-300 group-hover:to-orange-300 transition-all">
                    重新生成
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-orange-500/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
                <button
                  onClick={handleHandover}
                  disabled={!currentChapter.content.trim() || isGenerating}
                  className="group relative px-6 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 hover:from-blue-500 hover:via-cyan-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-xl text-sm transition-all font-bold shadow-xl shadow-blue-900/30 hover:shadow-blue-900/50 overflow-hidden"
                  title={!currentChapter.content.trim() ? '内容为空，无法归档' : isGenerating ? 'AI 正在生成中，请稍候...' : ''}
                >
                  <span className="relative z-10">校对与归档</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: AI Chat / History */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/20 rounded-2xl flex flex-col shadow-xl overflow-hidden h-full max-h-[calc(100vh-140px)]">
            {/* Tab Header */}
            <div className="p-4 border-b border-amber-500/20 bg-slate-900/50">
              <div className="flex gap-2">
                <button
                  onClick={() => setRightPanelTab('chat')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    rightPanelTab === 'chat'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>🤖</span>
                    <span>智库调优</span>
                  </span>
                </button>
                <button
                  onClick={() => setRightPanelTab('review')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    rightPanelTab === 'review'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>📋</span>
                    <span>主编审稿</span>
                    {chapterReview && <span className="text-xs">({chapterReview.editSuggestions?.length || 0})</span>}
                  </span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {rightPanelTab === 'chat' ? (
              <>
                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/20">
               {chatHistory.length === 0 ? (
                  <div className="text-center text-slate-600 text-xs py-8 italic space-y-2">
                     <p>我是你的创作小助手。</p>
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
               {selectedText && (
                 <div className="mb-3 space-y-2">
                   <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                     <div className="flex items-center justify-between gap-2 mb-2">
                       <div className="flex items-center gap-2 flex-1 min-w-0">
                         <span className="text-yellow-400 text-xs font-medium">📌</span>
                         <span className="text-slate-300 text-xs truncate">{selectedText.substring(0, 50)}...</span>
                       </div>
                       <button
                         onClick={() => setSelectedText(null)}
                         className="text-slate-400 hover:text-white text-sm"
                       >
                         ×
                       </button>
                     </div>
                     {/* Quick Edit Buttons */}
                     <div className="flex flex-wrap gap-2 relative">
                       {isChatting && (
                         <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                           <div className="text-center space-y-2">
                             <div className="inline-block animate-spin text-2xl">✨</div>
                             <div className="text-amber-400 text-xs font-medium">AI 处理中...</div>
                           </div>
                         </div>
                       )}
                       <button
                         onClick={() => handleQuickEdit('润色优化这段文字，提升表现力和文学性')}
                         disabled={isChatting}
                         className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs transition-all disabled:opacity-50"
                       >
                         ✨ 润色
                       </button>
                       <button
                         onClick={() => handleQuickEdit('扩写这段文字，增加细节描写和画面感')}
                         disabled={isChatting}
                         className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs transition-all disabled:opacity-50"
                       >
                         📝 扩写
                       </button>
                       <button
                         onClick={() => handleQuickEdit('精简这段文字，保留核心内容')}
                         disabled={isChatting}
                         className="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg text-xs transition-all disabled:opacity-50"
                       >
                         ✂️ 精简
                       </button>
                       <button
                         onClick={() => handleQuickEdit('增强这段的情感张力和戏剧冲突')}
                         disabled={isChatting}
                         className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-xs transition-all disabled:opacity-50"
                       >
                         🔥 增强张力
                       </button>
                       <button
                         onClick={() => handleQuickEdit('改写这段，使用更生动的动作描写')}
                         disabled={isChatting}
                         className="px-3 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 rounded-lg text-xs transition-all disabled:opacity-50"
                       >
                         🎬 动作化
                       </button>
                     </div>
                   </div>
                 </div>
               )}
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
                    className="w-full bg-slate-900/80 border border-amber-500/40 rounded-xl pl-3 pr-14 py-3 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all shadow-lg resize-none text-sm custom-scrollbar"
                    rows={3}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatting}
                    className="absolute right-3 bottom-2 p-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:bg-slate-800/50 disabled:opacity-50 text-amber-400 hover:text-amber-300 disabled:text-slate-600 rounded-lg transition-all"
                    title="发送 (Enter)"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
               </div>
            </div>
              </>
            ) : rightPanelTab === 'review' ? (
              /* Review Panel */
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/20">
                {/* AI Review Button and Scoring Guide */}
                <div className="sticky top-0 z-10 pb-3 bg-slate-950/20 backdrop-blur-sm space-y-2">
                  <button
                    onClick={handleReviewChapter}
                    disabled={!currentChapter?.content.trim() || isReviewing}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title={!currentChapter?.content.trim() ? '内容为空，无法审稿' : isReviewing ? 'AI 正在审稿中...' : '开始AI主编审稿'}
                  >
                    <span className={isReviewing ? 'inline-block animate-spin' : ''}>📋</span>
                    {isReviewing ? 'AI 正在审稿中...' : '开始 AI 审稿'}
                  </button>
                  <button
                    onClick={() => setShowScoringGuideModal(true)}
                    className="w-full px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/50 text-slate-300 hover:text-slate-200 rounded-lg text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    查看评分标准说明
                  </button>
                </div>

                {isReviewing ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    {/* 扫描光束动画 */}
                    <div className="relative w-32 h-32">
                      {/* 文档背景 */}
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl border-2 border-purple-500/30 backdrop-blur-sm">
                        {/* 文档线条 */}
                        <div className="absolute top-6 left-4 right-4 space-y-2">
                          <div className="h-1 bg-purple-400/30 rounded"></div>
                          <div className="h-1 bg-purple-400/30 rounded w-3/4"></div>
                          <div className="h-1 bg-purple-400/30 rounded w-5/6"></div>
                          <div className="h-1 bg-purple-400/30 rounded w-2/3"></div>
                        </div>

                        {/* 扫描光束 */}
                        <div className="absolute inset-0 overflow-hidden rounded-2xl">
                          <div className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent animate-scan-beam"></div>
                        </div>

                        {/* 数据粒子 */}
                        <div className="absolute inset-0">
                          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-cyan-400 rounded-full animate-ping"></div>
                          <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                          <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                        </div>
                      </div>

                      {/* 外圈光晕 */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 animate-pulse"></div>
                    </div>

                    <div className="text-center space-y-2">
                      <div className="text-purple-400 font-medium text-lg">AI 主编正在审稿中</div>
                      <div className="text-slate-500 text-xs">正在从多个维度分析章节质量</div>
                      <div className="flex items-center justify-center gap-1 text-cyan-400 text-xs">
                        <span className="inline-block w-1 h-1 bg-cyan-400 rounded-full animate-bounce"></span>
                        <span className="inline-block w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                        <span className="inline-block w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      </div>
                    </div>
                  </div>
                ) : chapterReview ? (
                  <div className="space-y-4">
                    {/* Overall Score with Stamp Animation */}
                    <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-4 relative overflow-hidden">
                      {/* 印章动画 */}
                      <div className="absolute top-2 right-2 animate-stamp">
                        <div className="relative w-16 h-16">
                          {/* 印章主体 */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-600 flex items-center justify-center shadow-lg">
                            <div className="text-white font-bold text-xs">已审</div>
                          </div>
                          {/* 波纹效果 */}
                          <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-stamp-ripple"></div>
                          <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-stamp-ripple" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="text-xs text-slate-400 mb-2">综合评分</div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                            {chapterReview.overallScore}
                          </div>
                          <div className="flex flex-col gap-1">
                            {/* 等级标签 */}
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                              chapterReview.overallScore >= 95 ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' :
                              chapterReview.overallScore >= 90 ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' :
                              chapterReview.overallScore >= 85 ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' :
                              chapterReview.overallScore >= 80 ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' :
                              chapterReview.overallScore >= 75 ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                              chapterReview.overallScore >= 70 ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' :
                              chapterReview.overallScore >= 65 ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white' :
                              chapterReview.overallScore >= 60 ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white' :
                              'bg-gradient-to-r from-red-600 to-red-700 text-white'
                            }`}>
                              {chapterReview.overallScore >= 95 ? '卓越' :
                               chapterReview.overallScore >= 90 ? '优秀' :
                               chapterReview.overallScore >= 85 ? '良好' :
                               chapterReview.overallScore >= 80 ? '中上' :
                               chapterReview.overallScore >= 75 ? '中等' :
                               chapterReview.overallScore >= 70 ? '中下' :
                               chapterReview.overallScore >= 65 ? '较差' :
                               chapterReview.overallScore >= 60 ? '差' : '极差'}
                            </div>
                            {/* 档次说明 */}
                            <div className="text-xs text-slate-500">
                              {chapterReview.overallScore >= 95 ? '可作范文' :
                               chapterReview.overallScore >= 90 ? '极小瑕疵' :
                               chapterReview.overallScore >= 85 ? '可改进' :
                               chapterReview.overallScore >= 80 ? '需改进' :
                               chapterReview.overallScore >= 75 ? '较大改进' :
                               chapterReview.overallScore >= 70 ? '明显问题' :
                               chapterReview.overallScore >= 65 ? '问题较多' :
                               chapterReview.overallScore >= 60 ? '严重问题' : '需重写'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowFullReportModal(true)}
                        className="w-full px-3 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/30 hover:border-purple-400/50 rounded-lg text-xs font-medium text-purple-300 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        查看完整审稿报告
                      </button>
                    </div>

                    {/* Edit Suggestions */}
                    {chapterReview.editSuggestions && chapterReview.editSuggestions.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-200">修改建议 ({chapterReview.editSuggestions.length})</h4>
                          <button
                            onClick={handleReviewChapter}
                            disabled={isReviewing}
                            className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50"
                          >
                            🔄 重新审稿
                          </button>
                        </div>
                        {chapterReview.editSuggestions.map((suggestion) => {
                          const severityColors = {
                            critical: 'border-red-500/50 bg-red-900/10',
                            major: 'border-orange-500/50 bg-orange-900/10',
                            minor: 'border-yellow-500/50 bg-yellow-900/10'
                          };
                          const severityLabels = {
                            critical: '严重',
                            major: '重要',
                            minor: '一般'
                          };
                          const categoryColors = {
                            '节奏': 'text-blue-400',
                            '对话': 'text-green-400',
                            '描写': 'text-purple-400',
                            '逻辑': 'text-red-400',
                            '文笔': 'text-amber-400',
                            '其他': 'text-slate-400'
                          };

                          return (
                            <div
                              key={suggestion.id}
                              className={`border rounded-lg p-3 transition-all ${
                                highlightedSuggestion === suggestion.id
                                  ? 'ring-2 ring-purple-500 shadow-lg'
                                  : severityColors[suggestion.severity]
                              }`}
                            >
                              {/* Header */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[suggestion.category]} bg-slate-800`}>
                                    {suggestion.category}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {severityLabels[suggestion.severity]}
                                  </span>
                                </div>
                              </div>

                              {/* Issue */}
                              <div className="text-xs text-slate-300 mb-2">
                                <span className="text-slate-500">问题：</span>{suggestion.issue}
                              </div>

                              {/* Original Text */}
                              <div className="text-xs bg-slate-900/50 rounded p-2 mb-2 border-l-2 border-red-500/50">
                                <div className="text-slate-500 mb-1">原文：</div>
                                <div className="text-slate-400 line-clamp-4">{suggestion.originalText}</div>
                              </div>

                              {/* Suggestion */}
                              <div className="text-xs text-slate-400 mb-2">
                                <span className="text-slate-500">建议：</span>{suggestion.suggestion}
                              </div>

                              {/* Replacement Text */}
                              {suggestion.replacementText && (
                                <div className="text-xs bg-slate-900/50 rounded p-2 mb-2 border-l-2 border-green-500/50">
                                  <div className="text-slate-500 mb-1">修改后：</div>
                                  <div className="text-green-400 line-clamp-4">{suggestion.replacementText}</div>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleLocateText(suggestion.originalText, suggestion.id)}
                                  disabled={isLocating}
                                  className="flex-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isLocating ? '🔍 定位中...' : '📍 定位'}
                                </button>
                                <button
                                  onClick={() => handleApplySuggestion(suggestion)}
                                  disabled={isChatting || isLocating}
                                  className="flex-1 px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-xs transition-all disabled:opacity-50"
                                >
                                  ✅ 应用
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Critical Issues */}
                    {chapterReview.criticalIssues && chapterReview.criticalIssues.length > 0 && (
                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                        <h4 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-2">
                          <span>⚠️</span> 严重问题
                        </h4>
                        <ul className="space-y-1">
                          {chapterReview.criticalIssues.map((issue, idx) => (
                            <li key={idx} className="text-xs text-red-300 flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-slate-600 text-xs py-8 italic space-y-2">
                    <p>暂无审稿报告</p>
                    <p className="text-slate-500">点击上方"开始 AI 审稿"按钮开始审稿</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Regenerate Config Modal */}
      {showRegenerateConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-amber-500/30 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-amber-400">章节配置</h2>
              <button
                onClick={() => setShowRegenerateConfig(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Author Note */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">作者备注 (本章特殊要求)</label>
                <textarea
                  value={chapterConfig.authorNote}
                  onChange={(e) => setChapterConfig(prev => ({ ...prev, authorNote: e.target.value }))}
                  placeholder="例如：本章需要埋下伏笔、注重心理描写等..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 resize-none"
                  rows={2}
                />
              </div>

              {/* Word Count */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">目标字数</label>
                <div className="flex gap-2 flex-wrap">
                  {WORD_COUNT_OPTIONS.map(option => (
                    <button
                      key={option.value ?? 'default'}
                      onClick={() => {
                        if (option.value === -1) {
                          setIsCustomWordCount(true);
                          setChapterConfig(prev => ({ ...prev, wordCount: null }));
                        } else {
                          setIsCustomWordCount(false);
                          setChapterConfig(prev => ({ ...prev, wordCount: option.value }));
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        (option.value === -1 && isCustomWordCount) ||
                        (option.value !== -1 && chapterConfig.wordCount === option.value)
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {isCustomWordCount && (
                  <input
                    type="number"
                    value={customWordCount}
                    onChange={(e) => {
                      setCustomWordCount(e.target.value);
                      const num = parseInt(e.target.value);
                      if (!isNaN(num) && num > 0) {
                        setChapterConfig(prev => ({ ...prev, wordCount: num }));
                      }
                    }}
                    placeholder="输入自定义字数"
                    className="mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                )}

                {/* AI Generate Plan Button */}
                <button
                  onClick={handleGeneratePlan}
                  disabled={isGeneratingPlan}
                  className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingPlan ? (
                    <>
                      <span className="inline-block animate-spin">⚙️</span>
                      <span>AI 生成配置中...</span>
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      <span>AI 重新生成章节配置</span>
                    </>
                  )}
                </button>
              </div>

              {/* Synopsis */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">章节梗概</label>
                <textarea
                  value={chapterConfig.synopsis}
                  onChange={(e) => setChapterConfig(prev => ({ ...prev, synopsis: e.target.value }))}
                  placeholder="简要描述本章的主要内容..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 resize-none"
                  rows={3}
                />
              </div>

              {/* Selected Characters */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">出场角色</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {settings.characters?.map(char => (
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
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        chapterConfig.selectedCharacters.includes(char.name)
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {char.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plot Points */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">剧情节点</label>
                {chapterConfig.plotPoints.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {chapterConfig.plotPoints.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-slate-800 p-3 rounded-lg">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                          point.importance === 'major' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {point.importance === 'major' ? '重点' : '略写'}
                        </span>
                        <input
                          value={point.content}
                          onChange={(e) => {
                            const updated = [...chapterConfig.plotPoints];
                            updated[idx].content = e.target.value;
                            setChapterConfig(prev => ({ ...prev, plotPoints: updated }));
                          }}
                          className="flex-1 bg-transparent text-slate-200 focus:outline-none"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const updated = [...chapterConfig.plotPoints];
                              updated[idx].importance = updated[idx].importance === 'major' ? 'minor' : 'major';
                              setChapterConfig(prev => ({ ...prev, plotPoints: updated }));
                            }}
                            className="text-xs opacity-60 hover:opacity-100"
                          >
                            ⇄
                          </button>
                          <button
                            onClick={() => setChapterConfig(prev => ({
                              ...prev,
                              plotPoints: prev.plotPoints.filter((_, i) => i !== idx)
                            }))}
                            className="text-xs opacity-60 hover:text-red-400"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newPlotPoint}
                    onChange={(e) => setNewPlotPoint(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPlotPoint.trim()) {
                        setChapterConfig(prev => ({
                          ...prev,
                          plotPoints: [...prev.plotPoints, { content: newPlotPoint, importance: 'major' }]
                        }));
                        setNewPlotPoint('');
                      }
                    }}
                    placeholder="添加剧情节点 (Enter 确认)"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRegenerateConfig(false)}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
              >
                取消
              </button>
              <button
                onClick={handleConfirmRegenerate}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-lg font-bold transition-all shadow-lg"
              >
                确认重新生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scoring Guide Modal */}
      {showScoringGuideModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-purple-500/30 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center text-2xl">
                  📊
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-200">AI 主编评分标准说明</h3>
                  <p className="text-sm text-purple-400">严格的专业编辑标准</p>
                </div>
              </div>
              <button
                onClick={() => setShowScoringGuideModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="space-y-6">
              {/* Score Ranges */}
              <div>
                <h4 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <span>🎯</span>
                  <span>分值区间定义</span>
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { range: '95-100分', level: '卓越', desc: '几乎完美，可作为范文', color: 'from-yellow-500 to-orange-500' },
                    { range: '90-94分', level: '优秀', desc: '仅有极小瑕疵', color: 'from-green-500 to-emerald-500' },
                    { range: '85-89分', level: '良好', desc: '有明显优点但存在可改进空间', color: 'from-blue-500 to-cyan-500' },
                    { range: '80-84分', level: '中上', desc: '基本达标但有较多改进空间', color: 'from-indigo-500 to-purple-500' },
                    { range: '75-79分', level: '中等', desc: '勉强及格，需要较大改进', color: 'from-purple-500 to-pink-500' },
                    { range: '70-74分', level: '中下', desc: '存在明显问题', color: 'from-orange-500 to-red-500' },
                    { range: '65-69分', level: '较差', desc: '问题较多', color: 'from-red-500 to-rose-500' },
                    { range: '60-64分', level: '差', desc: '严重问题', color: 'from-rose-500 to-red-600' },
                    { range: '<60分', level: '极差', desc: '需要重写', color: 'from-red-600 to-red-700' }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                      <div className={`w-20 h-8 bg-gradient-to-r ${item.color} rounded flex items-center justify-center text-white text-xs font-bold`}>
                        {item.range}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-slate-200">{item.level}</span>
                        <span className="text-slate-400 text-sm ml-2">- {item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <h4 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <span>📐</span>
                  <span>六大评分维度</span>
                </h4>
                <div className="space-y-3">
                  {[
                    { name: '剧情连贯性', weight: '20%', desc: '与上一章衔接、剧情推进合理性、伏笔铺垫' },
                    { name: '人物一致性', weight: '20%', desc: '角色行为符合人设、对话符合性格、避免OOC' },
                    { name: '文笔质量', weight: '20%', desc: '语言流畅、描写生动、无语病、符合文风' },
                    { name: '节奏把控', weight: '15%', desc: '叙事节奏、详略得当、高潮低谷安排' },
                    { name: '情感张力', weight: '15%', desc: '情感渲染、冲突张力、读者共鸣、爽点设置' },
                    { name: '世界观一致性', weight: '10%', desc: '符合设定、力量体系合理、细节严谨' }
                  ].map((dim, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-200">{dim.name}</span>
                        <span className="text-purple-400 text-sm font-medium">权重 {dim.weight}</span>
                      </div>
                      <p className="text-xs text-slate-400">{dim.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Principles */}
              <div>
                <h4 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <span>⚖️</span>
                  <span>评分原则</span>
                </h4>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2 text-sm text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span>采用<span className="text-purple-400 font-semibold">严格的专业编辑标准</span>，不轻易给高分</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><span className="text-blue-400 font-semibold">80分以上</span>需要有明确的优秀表现</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><span className="text-green-400 font-semibold">90分以上</span>需要接近完美，极少瑕疵</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span>发现任何明显问题都应扣分</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    <span><span className="text-amber-400 font-semibold">综合评分 = 各维度加权平均分 - 5分</span>（体现严格性）</span>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2 text-sm text-blue-300">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold mb-1">提示</p>
                    <p>本评分系统旨在帮助作者发现问题、提升质量。严格的标准能更好地激励创作进步，请理性看待评分结果。</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowScoringGuideModal(false)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Review Report Modal */}
      {showFullReportModal && chapterReview && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-purple-500/30 rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center text-2xl">
                  📋
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-200">完整审稿报告</h3>
                  <p className="text-sm text-purple-400">AI 主编全维度专业分析</p>
                </div>
              </div>
              <button
                onClick={() => setShowFullReportModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Overall Score */}
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-slate-400 mb-3">综合评分</div>
                  <div className="flex items-center gap-4">
                    <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                      {chapterReview.overallScore}
                    </div>
                    <div className="flex flex-col gap-2">
                      {/* 等级标签 */}
                      <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                        chapterReview.overallScore >= 95 ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' :
                        chapterReview.overallScore >= 90 ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' :
                        chapterReview.overallScore >= 85 ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' :
                        chapterReview.overallScore >= 80 ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' :
                        chapterReview.overallScore >= 75 ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                        chapterReview.overallScore >= 70 ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' :
                        chapterReview.overallScore >= 65 ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white' :
                        chapterReview.overallScore >= 60 ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white' :
                        'bg-gradient-to-r from-red-600 to-red-700 text-white'
                      }`}>
                        {chapterReview.overallScore >= 95 ? '卓越' :
                         chapterReview.overallScore >= 90 ? '优秀' :
                         chapterReview.overallScore >= 85 ? '良好' :
                         chapterReview.overallScore >= 80 ? '中上' :
                         chapterReview.overallScore >= 75 ? '中等' :
                         chapterReview.overallScore >= 70 ? '中下' :
                         chapterReview.overallScore >= 65 ? '较差' :
                         chapterReview.overallScore >= 60 ? '差' : '极差'}
                      </div>
                      {/* 档次说明 */}
                      <div className="text-sm text-slate-400">
                        {chapterReview.overallScore >= 95 ? '几乎完美，可作为范文' :
                         chapterReview.overallScore >= 90 ? '仅有极小瑕疵' :
                         chapterReview.overallScore >= 85 ? '有明显优点但存在可改进空间' :
                         chapterReview.overallScore >= 80 ? '基本达标但有较多改进空间' :
                         chapterReview.overallScore >= 75 ? '勉强及格，需要较大改进' :
                         chapterReview.overallScore >= 70 ? '存在明显问题' :
                         chapterReview.overallScore >= 65 ? '问题较多' :
                         chapterReview.overallScore >= 60 ? '严重问题' : '需要重写'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-6xl">
                  {chapterReview.overallScore >= 90 ? '🌟' : chapterReview.overallScore >= 80 ? '✨' : chapterReview.overallScore >= 70 ? '👍' : '📝'}
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div className="mb-6">
              <h4 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>各维度评分</span>
              </h4>
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(chapterReview.dimensions).map(([key, dim]: [string, any]) => {
                  const dimensionNames: Record<string, string> = {
                    plotCoherence: '剧情连贯性',
                    characterConsistency: '人物一致性',
                    pacing: '节奏把控',
                    writingQuality: '文笔质量',
                    emotionalImpact: '情感张力',
                    worldConsistency: '世界观一致性'
                  };
                  return (
                    <div key={key} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-300">{dimensionNames[key]}</span>
                        <span className="text-lg font-bold text-purple-400">{dim.score}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${dim.score}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{dim.feedback}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strengths */}
            {chapterReview.strengths && chapterReview.strengths.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span>✨</span>
                  <span>优点</span>
                </h4>
                <div className="space-y-2">
                  {chapterReview.strengths.map((strength, idx) => (
                    <div key={idx} className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-sm text-slate-300">
                      <span className="text-green-400 mr-2">•</span>
                      {strength}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {chapterReview.weaknesses && chapterReview.weaknesses.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>不足之处</span>
                </h4>
                <div className="space-y-2">
                  {chapterReview.weaknesses.map((weakness, idx) => (
                    <div key={idx} className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-3 text-sm text-slate-300">
                      <span className="text-orange-400 mr-2">•</span>
                      {weakness}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {chapterReview.suggestions && chapterReview.suggestions.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span>💡</span>
                  <span>改进建议</span>
                </h4>
                <div className="space-y-2">
                  {chapterReview.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-sm text-slate-300">
                      <span className="text-blue-400 mr-2">•</span>
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Issues */}
            {chapterReview.criticalIssues && chapterReview.criticalIssues.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span>🚨</span>
                  <span>严重问题</span>
                </h4>
                <div className="space-y-2">
                  {chapterReview.criticalIssues.map((issue, idx) => (
                    <div key={idx} className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-slate-300">
                      <span className="text-red-400 mr-2">•</span>
                      {issue}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Suggestions */}
            {chapterReview.editSuggestions && chapterReview.editSuggestions.length > 0 && (
              <div>
                <h4 className="text-lg font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span>✏️</span>
                  <span>具体编辑建议 ({chapterReview.editSuggestions.length})</span>
                </h4>
                <div className="text-xs text-slate-400 mb-3">点击"定位"可跳转到原文位置，点击"应用"可自动应用修改</div>
              </div>
            )}

            {/* Close Button */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowFullReportModal(false)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all"
              >
                关闭报告
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-purple-500/30 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-2xl">
                  📋
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-200">AI 主编审稿报告</h3>
                  <p className="text-sm text-purple-400">专业维度分析与改进建议</p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {isReviewing ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="inline-block animate-spin text-6xl">📋</div>
                <div className="text-purple-400 font-medium text-lg">AI 主编正在审稿中...</div>
                <div className="text-slate-500 text-sm">正在从多个维度分析章节质量</div>
              </div>
            ) : chapterReview ? (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">综合评分</div>
                      <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                        {chapterReview.overallScore}
                      </div>
                    </div>
                    <div className="text-6xl">
                      {chapterReview.overallScore >= 90 ? '🌟' : chapterReview.overallScore >= 80 ? '✨' : chapterReview.overallScore >= 70 ? '👍' : chapterReview.overallScore >= 60 ? '📝' : '⚠️'}
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <span>📊</span> 维度评分
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(chapterReview.dimensions).map(([key, value]) => {
                      const dimensionNames: Record<string, string> = {
                        plotCoherence: '剧情连贯性',
                        characterConsistency: '人物一致性',
                        pacing: '节奏把控',
                        writingQuality: '文笔质量',
                        emotionalImpact: '情感张力',
                        worldConsistency: '世界观一致性'
                      };
                      const scoreColor = value.score >= 85 ? 'text-green-400' : value.score >= 70 ? 'text-blue-400' : value.score >= 60 ? 'text-yellow-400' : 'text-red-400';
                      return (
                        <div key={key} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-300">{dimensionNames[key]}</span>
                            <span className={`text-lg font-bold ${scoreColor}`}>{value.score}</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                            <div
                              className={`h-2 rounded-full ${value.score >= 85 ? 'bg-green-500' : value.score >= 70 ? 'bg-blue-500' : value.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${value.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400">{value.feedback}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Critical Issues */}
                {chapterReview.criticalIssues && chapterReview.criticalIssues.length > 0 && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3">
                      <span>⚠️</span> 严重问题
                    </h4>
                    <ul className="space-y-2">
                      {chapterReview.criticalIssues.map((issue, idx) => (
                        <li key={idx} className="text-sm text-red-300 flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strengths */}
                {chapterReview.strengths && chapterReview.strengths.length > 0 && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-bold text-green-400 flex items-center gap-2 mb-3">
                      <span>✅</span> 优点
                    </h4>
                    <ul className="space-y-2">
                      {chapterReview.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-green-300 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weaknesses */}
                {chapterReview.weaknesses && chapterReview.weaknesses.length > 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-bold text-yellow-400 flex items-center gap-2 mb-3">
                      <span>⚡</span> 待改进
                    </h4>
                    <ul className="space-y-2">
                      {chapterReview.weaknesses.map((weakness, idx) => (
                        <li key={idx} className="text-sm text-yellow-300 flex items-start gap-2">
                          <span className="text-yellow-500 mt-0.5">•</span>
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {chapterReview.suggestions && chapterReview.suggestions.length > 0 && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-bold text-blue-400 flex items-center gap-2 mb-3">
                      <span>💡</span> 改进建议
                    </h4>
                    <ul className="space-y-2">
                      {chapterReview.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="text-sm text-blue-300 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => {
                      setShowReviewModal(false);
                      // 可以在这里添加"根据建议优化"的功能
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-bold transition-all shadow-lg"
                  >
                    继续编辑
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-12">
                审稿失败，请重试
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WritingStudio;
