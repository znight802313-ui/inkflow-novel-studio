
import React, { useState, useEffect } from 'react';
import { NovelSettings, Character, AvailableModel, Chapter } from '../types';
import { generateWorldBuilding, syncPlotBatch, generateCoverImage, extractWritingStyle } from '../services/geminiService';

/* --- Helper Components for the aesthetic layout --- */

interface CardProps {
  children: React.ReactNode;
  icon: string;
  title: string;
  action?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, icon, title, action }) => (
  <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 backdrop-blur-sm shadow-xl hover:shadow-purple-900/5 transition-all duration-300">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 tracking-widest uppercase">
        <span className="text-xl filter drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">{icon}</span>
        {title}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

const InputField: React.FC<{ label: string, value: string, onChange: (v: string) => void, placeholder?: string }> = ({ label, value, onChange, placeholder = "" }) => (
  <div className="flex-1">
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
    />
  </div>
);

const TextAreaField: React.FC<{ label: string, value: string, onChange: (v: string) => void, rows: number, placeholder?: string, className?: string, badge?: string }> = ({ label, value, onChange, rows, placeholder = "", className = "", badge }) => (
  <div>
    <div className="flex justify-between items-center mb-2 ml-1">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        {badge && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">{badge}</span>}
    </div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={`w-full bg-slate-950/40 border border-slate-800 rounded-2xl px-4 py-3 text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-y ${className}`}
    />
  </div>
);

interface WorldBuildingProps {
  settings: NovelSettings;
  chapters: Chapter[];
  onUpdate: (settings: Partial<NovelSettings>) => void;
  setIsLoading: (loading: boolean) => void;
  model: AvailableModel;
}

const WorldBuilding: React.FC<WorldBuildingProps> = ({ settings, chapters, onUpdate, setIsLoading, model }) => {
  const [idea, setIdea] = useState('');
  
  // States for Sync Workflow
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncDetailLog, setSyncDetailLog] = useState<string>(''); // For detailed progress text
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncConfirmData, setSyncConfirmData] = useState<{ 
    missingChapters: Chapter[], 
    lastSyncedNum: number 
  } | null>(null);

  // State for Cover Generation
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  // State for Writing Style Extraction
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [styleInputMode, setStyleInputMode] = useState<'file' | 'text' | 'title'>('file');
  const [styleInputText, setStyleInputText] = useState('');

  const handleAIGenerate = async () => {
    if (!idea.trim()) return;
    setIsLoading(true);
    try {
      const result = await generateWorldBuilding(
        idea,
        model,
        settings.novelType,
        settings.targetTotalWords,
        settings.targetChapterCount
      );
      onUpdate(result);
    } catch (e) {
      console.error(e);
      alert('AI 生成失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCover = async () => {
    if (!settings.title) {
      alert("请先设置小说标题");
      return;
    }
    setIsGeneratingCover(true);
    try {
      const base64Image = await generateCoverImage(settings);
      onUpdate({ coverImage: base64Image });
    } catch (e) {
      console.error(e);
      alert('封面生成失败，请检查网络或重试');
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Handle file upload for writing style extraction
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type (accept .txt files)
    if (!file.name.endsWith('.txt')) {
      alert('请上传 .txt 格式的文本文件');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('文件大小不能超过 5MB');
      return;
    }

    setIsExtractingStyle(true);
    setUploadedFileName(file.name);

    try {
      const text = await file.text();
      const styleGuide = await extractWritingStyle(text, model);

      // Append to existing authorNote or replace
      const currentNote = settings.authorNote || '';
      const separator = currentNote ? '\n\n--- 文风参考 ---\n' : '';
      onUpdate({ authorNote: currentNote + separator + styleGuide });

      alert('文风提炼完成！已自动添加到 AI 创作指南中。');
    } catch (e) {
      console.error(e);
      alert('文风提炼失败，请检查网络或重试');
    } finally {
      setIsExtractingStyle(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Handle text/title input for style extraction
  const handleStyleExtraction = async () => {
    if (!styleInputText.trim()) {
      alert('请输入内容');
      return;
    }

    setIsExtractingStyle(true);

    try {
      let textToAnalyze = styleInputText;

      // If mode is 'title', ask AI to provide sample text based on the book title
      if (styleInputMode === 'title') {
        textToAnalyze = `请根据小说《${styleInputText}》的风格特点，生成一段该小说的典型文本样本（约500字），用于文风分析。`;
      }

      const styleGuide = await extractWritingStyle(textToAnalyze, model);

      // Append to existing authorNote
      const currentNote = settings.authorNote || '';
      const separator = currentNote ? '\n\n--- 文风参考 ---\n' : '';
      onUpdate({ authorNote: currentNote + separator + styleGuide });

      alert('文风提炼完成！已自动添加到 AI 创作指南中。');
      setStyleInputText('');
    } catch (e) {
      console.error(e);
      alert('文风提炼失败，请检查网络或重试');
    } finally {
      setIsExtractingStyle(false);
    }
  };

  // Step 1: Check Logic
  const handleCheckSync = () => {
    if (chapters.length === 0) {
      alert("归档阅览室中暂无章节，无法同步。");
      return;
    }

    // Identify last synced chapter
    const plotText = settings.currentPlotProgress || "";
    const matches = [...plotText.matchAll(/第(\d+)章/g)];
    let lastSyncedNum = 0;
    
    if (matches.length > 0) {
      const numbers = matches.map(m => parseInt(m[1], 10));
      lastSyncedNum = Math.max(...numbers);
    }

    // Find missing
    const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);
    const missingChapters = sortedChapters.filter(c => c.number > lastSyncedNum);

    if (missingChapters.length === 0) {
      alert(`当前剧情进度已是最新（检测到已包含第 ${lastSyncedNum} 章内容）。`);
      return;
    }

    // Trigger Confirmation Modal instead of alert
    setSyncConfirmData({ missingChapters, lastSyncedNum });
  };

  // Step 2: Execute Logic
  const handleExecuteSync = async () => {
    if (!syncConfirmData) return;
    const { missingChapters } = syncConfirmData;
    
    // Close confirm modal, Open progress modal
    setSyncConfirmData(null); 
    setSyncStatus('正在初始化同步进程...');
    setSyncDetailLog('准备数据包...');
    setSyncProgress(2);

    // Simulate detailed steps while waiting for API
    const steps = [
      "正在读取章节文本...",
      "正在构建上下文窗口...",
      `正在上传 ${missingChapters.length} 个章节至 Gemini 智库...`,
      "AI 正在深度阅读并分析剧情...",
      "正在提取关键剧情钩子...",
      "正在扫描新登场人物实体...",
      "正在合并世界观变动...",
      "正在生成最终同步补丁..."
    ];
    
    let stepIndex = 0;
    const intervalId = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + (Math.random() * 3);
      });
      
      // Update detailed log
      if (stepIndex < steps.length && Math.random() > 0.3) {
         setSyncDetailLog(steps[stepIndex]);
         stepIndex++;
      }
    }, 800);
    
    try {
      // API Call
      const contentToAnalyze = missingChapters.map(c => `=== 第 ${c.number} 章：${c.title} ===\n${c.content}`).join("\n\n");
      const updates = await syncPlotBatch(contentToAnalyze, settings, model);
      
      clearInterval(intervalId);
      setSyncProgress(100);
      setSyncStatus('同步完成！');
      setSyncDetailLog('正在写入本地数据库...');

      await new Promise(r => setTimeout(r, 800)); // Smooth finish
      
      onUpdate(updates);
    } catch (e) {
      console.error(e);
      clearInterval(intervalId);
      alert("同步失败，请检查网络或稍后重试。");
    } finally {
      setSyncStatus(null);
      setSyncProgress(0);
      setSyncDetailLog('');
    }
  };

  const updateField = (field: keyof NovelSettings, value: any) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="h-full overflow-y-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-700 pb-20 relative" style={{ scrollbarWidth: 'thin' }}>
      
      {/* 1. Confirmation Modal */}
      {syncConfirmData && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95">
             <div className="flex items-center gap-4 text-purple-400">
               <div className="w-12 h-12 bg-purple-400/10 rounded-full flex items-center justify-center text-2xl">
                 📋
               </div>
               <div>
                 <h3 className="font-bold text-lg text-slate-200">检测到剧情更新</h3>
                 <p className="text-xs text-purple-400/80">需要同步到沙盘</p>
               </div>
             </div>
             
             <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
               <div className="flex justify-between text-sm">
                 <span className="text-slate-500">当前进度</span>
                 <span className="text-slate-300">第 {syncConfirmData.lastSyncedNum} 章</span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-slate-500">最新归档</span>
                 <span className="text-slate-300">第 {syncConfirmData.missingChapters[syncConfirmData.missingChapters.length-1].number} 章</span>
               </div>
               <div className="h-px bg-slate-800 my-1"></div>
               <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">待同步章节数</span>
                  <span className="text-xl font-bold text-green-400">{syncConfirmData.missingChapters.length} <span className="text-xs font-normal text-slate-500">章</span></span>
               </div>
             </div>

             <p className="text-sm text-slate-400 leading-relaxed">
               系统将分析这 {syncConfirmData.missingChapters.length} 章的内容，自动提取剧情摘要并更新人物档案。
             </p>

             <div className="flex gap-3">
               <button 
                 onClick={() => setSyncConfirmData(null)}
                 className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
               >
                 暂不同步
               </button>
               <button 
                 onClick={handleExecuteSync}
                 className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-green-900/20"
               >
                 开始同步
               </button>
             </div>
           </div>
        </div>
      )}

      {/* 2. Progress Modal */}
      {syncStatus && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-200">
             
             {/* Spinner Icon */}
             <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full animate-pulse"></div>
                <div className="relative w-16 h-16 bg-slate-950 border border-green-500/30 rounded-full flex items-center justify-center text-2xl">
                   <span className="animate-spin text-3xl">🔄</span>
                </div>
             </div>
             
             {/* Text Status */}
             <div className="text-center space-y-1 w-full">
                <h3 className="text-lg font-bold text-white tracking-wide">{syncStatus}</h3>
                {/* Detailed Log Line */}
                <p className="text-xs text-slate-400 font-mono h-4 overflow-hidden">{syncDetailLog}</p>
             </div>

             {/* Progress Bar */}
             <div className="w-full space-y-2">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                    <div 
                        className="h-full bg-gradient-to-r from-green-600 to-emerald-400 transition-all duration-300 ease-out relative"
                        style={{ width: `${syncProgress}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono tracking-widest">
                   <span>PROCESSING</span>
                   <span>{Math.round(syncProgress)}%</span>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* AI Creative Generator - Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 p-8 md:p-10 space-y-6">
          <div className="max-w-3xl">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">灵感火花</span>
              <span className="text-xs font-normal text-purple-400/60 tracking-widest uppercase px-2 py-0.5 border border-purple-500/30 rounded-full">AI Engine</span>
            </h3>
            <p className="text-slate-400 mb-6 text-sm md:text-base leading-relaxed">
              只需提供一个核心点子，AI将为您构建完整的世界雏形、力量体系及核心冲突。
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="例如：'赛博朋克背景下的修仙者...'"
                  className="w-full bg-slate-950/60 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all shadow-inner"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">
                  ⌘ K
                </div>
              </div>
              <button
                onClick={handleAIGenerate}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap"
              >
                构建世界观
              </button>
            </div>
          </div>

          {/* 小说类型与目标配置 - 嵌入到灵感火花内部 */}
          <div className="max-w-3xl pt-6 border-t border-slate-700/50">
            <div className="space-y-5">
              {/* 小说类型选择 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">小说类型与目标</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateField('novelType', 'long')}
                    className={`flex-1 px-4 py-2.5 rounded-xl border transition-all ${
                      (settings.novelType || 'long') === 'long'
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-950/40 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    长篇小说
                  </button>
                  <button
                    onClick={() => updateField('novelType', 'short')}
                    className={`flex-1 px-4 py-2.5 rounded-xl border transition-all ${
                      settings.novelType === 'short'
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-950/40 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    短篇小说
                  </button>
                </div>
              </div>

              {/* 目标配置 */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">目标总字数</label>
                  <input
                    type="number"
                    value={settings.targetTotalWords || ''}
                    onChange={(e) => updateField('targetTotalWords', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder={settings.novelType === 'short' ? "例如：30000" : "例如：1000000"}
                    min="5000"
                    max="10000000"
                    className="w-full bg-slate-950/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/40 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">目标章节数</label>
                  <input
                    type="number"
                    value={settings.targetChapterCount || ''}
                    onChange={(e) => updateField('targetChapterCount', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder={settings.novelType === 'short' ? "例如：10" : "例如：300"}
                    min="3"
                    max="10000"
                    className="w-full bg-slate-950/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/40 transition-all"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 italic">
                {settings.novelType === 'short'
                  ? '💡 短篇模式：AI 会根据目标字数和章节数自动规划剧情节奏，在最后一章自动收尾'
                  : '💡 长篇模式：设置目标可帮助 AI 更好地规划剧情节奏和章节安排'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Core Identity & Narrative */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Section: Basic Identity with Cover Image */}
          <Card icon="🔖" title="身份标识与封面">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Left: Inputs */}
              <div className="flex-1 space-y-5">
                <InputField label="作品书名" value={settings.title} onChange={(v) => updateField('title', v)} placeholder="输入书名..." />
                <InputField label="小说风格" value={settings.style} onChange={(v) => updateField('style', v)} placeholder="玄幻、科幻、同人..." />

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">核心标签</label>
                  <input
                    value={settings.tags.join(', ')}
                    onChange={(e) => updateField('tags', e.target.value.split(',').map(t => t.trim()))}
                    placeholder="单女主, 无敌流, 学院..."
                    className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Right: Cover Image Area */}
              <div className="w-full sm:w-40 flex flex-col gap-2 shrink-0">
                <div className="aspect-[3/4] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden relative group">
                   {settings.coverImage ? (
                     <img src={settings.coverImage} alt="Book Cover" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 p-2 text-center">
                       <span className="text-2xl mb-2">🖼️</span>
                       <span className="text-[10px]">暂无封面</span>
                     </div>
                   )}
                   {isGeneratingCover && (
                     <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center backdrop-blur-sm">
                       <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
                     </div>
                   )}
                </div>
                <button 
                  onClick={handleGenerateCover}
                  disabled={isGeneratingCover}
                  className="w-full py-2 bg-slate-800 hover:bg-purple-600/20 text-xs font-bold text-slate-300 hover:text-purple-300 border border-slate-700 hover:border-purple-500/30 rounded-lg transition-all"
                >
                  {isGeneratingCover ? '绘制中...' : '🎨 AI 生成封面'}
                </button>
              </div>
            </div>
            
            {/* Visual Prompt Editor (Collapsible style) */}
            <div className="mt-6 pt-4 border-t border-slate-800/50">
               <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">封面设计灵感 (Prompt)</label>
               <textarea
                 value={settings.coverVisualPrompt || ''}
                 onChange={(e) => updateField('coverVisualPrompt', e.target.value)}
                 rows={2}
                 placeholder="AI 会根据设定自动填写此处，您也可以手动修改英文 Prompt 以调整封面风格..."
                 className="w-full bg-slate-950/20 border border-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-purple-500/30 resize-none"
               />
            </div>
          </Card>

          {/* Section: Writing Style Guide (NEW) */}
          <Card icon="🎭" title="文风与笔调 (AI 设定)">
            <div className="space-y-4">
              <TextAreaField
                  label="AI 创作/扮演指南"
                  value={settings.authorNote || ''}
                  onChange={(v) => updateField('authorNote', v)}
                  rows={4}
                  placeholder="例如：请使用暗黑流风格，主角杀伐果断；多用短句，减少心理描写，注重动作和画面感..."
                  badge="影响所有AI生成"
                />

              {/* Style Extraction Section */}
              <div className="pt-4 border-t border-slate-800/50">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">
                  📚 文风提炼
                </label>

                {/* Mode Selection Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setStyleInputMode('file')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      styleInputMode === 'file'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    📄 上传文件
                  </button>
                  <button
                    onClick={() => setStyleInputMode('text')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      styleInputMode === 'text'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    ✍️ 粘贴文本
                  </button>
                  <button
                    onClick={() => setStyleInputMode('title')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      styleInputMode === 'title'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    📖 输入书名
                  </button>
                </div>

                {/* File Upload Mode */}
                {styleInputMode === 'file' && (
                  <div className="space-y-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept=".txt"
                        onChange={handleFileUpload}
                        disabled={isExtractingStyle}
                        className="hidden"
                      />
                      <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all ${
                        isExtractingStyle
                          ? 'bg-purple-500/5 border-purple-500/30 cursor-not-allowed'
                          : 'bg-slate-950/40 border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5'
                      }`}>
                        {isExtractingStyle ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                            <span className="text-sm text-purple-400">正在分析文风...</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">📄</span>
                            <span className="text-sm text-slate-400">点击上传 .txt 文件</span>
                          </>
                        )}
                      </div>
                    </label>
                    <p className="text-xs text-slate-600 ml-1">
                      💡 上传参考小说（.txt 格式，最大 5MB）
                    </p>
                  </div>
                )}

                {/* Text Input Mode */}
                {styleInputMode === 'text' && (
                  <div className="space-y-2">
                    <textarea
                      value={styleInputText}
                      onChange={(e) => setStyleInputText(e.target.value)}
                      placeholder="粘贴小说原文片段（建议 500-2000 字）..."
                      rows={6}
                      disabled={isExtractingStyle}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-y"
                    />
                    <button
                      onClick={handleStyleExtraction}
                      disabled={isExtractingStyle || !styleInputText.trim()}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isExtractingStyle ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>正在分析...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>开始提炼文风</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Title Input Mode */}
                {styleInputMode === 'title' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={styleInputText}
                      onChange={(e) => setStyleInputText(e.target.value)}
                      placeholder="输入热门小说书名，如：《斗破苍穹》、《诡秘之主》..."
                      disabled={isExtractingStyle}
                      className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                    />
                    <button
                      onClick={handleStyleExtraction}
                      disabled={isExtractingStyle || !styleInputText.trim()}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isExtractingStyle ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>正在分析...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>开始提炼文风</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-600 ml-1">
                      💡 AI 将根据书名分析该小说的典型文风特征
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Section: Core Concept */}
          <Card icon="🔮" title="核心卖点">
            <div className="space-y-6">
              <TextAreaField 
                label="金手指 / 核心设定" 
                value={settings.goldFinger} 
                onChange={(v) => updateField('goldFinger', v)} 
                rows={3} 
                placeholder="描述主角最核心的特殊能力或系统..."
              />
              <TextAreaField 
                label="内容简介" 
                value={settings.synopsis} 
                onChange={(v) => updateField('synopsis', v)} 
                rows={6} 
                placeholder="吸引读者的故事主线摘要..."
                className="serif-font"
              />
            </div>
          </Card>

          {/* Section: Progress Tracking */}
          <Card icon="📈" title="剧情沙盘 (自动追加)" action={
            <button
               onClick={handleCheckSync}
               disabled={!!syncStatus}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
               <span>🔄</span>
               检测并同步
            </button>
          }>
            <TextAreaField 
              label="当前剧情阶段" 
              value={settings.currentPlotProgress} 
              onChange={(v) => updateField('currentPlotProgress', v)} 
              rows={8} 
              badge="AUTO-SYNC"
              placeholder="目前主角正在做什么？处于哪个小高潮？（本区域会随章节归档自动追加最新进展）"
            />
          </Card>
        </div>

        {/* Right Column: World Rules & Inhabitants */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Section: World Rules */}
          <Card icon="🗺️" title="世界法则 (动态演化)">
            <div className="space-y-6">
              <TextAreaField 
                label="升级 / 战力体系" 
                value={settings.levelingSystem} 
                onChange={(v) => updateField('levelingSystem', v)} 
                rows={8}
                badge="AUTO-UPDATE" 
                placeholder="练气、筑基、金丹... 或其它独特的等级划分"
              />
              <TextAreaField 
                label="世界地理与背景" 
                value={settings.background} 
                onChange={(v) => updateField('background', v)} 
                rows={8} 
                badge="AUTO-UPDATE" 
                placeholder="地理环境、势力分布、历史底蕴..."
              />
            </div>
          </Card>

          {/* Section: Characters */}
          <Card icon="👥" title="群像志 (动态更新)" action={
             <button 
                onClick={() => updateField('characters', [...settings.characters, { name: '', role: '', description: '', relationToProtagonist: '' }])}
                className="text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-500/20 transition-all"
              >
                + 手动添加
              </button>
          }>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {settings.characters.length === 0 ? (
                <div className="text-center py-10 text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-2xl">
                  暂无登场人物，随章节创作自动添加
                </div>
              ) : (
                settings.characters.map((char, idx) => (
                  <div key={idx} className="group relative bg-slate-950/60 p-4 rounded-2xl border border-slate-800 hover:border-purple-500/30 transition-all">
                    <button 
                      onClick={() => updateField('characters', settings.characters.filter((_, i) => i !== idx))}
                      className="absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input 
                        placeholder="姓名"
                        value={char.name}
                        onChange={(e) => {
                          const newChars = settings.characters.map((c, i) => 
                            i === idx ? { ...c, name: e.target.value } : c
                          );
                          updateField('characters', newChars);
                        }}
                        className="bg-transparent border-b border-slate-800 focus:border-purple-500 focus:outline-none text-sm font-bold text-slate-200 py-1"
                      />
                      <input 
                        placeholder="身份/称号"
                        value={char.role}
                        onChange={(e) => {
                          const newChars = settings.characters.map((c, i) => 
                            i === idx ? { ...c, role: e.target.value } : c
                          );
                          updateField('characters', newChars);
                        }}
                        className="bg-transparent border-b border-slate-800 focus:border-purple-500 focus:outline-none text-sm text-slate-400 py-1"
                      />
                    </div>
                    <textarea 
                      placeholder="人物性格及与主角关系..."
                      value={char.description + (char.relationToProtagonist ? ` [${char.relationToProtagonist}]` : "")}
                      rows={3}
                      onChange={(e) => {
                        const newChars = settings.characters.map((c, i) => 
                          i === idx ? { ...c, description: e.target.value, relationToProtagonist: '' } : c
                        );
                        updateField('characters', newChars);
                      }}
                      className="w-full bg-slate-900/50 rounded-lg p-2 text-xs text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500/30 resize-none"
                    />
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorldBuilding;
