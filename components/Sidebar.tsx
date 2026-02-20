
import React, { useState, useRef, useEffect } from 'react';
import { AppViews, AvailableModel, MODEL_GROUPS } from '../types';
import { useCloudBaseAuth } from '../contexts/CloudBaseAuthContext';

interface SidebarProps {
  currentView: AppViews;
  setView: (view: AppViews) => void;
  selectedModel: AvailableModel;
  onModelChange: (model: AvailableModel) => void;
  onBackToProjects: () => void;
  onBackToHome: () => void;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  onManualSync: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  selectedModel,
  onModelChange,
  onBackToProjects,
  onBackToHome,
  isSyncing,
  lastSyncTime,
  onManualSync
}) => {
  const { user } = useCloudBaseAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isSigningOut, setIsSigningOut] = useState(false);

  // Handle switch account
  const handleSwitchAccount = () => {
    if (confirm('切换账号将返回登录页面，确定继续吗?')) {
      // Clear custom user info from localStorage
      localStorage.removeItem('inkflow_custom_user');
      // Navigate to login page
      onBackToHome();
    }
  };

  // Import signOut function
  const handleSignOut = async () => {
    if (confirm('确定要退出登录吗?')) {
      setIsSigningOut(true);

      // Clear custom user info from localStorage
      localStorage.removeItem('inkflow_custom_user');

      const { auth } = await import('../lib/cloudbase');
      if (auth) {
        await auth.signOut();
      }

      // Show loading for a moment before reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const menuItems = [
    { id: AppViews.WORLD, icon: '🌍', label: '核心设定' },
    { id: AppViews.WRITING, icon: '✍️', label: '章节创作' },
    { id: AppViews.REVIEW, icon: '⚖️', label: '校对归档' },
    { id: AppViews.READING, icon: '📚', label: '阅览归档' },
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
    <>
      {/* Sign Out Loading Overlay */}
      {isSigningOut && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/30 via-purple-500/30 to-blue-500/30 blur-3xl animate-pulse" />

            {/* Main content */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 border-2 border-amber-500/30 rounded-3xl p-12 shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-6">
              {/* Spinner */}
              <div className="flex justify-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-500 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse" />
                  <div className="relative animate-spin rounded-full h-16 w-16 border-4 border-transparent bg-gradient-to-r from-amber-500 via-purple-500 to-blue-500 bg-clip-border" style={{
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    padding: '4px'
                  }}></div>
                </div>
              </div>

              {/* Text */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold bg-gradient-to-r from-amber-200 via-purple-200 to-blue-200 bg-clip-text text-transparent">
                  正在退出登录
                </h3>
                <p className="text-sm text-slate-400">
                  即将返回首页...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="w-20 md:w-64 backdrop-blur-2xl bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 border-r border-amber-500/20 flex flex-col py-8 px-4 gap-8 z-50 overflow-y-auto relative sidebar-scrollbar">
      {/* Enhanced gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/8 via-purple-600/8 to-blue-600/8 pointer-events-none" />

      {/* Ambient glow effects */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-purple-600/5 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-2 mb-8 group cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onBackToHome}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 rounded-xl blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shadow-2xl">
              <img src="/logo-new.png" alt="晨曦遗墨" className="w-full h-full object-cover" />
            </div>
          </div>
          <span className="hidden md:block font-bold text-xl tracking-tight bg-gradient-to-r from-amber-300 via-purple-300 to-indigo-300 bg-clip-text text-transparent">
            晨曦遗墨
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`group relative flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ${
                currentView === item.id
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active Background */}
              {currentView === item.id && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-600 rounded-xl" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500 rounded-xl blur-xl opacity-50" />
                </>
              )}

              {/* Hover Background */}
              {currentView !== item.id && (
                <div className="absolute inset-0 backdrop-blur-xl bg-slate-800/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              )}

              <span className="relative text-xl">{item.icon}</span>
              <span className="relative hidden md:block font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

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
          <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top max-h-[calc(100vh-280px)] overflow-y-auto dropdown-scrollbar">
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
        <div className="hidden md:block backdrop-blur-xl bg-slate-900/60 rounded-xl p-3 border border-amber-500/20 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-amber-500 via-purple-600 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
              📁
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">项目管理</p>
              <p className="text-[10px] text-amber-400/70">Project Manager</p>
            </div>
            {isSyncing && (
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-500 border-t-transparent"></div>
            )}
          </div>
          <button
            onClick={onBackToProjects}
            className="w-full mt-2 py-1.5 px-3 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-amber-400 rounded-lg text-xs transition-all border border-slate-700/50 hover:border-amber-500/30"
          >
            切换项目
          </button>
          {lastSyncTime && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="w-full mt-2 py-1.5 px-3 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-amber-400 rounded-lg text-xs transition-all border border-slate-700/50 hover:border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? '同步中...' : '手动同步'}
            </button>
          )}
        </div>
      )}

      {/* Account Management */}
      <div className="mt-auto hidden md:block">
        {user ? (
          <div className="backdrop-blur-xl bg-slate-900/60 rounded-xl p-3 border border-amber-500/20 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 via-purple-600 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                {user.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{user.username}</p>
                <p className="text-[10px] text-amber-400/70">云端账号</p>
              </div>
            </div>
            <button
              onClick={handleSwitchAccount}
              className="w-full mt-2 py-1.5 px-3 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-purple-400 rounded-lg text-xs transition-all border border-slate-700/50 hover:border-purple-500/30"
            >
              切换账号
            </button>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full mt-2 py-1.5 px-3 backdrop-blur-sm bg-slate-900/50 hover:bg-slate-800/50 text-slate-300 hover:text-amber-400 rounded-lg text-xs transition-all border border-slate-700/50 hover:border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? '退出中...' : '退出登录'}
            </button>
          </div>
        ) : (
          <div className="backdrop-blur-xl bg-slate-900/60 rounded-xl p-3 border border-amber-500/20 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-xs shadow-lg">
                💾
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">本地存储模式</p>
                <p className="text-[10px] text-amber-400/70">数据仅保存在本地</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm('切换到云端登录模式?\n\n当前本地数据不会丢失,登录后可以创建新项目或导入数据。')) {
                  localStorage.removeItem('inkflow_use_local_mode');
                  window.location.reload();
                }
              }}
              className="w-full mt-2 py-1.5 px-3 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 hover:from-amber-400 hover:via-purple-500 hover:to-blue-500 text-white rounded-lg text-xs transition-all shadow-lg"
            >
              切换到云端登录
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pb-4 hidden md:block">
        <div className="backdrop-blur-xl bg-slate-900/60 rounded-xl p-3 border border-amber-500/20 text-[10px] text-slate-400 space-y-2 shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 font-medium">System Status</span>
            <span className="text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              Online
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent w-full"></div>
          <div className="flex justify-between items-center opacity-70">
            <span>Version</span>
            <span className="text-purple-400 font-medium">v1.4.0-flow</span>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
