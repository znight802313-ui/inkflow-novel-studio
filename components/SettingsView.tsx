
import React, { useRef, useState } from 'react';
import { NovelSettings, Chapter, AvailableModel } from '../types';
import { useCloudBaseAuth } from '../contexts/CloudBaseAuthContext';

interface SettingsViewProps {
  settings: NovelSettings;
  chapters: Chapter[];
  selectedModel: AvailableModel;
  onImport: (data: { settings: NovelSettings, chapters: Chapter[], selectedModel: AvailableModel }) => void;
  user: any;
  onManualSync: () => void;
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  chapters,
  selectedModel,
  onImport,
  user,
  onManualSync,
  isSyncing,
  lastSyncTime
}) => {
  const { signOut } = useCloudBaseAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<{
    isImporting: boolean;
    progress: number;
    stage: string;
  }>({ isImporting: false, progress: 0, stage: '' });

  const handleExport = () => {
    const backupData = {
      settings,
      chapters,
      selectedModel,
      exportDate: new Date().toISOString(),
      version: '1.4.0'
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = `InkFlow_Backup_${settings.title.replace(/\s+/g, '_') || 'Project'}_${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const updateProgress = (progress: number, stage: string) => {
    setImportState(prev => ({ ...prev, progress, stage }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    // Always reset input to allow re-selecting the same file if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRestore = () => {
    if (!selectedFile) return;

    setImportState({ isImporting: true, progress: 0, stage: '准备读取文件...' });

    const reader = new FileReader();
    
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        // Limit read progress to 30% of total visual progress
        const percent = Math.round((event.loaded / event.total) * 30);
        updateProgress(percent, '正在读取备份数据...');
      }
    };

    reader.onload = async (event) => {
      try {
        updateProgress(40, '解析数据结构...');
        await new Promise(r => setTimeout(r, 600)); // Minimal delay for UX

        const jsonStr = event.target?.result as string;
        updateProgress(60, '验证数据完整性...');
        
        let json;
        try {
            json = JSON.parse(jsonStr);
        } catch (e) {
            throw new Error('JSON Parse Error');
        }
        await new Promise(r => setTimeout(r, 400));

        // Validation: Ensure settings object exists
        if (json && typeof json === 'object' && json.settings) {
          updateProgress(80, '正在恢复世界观与章节...');
          await new Promise(r => setTimeout(r, 500));
          
          updateProgress(100, '完成！');
          setTimeout(() => {
            alert('🎉 数据恢复成功！所有模块已更新至最新状态。');
            onImport({
              settings: json.settings,
              chapters: Array.isArray(json.chapters) ? json.chapters : [],
              selectedModel: json.selectedModel || 'gemini-3-pro-preview'
            });
            // Component likely unmounts here, but we reset state just in case
            setImportState({ isImporting: false, progress: 0, stage: '' });
            setSelectedFile(null);
          }, 400);
        } else {
          throw new Error('Invalid schema: Missing settings');
        }
      } catch (err) {
        console.error('Import failed', err);
        setImportState({ isImporting: false, progress: 0, stage: '' });
        alert('❌ 文件解析失败：请确保上传的是 InkFlow 导出的标准 JSON 备份文件。');
      }
    };
    
    reader.onerror = () => {
        setImportState({ isImporting: false, progress: 0, stage: '' });
        alert('读取文件出错');
    };

    reader.readAsText(selectedFile);
  };

  const handleClearData = () => {
    if (confirm('警告：此操作将永久删除当前设备上的所有本地数据。请确保您已经导出了备份。确定要清空吗？')) {
      localStorage.removeItem('inkflow_novel_data');
      window.location.reload();
    }
  };

  return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 relative pb-20" style={{ scrollbarWidth: 'thin' }}>
      {/* File Confirmation Modal */}
      {selectedFile && !importState.isImporting && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-4 text-amber-400">
               <div className="w-12 h-12 bg-amber-400/10 rounded-full flex items-center justify-center text-2xl">
                 ⚠️
               </div>
               <div>
                 <h3 className="font-bold text-lg text-slate-200">确认还原备份？</h3>
                 <p className="text-xs text-amber-400/80">此操作不可撤销</p>
               </div>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">已选文件</p>
              <p className="font-mono text-sm text-slate-300 truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-600 mt-1">{(selectedFile.size / 1024).toFixed(2)} KB</p>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              即将从该文件恢复数据。注意：当前应用内的所有<b className="text-slate-200">设定、章节和进度</b>都将被覆盖。
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedFile(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
              >
                取消
              </button>
              <button 
                onClick={startRestore}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-900/20"
              >
                确认恢复
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Overlay */}
      {importState.isImporting && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 transition-all duration-300">
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-full mx-auto flex items-center justify-center animate-bounce shadow-lg shadow-indigo-600/50">
              <span className="text-2xl">📥</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-wide">{importState.stage}</h3>
            
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 transition-all duration-300 ease-out relative"
                style={{ width: `${importState.progress}%` }}
              >
                 <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <p className="text-indigo-300 font-mono text-sm">{importState.progress}%</p>
          </div>
        </div>
      )}

      {/* Account Management Section (only show if logged in) */}
      {user && (
        <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm shadow-xl">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <span>账号管理</span>
          </h2>

          <div className="space-y-4">
            {/* User Info */}
            <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm text-slate-400">登录邮箱</p>
                <p className="text-slate-200 font-medium">{user.email}</p>
              </div>
              <button
                onClick={async () => {
                  if (confirm('确定要登出吗?\n\n登出后将返回登录界面,本地数据会保留。')) {
                    await signOut();
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/30 rounded-xl text-sm font-semibold transition-all"
              >
                登出
              </button>
            </div>

            {/* Sync Status */}
            <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex-1">
                <p className="text-sm text-slate-400">云端同步状态</p>
                <p className="text-slate-200 font-medium">
                  {isSyncing ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-500 border-t-transparent"></div>
                      同步中...
                    </span>
                  ) : lastSyncTime ? (
                    `最后同步: ${lastSyncTime.toLocaleString('zh-CN')}`
                  ) : (
                    '未同步'
                  )}
                </p>
              </div>
              <button
                onClick={onManualSync}
                disabled={isSyncing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                    <span>同步中</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>立即同步</span>
                  </>
                )}
              </button>
            </div>

            {/* Info Note */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-xs text-blue-400 leading-relaxed">
                💡 提示: 数据会自动同步到云端。您可以在任何设备登录相同账号访问您的所有项目。
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm shadow-xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <span>备份与跨设备迁移</span>
        </h2>
        
        <p className="text-slate-400 mb-8 leading-relaxed">
          InkFlow 使用本地存储保存您的创作内容。为了确保您的作品安全，或者需要在不同设备间同步进度，
          请定期导出备份文件。您可以将导出的 JSON 文件通过微信、云盘或 U 盘传输，并在新设备上点击“还原备份”即可无缝衔接。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Card */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center group hover:border-purple-500/30 transition-all">
            <div className="w-16 h-16 bg-purple-600/10 rounded-full flex items-center justify-center text-3xl mb-4 text-purple-400 group-hover:scale-110 transition-transform">
              📤
            </div>
            <h3 className="font-bold text-slate-200 mb-2">生成完整备份</h3>
            <p className="text-xs text-slate-500 mb-6">包含书名、核心设定、所有章节内容及 AI 模型配置</p>
            <button 
              onClick={handleExport}
              disabled={importState.isImporting || !!selectedFile}
              className="mt-auto w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
            >
              立即导出 (.json)
            </button>
          </div>

          {/* Import Card */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center group hover:border-indigo-500/30 transition-all">
            <div className="w-16 h-16 bg-indigo-600/10 rounded-full flex items-center justify-center text-3xl mb-4 text-indigo-400 group-hover:scale-110 transition-transform">
              📥
            </div>
            <h3 className="font-bold text-slate-200 mb-2">还原备份文件</h3>
            <p className="text-xs text-slate-500 mb-6">从之前导出的文件恢复整个创作进度</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".json" 
              className="hidden" 
            />
            <button 
              onClick={handleImportClick}
              disabled={importState.isImporting || !!selectedFile}
              className="mt-auto w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold border border-slate-700 transition-all disabled:opacity-50"
            >
              选取备份文件
            </button>
          </div>
        </div>
      </section>

      <section className="bg-slate-900/40 border border-red-900/20 rounded-3xl p-8 backdrop-blur-sm shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-red-400 flex items-center gap-3">
          <span>⚠️</span>
          <span>危险区域</span>
        </h2>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h4 className="font-bold text-slate-300">清空工作空间</h4>
            <p className="text-sm text-slate-500">重置所有设定并删除所有本地存储的章节。此操作不可逆。</p>
          </div>
          <button 
            onClick={handleClearData}
            disabled={importState.isImporting || !!selectedFile}
            className="px-6 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          >
            彻底清空所有数据
          </button>
        </div>
      </section>

      <div className="text-center text-slate-600 text-[10px] space-y-1">
        <p>数据完全存储在您的浏览器本地，InkFlow 不会上传您的任何创作原稿到私有云端。</p>
        <p>© 2024 InkFlow AI Web Novel Architect. All Rights Reserved.</p>
      </div>
    </div>
  );
};

export default SettingsView;
