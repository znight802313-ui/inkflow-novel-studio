
import React, { useState } from 'react';
import { Chapter } from '../types';

interface ReadingRoomProps {
  chapters: Chapter[];
  onChaptersUpdate: (chapters: Chapter[]) => void;
}

const ReadingRoom: React.FC<ReadingRoomProps> = ({ chapters, onChaptersUpdate }) => {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  const handleExportAll = () => {
    const fullText = chapters
      .map(c => `第${c.number}章 ${c.title}\n\n${c.content}\n\n---`)
      .join('\n\n');
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novel_export_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteChapter = (id: string) => {
    // FIX for QA Issue #3: Stronger warning about data consistency
    const confirmMsg = `⚠️ 警告：删除章节是不可逆操作。\n\n【重要提示】\n由此章节产生的“世界观设定”（如剧情摘要、人物状态更新）无法自动回滚。\n\n如果您删除了该章节，建议稍后前往“核心设定”页面手动修正剧情进度。\n\n确定要删除吗？`;
    
    if (confirm(confirmMsg)) {
      onChaptersUpdate(chapters.filter(c => c.id !== id));
      if (selectedChapter?.id === id) setSelectedChapter(null);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-300">
          已归档章节 <span className="text-sm font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{chapters.length}</span>
        </h2>
        <button
          onClick={handleExportAll}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors border border-slate-700"
        >
          📥 批量导出全书 (TXT)
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 min-h-0">
        {/* Chapter List - Fixed height with internal scroll */}
        <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col min-h-0 h-full">
          {chapters.length === 0 ? (
            <div className="p-8 text-center text-slate-600 text-sm">暂无章节内容</div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
              <div className="divide-y divide-slate-800">
                {[...chapters].reverse().map(chapter => (
                  <div
                    key={chapter.id}
                    onClick={() => setSelectedChapter(chapter)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-slate-800/50 group relative ${selectedChapter?.id === chapter.id ? 'bg-purple-600/10 border-l-2 border-purple-500' : ''}`}
                  >
                    <h4 className={`font-medium truncate ${selectedChapter?.id === chapter.id ? 'text-purple-400' : 'text-slate-300'}`}>
                      第{chapter.number}章 {chapter.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">{new Date(chapter.createdAt).toLocaleDateString()}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-opacity"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reader Display - Fixed height with internal scroll */}
        <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col min-h-0 h-full">
          {selectedChapter ? (
            <div className="flex-1 overflow-y-auto min-h-0 p-8 md:p-12" style={{ scrollbarWidth: 'thin' }}>
              <article className="max-w-2xl mx-auto space-y-8">
                <header className="text-center space-y-4">
                  <h3 className="text-3xl font-bold serif-font text-slate-200">
                    第{selectedChapter.number}章 {selectedChapter.title}
                  </h3>
                  <div className="h-1 w-20 bg-purple-600/30 mx-auto rounded-full"></div>
                </header>
                <div className="text-lg leading-loose text-slate-400 serif-font whitespace-pre-wrap">
                  {selectedChapter.content}
                </div>
              </article>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
              <div className="text-6xl mb-4">📖</div>
              <p>请选择章节进行查看</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReadingRoom;
