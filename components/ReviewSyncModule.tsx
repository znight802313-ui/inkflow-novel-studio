
import React, { useState, useEffect } from 'react';
import { NovelSettings, Chapter, AvailableModel, Character } from '../types';
import { extractWorldUpdates } from '../services/geminiService';

interface ReviewSyncModuleProps {
  settings: NovelSettings;
  pendingDraft: { title: string; content: string } | null;
  chapterNumber: number;
  onConfirmArchive: (finalChapter: Chapter, updates: Partial<NovelSettings>) => void;
  onCancel: () => void;
  setIsLoading: (loading: boolean) => void;
  model: AvailableModel;
}

const ReviewSyncModule: React.FC<ReviewSyncModuleProps> = ({
  settings,
  pendingDraft,
  chapterNumber,
  onConfirmArchive,
  onCancel,
  setIsLoading,
  model
}) => {
  // Draft State (Editable)
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  
  // Workflow Phase
  // 'initial' -> 'extracted'
  const [hasExtracted, setHasExtracted] = useState(false);
  
  // Extracted Data State
  const [syncData, setSyncData] = useState<{
    summary: string;
    newCharacters: Character[];
    updatedExistingCharacters: Character[];
    protagonistStateUpdate: string;
    worldLocationUpdate: string;
  } | null>(null);

  useEffect(() => {
    if (pendingDraft) {
      setEditedTitle(pendingDraft.title);
      setEditedContent(pendingDraft.content);
    }
  }, [pendingDraft]);

  if (!pendingDraft) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <p className="mb-4">暂无待校对的稿件</p>
        <button onClick={onCancel} className="text-purple-400 hover:underline">返回创作中心</button>
      </div>
    );
  }

  // --- Step 1: Intelligent Extraction ---
  const handleExtractInfo = async () => {
    setIsLoading(true);
    try {
      // Call API
      const { analysisRaw } = await extractWorldUpdates(editedContent, settings, model);
      
      // Auto-fix Summary format if missing
      let summary = analysisRaw.chapterSummary || '';
      if (summary && !summary.includes(`第${chapterNumber}章`) && !summary.includes(`第 ${chapterNumber} 章`)) {
          summary = `第${chapterNumber}章：${summary}`;
      }

      setSyncData({
        summary: summary,
        newCharacters: analysisRaw.newCharacters || [],
        updatedExistingCharacters: analysisRaw.updatedExistingCharacters || [],
        protagonistStateUpdate: analysisRaw.protagonistStateUpdate || '',
        worldLocationUpdate: analysisRaw.worldLocationUpdate || ''
      });
      
      setHasExtracted(true);
    } catch (e) {
      console.error(e);
      alert("信息提取失败，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 2: Auto Flow (Update Settings + Archive Chapter) ---
  const handleExecuteArchive = () => {
    // 1. Prepare Chapter Data
    const fallbackSummary = `第${chapterNumber}章：${editedTitle} - ${editedContent.substring(0, 50)}...`;

    const finalChapter: Chapter = {
      id: Date.now().toString(),
      number: chapterNumber,
      title: editedTitle,
      content: editedContent,
      summary: (syncData?.summary) ? syncData.summary : fallbackSummary,
      createdAt: Date.now()
    };

    // 2. Prepare Settings Updates
    let finalUpdates: Partial<NovelSettings> = {};
    
    if (syncData) {
       // A. Plot
       if (syncData.summary) {
           finalUpdates.currentPlotProgress = 
               (settings.currentPlotProgress || "") + `\n\n${syncData.summary}`;
       }

       // B. Characters
       let finalCharacters = [...(settings.characters || [])];
       
       // Update existing
       syncData.updatedExistingCharacters.forEach(updatedChar => {
           const index = finalCharacters.findIndex(c => c.name === updatedChar.name);
           if (index !== -1) {
               finalCharacters[index] = { ...finalCharacters[index], ...updatedChar };
           }
       });

       // Add new
       const trulyNew = syncData.newCharacters.filter(nc => 
           !finalCharacters.some(ec => ec.name === nc.name)
       );
       finalCharacters = [...finalCharacters, ...trulyNew];
       finalUpdates.characters = finalCharacters;

       // C. World/Locations
       if (syncData.worldLocationUpdate) {
           finalUpdates.background = (settings.background || "") + "\n\n[新地点/势力]: " + syncData.worldLocationUpdate;
       }
       
       // D. Protagonist/Leveling
       if (syncData.protagonistStateUpdate) {
           finalUpdates.levelingSystem = (settings.levelingSystem || "") + "\n\n[主角状态]: " + syncData.protagonistStateUpdate;
       }
    }

    // Execute Callback (App.tsx will handle the rest)
    onConfirmArchive(finalChapter, finalUpdates);
  };

  // --- UI Components ---

  const renderChangesCard = (title: string, icon: string, content: React.ReactNode, isEmpty: boolean) => (
    <div className={`rounded-xl border p-4 transition-all ${isEmpty ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-900 border-slate-700 shadow-lg'}`}>
        <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{icon}</span>
            <span className={`text-xs font-bold uppercase tracking-wider ${isEmpty ? 'text-slate-500' : 'text-slate-300'}`}>{title}</span>
            {!isEmpty && <span className="ml-auto text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">Detected</span>}
        </div>
        <div className="text-sm text-slate-400">
            {isEmpty ? <span className="text-xs italic">无明显变动</span> : content}
        </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
      
      {/* Left Panel: Chapter Preview (Always Visible) */}
      <div className={`flex-1 flex flex-col gap-4 transition-all duration-500 ${hasExtracted ? 'md:w-1/2' : 'md:w-full'}`}>
         <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
               <span>📄</span> 原文预览 
               <span className="text-xs font-mono text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">第 {chapterNumber} 章</span>
            </h2>
            <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded bg-slate-950 border border-slate-800">
               暂存返回
            </button>
         </div>

         <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col shadow-inner overflow-hidden">
             <input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="bg-transparent text-xl font-bold serif-font border-b border-slate-800 pb-3 mb-4 focus:outline-none focus:border-purple-500 transition-colors w-full"
                placeholder="章节标题"
             />
             <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="flex-1 bg-transparent text-slate-300 leading-loose text-base serif-font focus:outline-none resize-none overflow-y-auto pr-2 custom-scrollbar"
                placeholder="正文内容..."
             />
             <div className="mt-2 text-right text-[10px] text-slate-600 font-mono">
                {editedContent.length} chars
             </div>
         </div>
         
         {!hasExtracted && (
             <button 
               onClick={handleExtractInfo}
               className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-purple-900/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3"
             >
                <span className="text-2xl">✨</span>
                第一步：智能提取设定信息
             </button>
         )}
      </div>

      {/* Right Panel: Extraction Dashboard (Appears after Step 1) */}
      {hasExtracted && syncData && (
          <div className="flex-1 md:w-1/2 flex flex-col gap-4 animate-in slide-in-from-right-8 duration-500">
             <div className="flex justify-between items-center bg-green-900/10 p-3 rounded-xl border border-green-500/20">
                <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
                   <span>🤖</span> 设定变更提取
                </h2>
                <div className="text-[10px] text-green-500 font-mono flex items-center gap-1">
                   <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                   AI READY
                </div>
             </div>

             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                
                {/* 1. Plot Progress */}
                {renderChangesCard("剧情推进", "📌", (
                    <textarea 
                        value={syncData.summary}
                        onChange={(e) => setSyncData({...syncData, summary: e.target.value})}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-green-500/50 resize-none h-20"
                    />
                ), !syncData.summary)}

                {/* 2. Protagonist Leveling */}
                {renderChangesCard("主角状态/升级", "⚡", (
                    <div className="text-amber-300 font-medium bg-amber-900/20 p-2 rounded border border-amber-500/20">
                       {syncData.protagonistStateUpdate}
                    </div>
                ), !syncData.protagonistStateUpdate)}

                {/* 3. New Locations */}
                {renderChangesCard("新地点 / 世界观", "🗺️", (
                    <div className="text-blue-300 bg-blue-900/20 p-2 rounded border border-blue-500/20">
                       {syncData.worldLocationUpdate}
                    </div>
                ), !syncData.worldLocationUpdate)}

                {/* 4. Characters (New & Updated) */}
                <div className={`rounded-xl border p-4 ${(!syncData.newCharacters.length && !syncData.updatedExistingCharacters.length) ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-900 border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">👥</span>
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">人物档案变更</span>
                    </div>
                    
                    {syncData.newCharacters.map((char, i) => (
                        <div key={`new-${i}`} className="mb-2 p-2 bg-slate-950 rounded border border-green-900/50 flex flex-col gap-1">
                            <div className="flex justify-between">
                                <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                                    <span className="text-[9px] bg-green-900 px-1 rounded text-white">NEW</span>
                                    {char.name}
                                </span>
                                <span className="text-[10px] text-slate-500">{char.role}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2">{char.description}</p>
                        </div>
                    ))}

                    {syncData.updatedExistingCharacters.map((char, i) => (
                        <div key={`upd-${i}`} className="mb-2 p-2 bg-slate-950 rounded border border-amber-900/50 flex flex-col gap-1">
                             <div className="flex justify-between">
                                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                    <span className="text-[9px] bg-amber-900 px-1 rounded text-white">UPD</span>
                                    {char.name}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 italic">{char.description}</p>
                        </div>
                    ))}

                    {(!syncData.newCharacters.length && !syncData.updatedExistingCharacters.length) && (
                        <span className="text-xs italic text-slate-500">无人物变动</span>
                    )}
                </div>

             </div>

             <button 
               onClick={handleExecuteArchive}
               className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-green-900/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3"
             >
                <span className="text-2xl">📥</span>
                第二步：执行同步并归档
             </button>
          </div>
      )}

    </div>
  );
};

export default ReviewSyncModule;
