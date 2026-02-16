
import React, { useState, useEffect } from 'react';
import { NovelSettings, Chapter, AppViews, AvailableModel, DEFAULT_NOVEL_SETTINGS, MODEL_OPTIONS } from './types';
import { useCloudBaseAuth } from './contexts/CloudBaseAuthContext';
import LoginForm from './components/Auth/LoginForm';
import ProjectManager from './components/ProjectManager';
import Sidebar from './components/Sidebar';
import WorldBuilding from './components/WorldBuilding';
import WritingStudio from './components/WritingStudio';
import ReviewSyncModule from './components/ReviewSyncModule';
import ReadingRoom from './components/ReadingRoom';
import SettingsView from './components/SettingsView';
import { getActiveProject, createProject, getProjectData } from './services/cloudbaseProjectService';
import { syncProjectToCloud, syncProjectFromCloud } from './services/cloudbaseSyncService';

const STORAGE_KEY = 'inkflow_novel_data';
const DRAFT_STORAGE_KEY = 'inkflow_current_draft';

const App: React.FC = () => {
  const { user, loading: authLoading, isConfigured } = useCloudBaseAuth();

  const [settings, setSettings] = useState<NovelSettings>(DEFAULT_NOVEL_SETTINGS);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentView, setCurrentView] = useState<AppViews>(AppViews.WORLD);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AvailableModel>('[次]gemini-3-pro-preview-thinking');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);

  // State to hold the draft moving from Writing -> Review
  const [pendingDraft, setPendingDraft] = useState<{title: string, content: string} | null>(null);

  // Check if user is logged in and has selected a project
  useEffect(() => {
    if (authLoading) return;

    if (isConfigured && user) {
      // User is logged in - check if they have selected a project
      if (!currentProjectId) {
        setShowProjectManager(true);
      }
    }
  }, [user, authLoading, isConfigured, currentProjectId]);

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
    if (!user || !currentProjectId) return;

    const timeoutId = setTimeout(() => {
      autoSync();
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [settings, chapters, user, currentProjectId]);

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
    try {
      const { settings: cloudSettings, chapters: cloudChapters, error } = await getProjectData(projectId);

      if (error) {
        console.error('Error loading project data:', error);
        return;
      }

      if (cloudSettings) {
        setSettings(cloudSettings);
      } else {
        setSettings(DEFAULT_NOVEL_SETTINGS);
      }
      setChapters(cloudChapters);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error loading from cloud:', error);
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
    setCurrentProjectId(projectId);
    setShowProjectManager(false);
  };

  // Handle project change from Sidebar
  const handleProjectChange = async (projectId: string) => {
    setCurrentProjectId(projectId);
    await loadProjectFromCloud(projectId);
  };

  const handleUpdateSettings = (newSettings: Partial<NovelSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleAddChapter = (chapter: Chapter) => {
    setChapters(prev => [...prev, chapter]);
  };

  const handleImportData = (data: { settings: NovelSettings, chapters: Chapter[], selectedModel: AvailableModel }) => {
    const mergedSettings: NovelSettings = {
      ...DEFAULT_NOVEL_SETTINGS,
      ...data.settings,
      characters: Array.isArray(data.settings?.characters) ? data.settings.characters : [],
      tags: Array.isArray(data.settings?.tags) ? data.settings.tags : [],
    };

    setSettings(mergedSettings);
    setChapters(Array.isArray(data.chapters) ? data.chapters : []);

    const validModels = MODEL_OPTIONS.map(m => m.id);
    if (data.selectedModel && validModels.includes(data.selectedModel)) {
      setSelectedModel(data.selectedModel);
    } else {
      setSelectedModel('[次]gemini-3-pro-preview-thinking');
    }

    setCurrentView(AppViews.WORLD);
  };

  const handleProceedToReview = (draft: { title: string; content: string }) => {
    setPendingDraft(draft);
    setCurrentView(AppViews.REVIEW);
  };

  const handleConfirmArchive = (finalChapter: Chapter, updates: Partial<NovelSettings>) => {
    if (Object.keys(updates).length > 0) {
       handleUpdateSettings(updates);
    }

    handleAddChapter(finalChapter);

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  // Show login screen if Supabase is configured but user not logged in
  // Skip login if Supabase is configured but not accessible (network issue)
  if (isConfigured && !user) {
    return <LoginForm onSuccess={() => window.location.reload()} />;
  }

  // Show project manager if logged in but no project selected
  if (user && showProjectManager) {
    return <ProjectManager onSelectProject={handleProjectSelect} />;
  }

  // Show main app
  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
      <Sidebar
        currentView={currentView}
        setView={setCurrentView}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        currentProjectId={currentProjectId}
        onProjectChange={handleProjectChange}
        onProjectCreate={(projectId) => {
          setCurrentProjectId(projectId);
          loadProjectFromCloud(projectId);
        }}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onManualSync={manualSync}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative p-6 md:p-10">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
          <header className="mb-8 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
                {settings.title || '新小说项目'}
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
                pendingDraft={pendingDraft}
                chapterNumber={chapters.length + 1}
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
            {currentView === AppViews.SETTINGS && (
              <SettingsView
                settings={settings}
                chapters={chapters}
                selectedModel={selectedModel}
                onImport={handleImportData}
                user={user}
                onManualSync={manualSync}
                isSyncing={isSyncing}
                lastSyncTime={lastSyncTime}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
