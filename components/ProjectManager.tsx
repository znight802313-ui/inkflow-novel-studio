import React, { useState } from 'react';
import { Project } from '../services/cloudbaseProjectService';
import { getProjects, createProject, switchProject, deleteProject, renameProject, importProject } from '../services/cloudbaseProjectService';
import { getProjectData } from '../services/cloudbaseProjectService';
import { NovelSettings, Chapter } from '../types';

interface ProjectManagerProps {
  onSelectProject: (projectId: string) => void;
  onBackToHome?: () => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ onSelectProject, onBackToHome }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showImportExportMenu, setShowImportExportMenu] = useState(false);
  const [importingFile, setImportingFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState({ stage: '', progress: 0 });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const { data, error } = await getProjects();
    setLoading(false);

    if (!error && data) {
      setProjects(data);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) {
      alert('请输入项目名称');
      return;
    }

    setLoading(true);
    const { data, error } = await createProject(newProjectTitle);
    setLoading(false);

    if (error) {
      alert('创建项目失败: ' + error.message);
      return;
    }

    if (data) {
      console.log('Project created:', data);
      console.log('data._id:', data._id);

      setProjects(prev => [data, ...prev]);
      setShowCreateModal(false);
      setNewProjectTitle('');

      // Automatically select the new project
      if (data._id) {
        await switchProject(data._id);
        onSelectProject(data._id);
      } else {
        console.error('Created project has no _id:', data);
        alert('项目创建成功,但无法自动打开。请手动选择项目。');
      }
    }
  };

  const handleSelectProject = async (projectId: string) => {
    console.log('handleSelectProject called with:', projectId, 'type:', typeof projectId);

    if (!projectId) {
      alert('项目 ID 无效');
      return;
    }

    setLoading(true);
    const { error } = await switchProject(projectId);
    setLoading(false);

    if (error) {
      alert('切换项目失败: ' + error.message);
      return;
    }

    onSelectProject(projectId);
  };

  const handleDeleteProject = async (projectId: string, projectTitle: string) => {
    if (!confirm(`确定要删除项目"${projectTitle}"吗?\n\n此操作将永久删除该项目的所有数据。`)) {
      return;
    }

    setLoading(true);
    const { error } = await deleteProject(projectId);
    setLoading(false);

    if (error) {
      alert('删除项目失败: ' + error.message);
      return;
    }

    setProjects(prev => prev.filter(p => p._id !== projectId));
  };

  const handleRenameProject = async (projectId: string) => {
    if (!editTitle.trim()) {
      alert('请输入项目名称');
      return;
    }

    setLoading(true);
    const { error } = await renameProject(projectId, editTitle);
    setLoading(false);

    if (error) {
      alert('重命名失败: ' + error.message);
      return;
    }

    setProjects(prev => prev.map(p =>
      p._id === projectId ? { ...p, title: editTitle } : p
    ));
    setEditingProject(null);
    setEditTitle('');
  };

  const handleExportProject = async (projectId: string, projectTitle: string) => {
    try {
      setLoading(true);
      const { settings, chapters, error } = await getProjectData(projectId);
      setLoading(false);

      if (error) {
        alert('导出失败: ' + error.message);
        return;
      }

      const backupData = {
        settings,
        chapters,
        exportDate: new Date().toISOString(),
        version: '1.5.0'
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileName = `晨曦遗墨_${projectTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setLoading(false);
      alert('导出失败: ' + error.message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportingFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportProject = async () => {
    if (!importingFile) return;

    setImportProgress({ stage: '读取文件...', progress: 10 });

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        setImportProgress({ stage: '解析数据...', progress: 30 });
        const jsonStr = event.target?.result as string;
        const json = JSON.parse(jsonStr);

        if (!json || !json.settings) {
          throw new Error('无效的备份文件格式');
        }

        setImportProgress({ stage: '创建项目...', progress: 50 });

        const title = json.settings.title || '导入的项目';
        const { data, error } = await importProject(title, json.settings, json.chapters || []);

        if (error) {
          throw new Error(error.message);
        }

        setImportProgress({ stage: '完成!', progress: 100 });

        setTimeout(() => {
          setImportingFile(null);
          setImportProgress({ stage: '', progress: 0 });
          loadProjects();
          alert('✅ 项目导入成功!');
        }, 500);
      } catch (error: any) {
        setImportingFile(null);
        setImportProgress({ stage: '', progress: 0 });
        alert('❌ 导入失败: ' + error.message);
      }
    };

    reader.onerror = () => {
      setImportingFile(null);
      setImportProgress({ stage: '', progress: 0 });
      alert('读取文件失败');
    };

    reader.readAsText(importingFile);
  };

  if (loading && projects.length === 0) {
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
          <p className="text-slate-300 text-lg font-medium mb-2">加载项目中</p>
          <p className="text-slate-500 text-sm">正在获取您的作品列表...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Starry Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large bright stars */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(2px 2px at 20% 30%, white, transparent),
                           radial-gradient(2px 2px at 60% 70%, white, transparent),
                           radial-gradient(1.5px 1.5px at 50% 50%, white, transparent),
                           radial-gradient(1.5px 1.5px at 80% 10%, white, transparent),
                           radial-gradient(2px 2px at 90% 60%, white, transparent),
                           radial-gradient(1.5px 1.5px at 33% 80%, white, transparent),
                           radial-gradient(1.5px 1.5px at 15% 60%, white, transparent),
                           radial-gradient(2px 2px at 45% 15%, white, transparent),
                           radial-gradient(1.5px 1.5px at 75% 45%, white, transparent),
                           radial-gradient(2px 2px at 25% 85%, white, transparent),
                           radial-gradient(1.5px 1.5px at 95% 35%, white, transparent),
                           radial-gradient(1.5px 1.5px at 5% 25%, white, transparent)`,
          backgroundSize: '200px 200px, 300px 300px, 250px 250px, 400px 400px, 350px 350px, 280px 280px, 320px 320px, 380px 380px, 270px 270px, 340px 340px, 290px 290px, 360px 360px',
          backgroundPosition: '0 0, 40px 60px, 130px 270px, 70px 100px, 200px 150px, 300px 50px, 150px 200px, 220px 80px, 180px 320px, 260px 180px, 320px 240px, 100px 140px',
          opacity: 0.7
        }} />

        {/* Medium colored stars */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(1px 1px at 25% 40%, rgba(251, 191, 36, 0.9), transparent),
                           radial-gradient(1px 1px at 75% 25%, rgba(168, 85, 247, 0.9), transparent),
                           radial-gradient(1px 1px at 45% 65%, rgba(59, 130, 246, 0.9), transparent),
                           radial-gradient(1px 1px at 85% 85%, rgba(251, 191, 36, 0.7), transparent),
                           radial-gradient(1px 1px at 10% 15%, rgba(168, 85, 247, 0.7), transparent),
                           radial-gradient(1px 1px at 55% 90%, rgba(59, 130, 246, 0.7), transparent),
                           radial-gradient(1px 1px at 65% 35%, rgba(251, 191, 36, 0.8), transparent),
                           radial-gradient(1px 1px at 15% 75%, rgba(168, 85, 247, 0.8), transparent),
                           radial-gradient(1px 1px at 92% 50%, rgba(59, 130, 246, 0.8), transparent),
                           radial-gradient(1px 1px at 38% 22%, rgba(251, 191, 36, 0.7), transparent),
                           radial-gradient(1px 1px at 72% 78%, rgba(168, 85, 247, 0.7), transparent),
                           radial-gradient(1px 1px at 28% 58%, rgba(59, 130, 246, 0.7), transparent)`,
          backgroundSize: '220px 220px, 280px 280px, 260px 260px, 300px 300px, 240px 240px, 320px 320px, 270px 270px, 290px 290px, 310px 310px, 250px 250px, 330px 330px, 265px 265px',
          backgroundPosition: '20px 30px, 80px 120px, 150px 50px, 250px 200px, 100px 250px, 300px 100px, 180px 160px, 220px 280px, 340px 60px, 120px 190px, 280px 140px, 60px 220px',
          opacity: 0.6
        }} />

        {/* Small stars layer 1 */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(0.5px 0.5px at 10% 20%, white, transparent),
                           radial-gradient(0.5px 0.5px at 30% 50%, white, transparent),
                           radial-gradient(0.5px 0.5px at 50% 30%, white, transparent),
                           radial-gradient(0.5px 0.5px at 70% 60%, white, transparent),
                           radial-gradient(0.5px 0.5px at 90% 40%, white, transparent),
                           radial-gradient(0.5px 0.5px at 40% 80%, white, transparent),
                           radial-gradient(0.5px 0.5px at 20% 70%, white, transparent),
                           radial-gradient(0.5px 0.5px at 60% 90%, white, transparent),
                           radial-gradient(0.5px 0.5px at 80% 20%, white, transparent),
                           radial-gradient(0.5px 0.5px at 35% 10%, white, transparent),
                           radial-gradient(0.5px 0.5px at 15% 45%, white, transparent),
                           radial-gradient(0.5px 0.5px at 55% 15%, white, transparent),
                           radial-gradient(0.5px 0.5px at 75% 75%, white, transparent),
                           radial-gradient(0.5px 0.5px at 25% 65%, white, transparent),
                           radial-gradient(0.5px 0.5px at 85% 55%, white, transparent)`,
          backgroundSize: '150px 150px, 180px 180px, 160px 160px, 200px 200px, 170px 170px, 190px 190px, 140px 140px, 210px 210px, 165px 165px, 185px 185px, 155px 155px, 175px 175px, 195px 195px, 145px 145px, 205px 205px',
          backgroundPosition: '0 0, 50px 50px, 100px 100px, 150px 150px, 200px 200px, 250px 250px, 300px 300px, 350px 350px, 400px 400px, 450px 450px, 25px 75px, 125px 175px, 225px 275px, 325px 325px, 75px 125px',
          opacity: 0.5
        }} />

        {/* Small stars layer 2 (even more dense) */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(0.5px 0.5px at 12% 18%, white, transparent),
                           radial-gradient(0.5px 0.5px at 32% 48%, white, transparent),
                           radial-gradient(0.5px 0.5px at 52% 28%, white, transparent),
                           radial-gradient(0.5px 0.5px at 72% 58%, white, transparent),
                           radial-gradient(0.5px 0.5px at 88% 38%, white, transparent),
                           radial-gradient(0.5px 0.5px at 42% 78%, white, transparent),
                           radial-gradient(0.5px 0.5px at 22% 68%, white, transparent),
                           radial-gradient(0.5px 0.5px at 62% 88%, white, transparent),
                           radial-gradient(0.5px 0.5px at 82% 22%, white, transparent),
                           radial-gradient(0.5px 0.5px at 37% 12%, white, transparent),
                           radial-gradient(0.5px 0.5px at 17% 42%, white, transparent),
                           radial-gradient(0.5px 0.5px at 57% 17%, white, transparent),
                           radial-gradient(0.5px 0.5px at 77% 72%, white, transparent),
                           radial-gradient(0.5px 0.5px at 27% 62%, white, transparent),
                           radial-gradient(0.5px 0.5px at 87% 52%, white, transparent)`,
          backgroundSize: '130px 130px, 160px 160px, 140px 140px, 180px 180px, 150px 150px, 170px 170px, 120px 120px, 190px 190px, 145px 145px, 165px 165px, 135px 135px, 155px 155px, 175px 175px, 125px 125px, 185px 185px',
          backgroundPosition: '30px 30px, 80px 80px, 130px 130px, 180px 180px, 230px 230px, 280px 280px, 330px 330px, 380px 380px, 430px 430px, 480px 480px, 55px 105px, 155px 205px, 255px 305px, 355px 355px, 105px 155px',
          opacity: 0.4
        }} />

        {/* Nebula/Galaxy glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Fixed Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div
              className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onBackToHome?.()}
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-1 ring-amber-500/20">
                  <img src="/logo-new.png" alt="晨曦遗墨" className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                  晨曦遗墨
                </h1>
                <p className="text-slate-500 text-xs">我的项目</p>
              </div>
            </div>

            {/* Create Button */}
            <div className="flex items-center gap-3">
              {/* Import/Export Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowImportExportMenu(!showImportExportMenu)}
                  className="group relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all overflow-hidden border border-white/10 hover:border-amber-500/30"
                >
                  <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors" />
                  <span className="relative">📦</span>
                  <span className="relative text-slate-300">导入/导出</span>
                </button>

                {showImportExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowImportExportMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 backdrop-blur-xl bg-slate-900/95 border border-white/20 rounded-lg shadow-2xl overflow-hidden z-50">
                      <button
                        onClick={() => {
                          handleImportClick();
                          setShowImportExportMenu(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/10 transition-colors flex items-center gap-3"
                      >
                        <span>📥</span>
                        <span>导入项目</span>
                      </button>
                      <div className="h-px bg-white/10" />
                      <div className="px-4 py-2">
                        <p className="text-xs text-slate-500">选择项目后可导出</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="group relative flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all overflow-hidden shadow-lg hover:shadow-xl hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600" />
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative">✨</span>
                <span className="relative text-white">新建项目</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-[1800px] mx-auto px-6 py-8">
        {projects.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
            {projects.map(project => (
              <div
                key={project._id}
                className="group relative"
              >
                {editingProject === project._id ? (
                  <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameProject(project._id);
                        if (e.key === 'Escape') {
                          setEditingProject(null);
                          setEditTitle('');
                        }
                      }}
                      className="w-full bg-slate-900/90 border border-amber-500/50 rounded px-2 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleRenameProject(project._id)}
                        className="flex-1 py-1 bg-green-600 hover:bg-green-500 text-white text-[10px] rounded font-medium transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingProject(null);
                          setEditTitle('');
                        }}
                        className="flex-1 py-1 bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] rounded font-medium transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleSelectProject(project._id)}
                    className="cursor-pointer"
                  >
                    {/* Book Cover Card */}
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gradient-to-br from-amber-500/10 via-purple-600/10 to-blue-600/10 border border-white/10 group-hover:border-amber-500/30 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-amber-500/20">
                      {/* Source Badge */}
                      {project.source && (
                        <div className="absolute top-2 left-2 z-10">
                          <div className={`px-2 py-1 rounded-md text-[10px] font-bold backdrop-blur-sm ${
                            project.source === 'imported'
                              ? 'bg-blue-500/80 text-white'
                              : 'bg-purple-500/80 text-white'
                          }`}>
                            {project.source === 'imported' ? '📥 导入' : '☁️ 在线'}
                          </div>
                        </div>
                      )}

                      {project.coverImage ? (
                        <img
                          src={project.coverImage}
                          alt={project.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4">
                          <div className="text-4xl mb-2 opacity-20">📖</div>
                          <p className="text-slate-400 text-xs font-medium text-center line-clamp-3">{project.title}</p>
                        </div>
                      )}

                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Quick Actions */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportProject(project._id, project.title);
                          }}
                          className="p-1.5 backdrop-blur-sm bg-white/20 hover:bg-white/30 rounded-md transition-all"
                          title="导出项目"
                        >
                          <span className="text-xs">📤</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project._id);
                            setEditTitle(project.title);
                          }}
                          className="p-1.5 backdrop-blur-sm bg-white/20 hover:bg-white/30 rounded-md transition-all"
                          title="重命名"
                        >
                          <span className="text-xs">✏️</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project._id, project.title);
                          }}
                          className="p-1.5 backdrop-blur-sm bg-red-500/20 hover:bg-red-500/30 rounded-md transition-all"
                          title="删除"
                        >
                          <span className="text-xs">🗑️</span>
                        </button>
                      </div>

                      {/* Title overlay on hover */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <h3 className="text-sm font-bold text-white mb-1 line-clamp-2 drop-shadow-lg">
                          {project.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-slate-300">
                          <span>📅 {new Date(project.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center backdrop-blur-lg bg-white/5 border border-white/10 rounded-2xl p-12 max-w-md">
              <div className="text-6xl mb-4 opacity-20">📝</div>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">还没有项目</h3>
              <p className="text-slate-500 text-sm mb-6">点击右上角按钮创建你的第一个小说项目</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all overflow-hidden shadow-lg hover:shadow-xl hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600" />
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative">✨</span>
                <span className="relative text-white">立即创建</span>
              </button>
            </div>
          </div>
        )}

        {/* Create Project Modal - 更精致 */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-xl p-5 max-w-sm w-full shadow-2xl relative overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-purple-600/10 to-blue-600/10 pointer-events-none" />

              <div className="relative z-10">
                <h3 className="text-lg font-bold text-white mb-3 text-center bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                  创建新项目
                </h3>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') {
                      setShowCreateModal(false);
                      setNewProjectTitle('');
                    }
                  }}
                  placeholder="输入项目名称..."
                  className="w-full backdrop-blur-xl bg-slate-900/80 border border-amber-500/40 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 transition-all shadow-lg mb-3"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewProjectTitle('');
                    }}
                    className="flex-1 py-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-sm font-medium transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateProject}
                    disabled={loading || !newProjectTitle.trim()}
                    className="flex-1 relative py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-purple-600 to-blue-600" />
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-purple-500 to-blue-500 opacity-0 hover:opacity-100 transition-opacity" />
                    <span className="relative text-white">
                      {loading ? '创建中...' : '创建'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Confirmation Modal */}
        {importingFile && importProgress.progress === 0 && (
          <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-4 text-blue-400 mb-4">
                <div className="w-12 h-12 bg-blue-400/10 rounded-full flex items-center justify-center text-2xl">
                  📥
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-200">确认导入项目？</h3>
                  <p className="text-xs text-blue-400/80">将创建新项目并同步到云端</p>
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 mb-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">文件名</p>
                <p className="font-mono text-sm text-slate-300 truncate">{importingFile.name}</p>
                <p className="text-xs text-slate-600 mt-1">{(importingFile.size / 1024).toFixed(2)} KB</p>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                导入后将自动创建新项目并同步到云端数据库。
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setImportingFile(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleImportProject}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/20"
                >
                  确认导入
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Progress Modal */}
        {importProgress.progress > 0 && importProgress.progress < 100 && (
          <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-xl p-8 max-w-md w-full shadow-2xl text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto flex items-center justify-center animate-bounce shadow-lg shadow-blue-600/50 mb-4">
                <span className="text-2xl">📥</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-wide mb-4">{importProgress.stage}</h3>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 transition-all duration-300 ease-out relative"
                  style={{ width: `${importProgress.progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <p className="text-blue-300 font-mono text-sm mt-4">{importProgress.progress}%</p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
      </div>
    </div>
  );
};

export default ProjectManager;
