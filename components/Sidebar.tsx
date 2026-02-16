
import React, { useState, useRef, useEffect } from 'react';
import { AppViews, AvailableModel, MODEL_GROUPS } from '../types';
import { useCloudBaseAuth } from '../contexts/CloudBaseAuthContext';
import ProjectSelector from './ProjectSelector';

interface SidebarProps {
  currentView: AppViews;
  setView: (view: AppViews) => void;
  selectedModel: AvailableModel;
  onModelChange: (model: AvailableModel) => void;
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  onProjectCreate: (projectId: string) => void;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  onManualSync: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  selectedModel,
  onModelChange,
  currentProjectId,
  onProjectChange,
  onProjectCreate,
  isSyncing,
  lastSyncTime,
  onManualSync
}) => {
  const { user } = useCloudBaseAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Import signOut function
  const handleSignOut = async () => {
    if (confirm('确定要退出登录吗?')) {
      // Clear custom user info from localStorage
      localStorage.removeItem('inkflow_custom_user');

      const { auth } = await import('../lib/cloudbase');
      if (auth) {
        await auth.signOut();
      }

      // Reload to show login page
      window.location.reload();
    }
  };

  const menuItems = [
    { id: AppViews.WORLD, icon: '🌍', label: '核心设定' },
    { id: AppViews.WRITING, icon: '✍️', label: '章节创作' },
    { id: AppViews.REVIEW, icon: '⚖️', label: '校对归档' },
    { id: AppViews.READING, icon: '📚', label: '阅览归档' },
    { id: AppViews.SETTINGS, icon: '⚙️', label: '备份管理' },
  ];

  // Find selected model info
  const getSelectedModelInfo = () => {
    for (const [provider, models] of Object.entries(MODEL_GROUPS)) {
      const model = models.find(m => m.id === selectedModel);
      if (model) {
        return { provider, model };
      }
    }
    return { provider: 'Claude', model: MODEL_GROUPS.Claude[0] };
  };

  const { provider: selectedProvider, model: selectedModelInfo } = getSelectedModelInfo();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setExpandedProvider(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const providerIcons: Record<string, string> = {
    Claude: '🤖',
    Gemini: '💎',
    Grok: '⚡',
    Kimi: '🌙',
    DeepSeek: '🔍'
  };

  return (
    <aside className="w-20 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col py-8 px-4 gap-8 z-50 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-purple-900/20">
          🖋️
        </div>
        <span className="hidden md:block font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          InkFlow
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ${
              currentView === item.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="hidden md:block font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Model Selection Dropdown */}
      <div className="mt-2 hidden md:block relative" ref={dropdownRef}>
        <div className="flex items-center justify-between px-3 mb-2">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            模型引擎
          </h3>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
        </div>

        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border transition-all duration-300 ${
            isDropdownOpen ? 'border-purple-500/50 ring-2 ring-purple-500/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{providerIcons[selectedProvider]}</span>
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-slate-200">{selectedProvider} {selectedModelInfo.label}</span>
              <span className="text-[9px] text-purple-400 opacity-80">{selectedModelInfo.badge}</span>
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu with Groups */}
        {isDropdownOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top max-h-[calc(100vh-280px)] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 #1e293b' }}>
            <div className="p-1">
              {Object.entries(MODEL_GROUPS).map(([provider, models]) => (
                <div key={provider} className="mb-0.5">
                  {/* Provider Header */}
                  <button
                    onClick={() => setExpandedProvider(expandedProvider === provider ? null : provider)}
                    className="w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{providerIcons[provider]}</span>
                      <span className="text-xs font-bold text-slate-300">{provider}</span>
                      <span className="text-[9px] text-slate-600">({models.length})</span>
                    </div>
                    <svg
                      className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedProvider === provider ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Models List */}
                  {expandedProvider === provider && (
                    <div className="ml-3 mt-0.5 space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            onModelChange(m.id);
                            setIsDropdownOpen(false);
                            setExpandedProvider(null);
                          }}
                          className={`w-full flex flex-col p-1.5 rounded-lg text-left transition-colors ${
                            selectedModel === m.id
                              ? 'bg-purple-600/10 text-purple-400'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{m.label}</span>
                            {selectedModel === m.id && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] opacity-60 uppercase tracking-tighter">{m.category}</span>
                            <span className="text-[9px] px-1 bg-slate-950 border border-slate-800 rounded text-slate-500">{m.badge}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project Management (only show if logged in) */}
      {user && (
        <div className="hidden md:block">
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              项目管理
            </h3>
            {isSyncing && (
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-500 border-t-transparent"></div>
            )}
          </div>
          <ProjectSelector
            currentProjectId={currentProjectId}
            onProjectChange={onProjectChange}
            onProjectCreate={onProjectCreate}
          />
          {lastSyncTime && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="w-full mt-2 flex items-center justify-center gap-2 p-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>🔄</span>
              <span>{isSyncing ? '同步中...' : '手动同步'}</span>
            </button>
          )}
        </div>
      )}

      {/* Account Management */}
      <div className="hidden md:block px-3 mb-4">
        {user ? (
          <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                {user.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{user.username}</p>
                <p className="text-[10px] text-slate-500">云端账号</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full mt-2 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
            >
              退出登录
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs">
                💾
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">本地存储模式</p>
                <p className="text-[10px] text-slate-500">数据仅保存在本地</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm('切换到云端登录模式?\n\n当前本地数据不会丢失,登录后可以创建新项目或导入数据。')) {
                  localStorage.removeItem('inkflow_use_local_mode');
                  window.location.reload();
                }
              }}
              className="w-full mt-2 py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs transition-colors"
            >
              切换到云端登录
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-auto p-4 hidden md:block">
        <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50 text-[10px] text-slate-500 space-y-2">
          <div className="flex justify-between items-center">
            <span>System Status</span>
            <span className="text-green-500">Online</span>
          </div>
          <div className="h-px bg-slate-800 w-full"></div>
          <div className="flex justify-between items-center opacity-60">
            <span>Version</span>
            <span>v1.4.0-flow</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
