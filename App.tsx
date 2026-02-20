
import React, { useState, useEffect } from 'react';
import { NovelSettings, Chapter, AppViews, AvailableModel, DEFAULT_NOVEL_SETTINGS, MODEL_OPTIONS } from './types';
import { useCloudBaseAuth } from './contexts/CloudBaseAuthContext';
import PremiumHomePage from './components/PremiumHomePage';
import LoginForm from './components/Auth/LoginForm';
import ProjectManager from './components/ProjectManager';
import Sidebar from './components/Sidebar';
import WorldBuilding from './components/WorldBuilding';
import WritingStudio from './components/WritingStudio';
import ReviewSyncModule from './components/ReviewSyncModule';
import ReadingRoom from './components/ReadingRoom';
import { getActiveProject, createProject, getProjectData } from './services/cloudbaseProjectService';
import { syncProjectToCloud, syncProjectFromCloud } from './services/cloudbaseSyncService';
import { compressPlotSandbox } from './services/geminiService';

const STORAGE_KEY = 'inkflow_novel_data';
const DRAFT_STORAGE_KEY = 'inkflow_current_draft';

const App: React.FC = () => {
  const { user, loading: authLoading, isConfigured } = useCloudBaseAuth();

  const [settings, setSettings] = useState<NovelSettings>(DEFAULT_NOVEL_SETTINGS);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentView, setCurrentView] = useState<AppViews>(AppViews.WORLD);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AvailableModel>('claude-sonnet-4-5-20250929');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectTitle, setCurrentProjectTitle] = useState<string>('新小说项目');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false); // 添加加载标志
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showHomePage, setShowHomePage] = useState(true); // 添加首页显示标志
  const [isTransitioning, setIsTransitioning] = useState(false); // 页面切换加载状态
  const [isLoadingHomePage, setIsLoadingHomePage] = useState(false); // 首页加载状态

  // State to hold the draft moving from Writing -> Review
  const [pendingDraft, setPendingDraft] = useState<{title: string, content: string, chapterNumber: number} | null>(null);

  // Check if user is logged in and has selected a project
  useEffect(() => {
    if (authLoading) return;

    // Only auto-show project manager after login, not when user manually navigates to home
    if (isConfigured && user && !currentProjectId && !showHomePage && !showProjectManager) {
      // User just logged in, show project manager
      setShowProjectManager(true);
    }
  }, [user, authLoading, isConfigured, currentProjectId, showHomePage, showProjectManager]);

  // Load project data when project is selected
  useEffect(() => {
    if (!currentProjectId) return;

    if (user) {
      // Load from cloud
      loadProjectFromCloud(currentProjectId);
    }
  }, [currentProjectId, user]);

  // Auto-sync when data changes (debounced)
  useEffect(() => {
    if (!user || !currentProjectId || isLoadingProject) return; // 加载项目时不自动同步

    console.log('[AUTO-SYNC] Triggered by data change, will sync in 2s');
    console.log('[AUTO-SYNC] Current settings:', settings);
    console.log('[AUTO-SYNC] isLoadingProject:', isLoadingProject);

    const timeoutId = setTimeout(async () => {
      console.log('[AUTO-SYNC] Executing sync now...');
      await autoSync(); // Add await to ensure Promise completes
    }, 2000); // Increased to 2000ms to avoid CloudBase DuplicateWrite error

    return () => {
      console.log('[AUTO-SYNC] Cancelled (cleanup)');
      clearTimeout(timeoutId);
    };
  }, [settings, chapters, user, currentProjectId, isLoadingProject]);

  // Load data from localStorage on mount (local mode)
  useEffect(() => {
    if (authLoading) return;
    if (isConfigured || user) return;

    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        if (data.settings) {
          setSettings({ ...DEFAULT_NOVEL_SETTINGS, ...data.settings });
        }
        if (data.chapters) {
          setChapters(data.chapters);
        }
        if (data.selectedModel) {
          setSelectedModel(data.selectedModel);
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    }
  }, [isConfigured, user, authLoading]);

  // Save to localStorage when data changes (local mode only)
  useEffect(() => {
    if (isConfigured && user) return; // Skip if using cloud mode

    const dataToSave = {
      settings,
      chapters,
      selectedModel,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [settings, chapters, selectedModel, isConfigured, user]);

  const loadProjectFromCloud = async (projectId: string) => {
    console.log('[LOAD-PROJECT] Starting to load project:', projectId);
    try {
      setIsLoadingProject(true); // 开始加载,暂停自动同步
      console.log('[LOAD-PROJECT] Set isLoadingProject = true');

      // Get project info first
      const { getProjects } = await import('./services/cloudbaseProjectService');
      const { data: projects } = await getProjects();
      const currentProject = projects?.find(p => p._id === projectId);

      if (currentProject) {
        setCurrentProjectTitle(currentProject.title);
      }

      const { settings: cloudSettings, chapters: cloudChapters, error } = await getProjectData(projectId);

      if (error) {
        console.error('[LOAD-PROJECT] Error loading project data:', error);
        return;
      }

      console.log('[LOAD-PROJECT] Loaded settings from cloud:', cloudSettings);
      console.log('[LOAD-PROJECT] Loaded chapters count:', cloudChapters?.length);

      if (cloudSettings) {
        setSettings(cloudSettings);
      } else {
        console.warn('[LOAD-PROJECT] No settings found, using defaults');
        setSettings(DEFAULT_NOVEL_SETTINGS);
      }
      setChapters(cloudChapters);
      setLastSyncTime(new Date());

      // 延迟5秒后再启用自动同步,确保状态完全稳定
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('[LOAD-PROJECT] Finished loading, waited 5s before enabling auto-sync');
    } catch (error) {
      console.error('[LOAD-PROJECT] Error loading from cloud:', error);
    } finally {
      setIsLoadingProject(false); // 加载完成,恢复自动同步
      console.log('[LOAD-PROJECT] Set isLoadingProject = false');
    }
  };

  // Auto-sync to cloud
  const autoSync = async () => {
    if (!user || !currentProjectId || isSyncing) return;

    try {
      setIsSyncing(true);
      await syncProjectToCloud(currentProjectId, settings, chapters);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Auto-sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual sync
  const manualSync = async () => {
    if (!user || !currentProjectId) return;

    setIsSyncing(true);
    const result = await syncProjectToCloud(currentProjectId, settings, chapters);
    setIsSyncing(false);

    if (result.error) {
      alert('同步失败: ' + result.error.message);
    } else {
      setLastSyncTime(new Date());
      alert('✅ 同步成功!');
    }
  };

  // Handle project selection from ProjectManager
  const handleProjectSelect = async (projectId: string) => {
    setIsTransitioning(true);

    // Save current project data before switching
    if (currentProjectId && user) {
      await syncProjectToCloud(currentProjectId, settings, chapters);
    }

    setCurrentProjectId(projectId);
    setShowProjectManager(false);

    // Load the new project's data
    await loadProjectFromCloud(projectId);

    setIsTransitioning(false);
  };

  // Handle project change from Sidebar
  const handleProjectChange = async (projectId: string) => {
    setIsTransitioning(true);

    // Save current project data before switching
    if (currentProjectId && user) {
      await syncProjectToCloud(currentProjectId, settings, chapters);
    }

    setCurrentProjectId(projectId);
    await loadProjectFromCloud(projectId);

    setIsTransitioning(false);
  };

  const handleUpdateSettings = (newSettings: Partial<NovelSettings>) => {
    console.log('handleUpdateSettings called with:', newSettings);
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      console.log('Updated settings:', updated);
      return updated;
    });
  };

  // Handle navigation to home page with loading state
  const handleBackToHome = async () => {
    // First, hide project manager
    setShowProjectManager(false);

    // Show loading state
    setIsLoadingHomePage(true);

    // Simulate minimum loading time for smooth transition
    await new Promise(resolve => setTimeout(resolve, 300));

    // Show home page
    setShowHomePage(true);

    // Clear loading state after a short delay
    setTimeout(() => {
      setIsLoadingHomePage(false);
    }, 100);
  };

  const handleAddChapter = (chapter: Chapter) => {
    setChapters(prev => [...prev, chapter]);
  };

  const handleProceedToReview = (draft: { title: string; content: string }) => {
    // Calculate the next chapter number
    const nextChapterNumber = chapters.length + 1;

    setPendingDraft({
      ...draft,
      chapterNumber: nextChapterNumber
    });

    // Create a temporary chapter and save it immediately
    const tempChapter: Chapter = {
      id: `temp-${Date.now()}`,
      number: nextChapterNumber,
      title: draft.title,
      content: draft.content,
      summary: '',
      createdAt: Date.now()
    };

    console.log('Creating temporary chapter with number:', nextChapterNumber);

    // Add to chapters array (will trigger auto-sync)
    handleAddChapter(tempChapter);

    setCurrentView(AppViews.REVIEW);
  };

  const handleConfirmArchive = (finalChapter: Chapter, updates: Partial<NovelSettings>) => {
    console.log('Archiving chapter with number:', finalChapter.number);
    console.log('Current chapters count:', chapters.length);

    // 直接使用传入的 updates（已包含压缩后的剧情沙盘）
    if (Object.keys(updates).length > 0) {
       handleUpdateSettings(updates);
    }

    // Update the existing chapter instead of adding a new one
    setChapters(prev => {
      const existingIndex = prev.findIndex(ch => ch.number === finalChapter.number);
      console.log('Found existing chapter at index:', existingIndex);

      if (existingIndex >= 0) {
        // Update existing chapter
        const updated = [...prev];
        updated[existingIndex] = finalChapter;
        console.log('Updated chapter at index', existingIndex);
        return updated;
      } else {
        // Add new chapter if not found (fallback)
        console.log('No existing chapter found, adding new one');
        return [...prev, finalChapter];
      }
    });

    setPendingDraft(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem('inkflow_current_instruction');

    const newCharCount = (updates.characters?.length || 0) - (settings.characters?.length || 0);
    const msg = `✅ 归档完成!\n\n• 剧情沙盘已更新\n• 新增人物: ${Math.max(0, newCharCount)} 人\n• 章节已存入阅览室`;
    alert(msg);

    setCurrentView(AppViews.WRITING);
  };

  // Show loading screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Starry background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(2px 2px at 20% 30%, white, transparent),
                             radial-gradient(2px 2px at 60% 70%, white, transparent),
                             radial-gradient(1.5px 1.5px at 50% 50%, white, transparent),
                             radial-gradient(1.5px 1.5px at 80% 10%, white, transparent),
                             radial-gradient(2px 2px at 90% 60%, white, transparent)`,
            backgroundSize: '200px 200px, 300px 300px, 250px 250px, 400px 400px, 350px 350px',
            backgroundPosition: '0 0, 40px 60px, 130px 270px, 70px 100px, 200px 150px',
            opacity: 0.4
          }} />
        </div>

        {/* Animated orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 rounded-2xl blur-xl opacity-50 animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-amber-500/30">
                <img src="/logo-new.png" alt="晨曦遗墨" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* Spinner */}
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-500 border-r-purple-600 animate-spin"></div>
            </div>
          </div>

          {/* Text */}
          <p className="text-slate-300 text-lg font-medium mb-2">加载中</p>
          <p className="text-slate-500 text-sm">正在初始化应用...</p>
        </div>
      </div>
    );
  }

  // Show loading screen when navigating to home page
  if (isLoadingHomePage) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Starry background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(2px 2px at 20% 30%, white, transparent),
                             radial-gradient(2px 2px at 60% 70%, white, transparent),
                             radial-gradient(1.5px 1.5px at 50% 50%, white, transparent),
                             radial-gradient(1.5px 1.5px at 80% 10%, white, transparent),
                             radial-gradient(2px 2px at 90% 60%, white, transparent)`,
            backgroundSize: '200px 200px, 300px 300px, 250px 250px, 400px 400px, 350px 350px',
            backgroundPosition: '0 0, 40px 60px, 130px 270px, 70px 100px, 200px 150px',
            opacity: 0.4
          }} />
        </div>

        {/* Animated orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 rounded-2xl blur-xl opacity-50 animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-amber-500/30">
                <img src="/logo-new.png" alt="晨曦遗墨" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* Spinner */}
          <div className="relative mb-6">
            <div className="w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-500 border-r-purple-600 animate-spin"></div>
            </div>
          </div>

          {/* Text */}
          <p className="text-slate-300 text-lg font-medium mb-2">返回首页</p>
          <p className="text-slate-500 text-sm">正在加载...</p>
        </div>
      </div>
    );
  }

  // Show home page if home page is visible (for both logged in and not logged in users)
  if (showHomePage) {
    return (
      <PremiumHomePage
        onGetStarted={() => {
          if (user) {
            // If logged in, go to project manager
            setShowHomePage(false);
            setShowProjectManager(true);
          } else if (isConfigured) {
            // If not logged in but CloudBase configured, show login page
            setShowHomePage(false);
          } else {
            // If not configured, just hide home page and show main app
            setShowHomePage(false);
          }
        }}
        projects={[]}
        onSelectProject={() => {}}
      />
    );
  }

  // Show login screen if CloudBase is configured but user not logged in
  if (isConfigured && !user && !showHomePage) {
    return <LoginForm
      onSuccess={() => {
        // After login, user state will be updated automatically by CloudBaseAuthContext
        // The useEffect will then show project manager
        setIsLoadingHomePage(true);
        // Give a moment for the auth context to update
        setTimeout(() => {
          setIsLoadingHomePage(false);
        }, 500);
      }}
      onBackToHome={handleBackToHome}
    />;
  }

  // Show project manager if logged in but no project selected
  if (user && showProjectManager && !isLoadingHomePage) {
    return <ProjectManager
      onSelectProject={handleProjectSelect}
      onBackToHome={handleBackToHome}
    />;
  }

  // Show main app
  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
      {/* Transitioning overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            {/* Logo */}
            <div className="mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 rounded-2xl blur-xl opacity-50 animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-amber-500/30">
                  <img src="/logo-new.png" alt="晨曦遗墨" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            {/* Spinner */}
            <div className="relative mb-6">
              <div className="w-12 h-12 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-500 border-r-purple-600 animate-spin"></div>
              </div>
            </div>

            {/* Text */}
            <p className="text-slate-300 text-base font-medium mb-1">切换项目中</p>
            <p className="text-slate-500 text-sm">正在加载项目数据...</p>
          </div>
        </div>
      )}

      <Sidebar
        currentView={currentView}
        setView={setCurrentView}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onBackToProjects={() => setShowProjectManager(true)}
        onBackToHome={handleBackToHome}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onManualSync={manualSync}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative p-6 md:p-10">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
          <header className="mb-8 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
                {currentProjectTitle}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-400 text-sm">
                  {currentView === AppViews.WORLD ? '世界观与核心设定' :
                   currentView === AppViews.WRITING ? '创作工作室' :
                   currentView === AppViews.REVIEW ? '校对与归档中心' :
                   currentView === AppViews.READING ? '归档阅览室' : '系统管理与备份'}
                </p>
                <span className="text-slate-600">•</span>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                  {selectedModel}
                </span>
                {user && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-500">
                      {isSyncing ? '同步中...' : lastSyncTime ? `已同步 ${lastSyncTime.toLocaleTimeString('zh-CN')}` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-purple-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-400 border-t-transparent"></div>
                <span className="text-sm font-medium">AI 正在思考...</span>
              </div>
            )}
          </header>

          <div className="flex-1 min-h-0">
            {currentView === AppViews.WORLD && (
              <WorldBuilding
                settings={settings}
                chapters={chapters}
                onUpdate={handleUpdateSettings}
                setIsLoading={setIsLoading}
                model={selectedModel}
              />
            )}
            {currentView === AppViews.WRITING && (
              <WritingStudio
                settings={settings}
                chapters={chapters}
                onProceedToReview={handleProceedToReview}
                onUpdateSettings={handleUpdateSettings}
                setIsLoading={setIsLoading}
                model={selectedModel}
              />
            )}
            {currentView === AppViews.REVIEW && (
              <ReviewSyncModule
                settings={settings}
                chapters={chapters}
                pendingDraft={pendingDraft}
                chapterNumber={pendingDraft?.chapterNumber || chapters.length + 1}
                onConfirmArchive={handleConfirmArchive}
                onCancel={() => setCurrentView(AppViews.WRITING)}
                setIsLoading={setIsLoading}
                model={selectedModel}
              />
            )}
            {currentView === AppViews.READING && (
              <ReadingRoom
                chapters={chapters}
                onChaptersUpdate={setChapters}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
