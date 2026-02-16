import React, { useState, useEffect } from 'react';
import { Project } from '../services/cloudbaseProjectService';
import { getProjects, createProject, switchProject, deleteProject, renameProject } from '../services/cloudbaseProjectService';

interface ProjectSelectorProps {
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  onProjectCreate: (projectId: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  currentProjectId,
  onProjectChange,
  onProjectCreate
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const currentProject = projects.find(p => p.id === currentProjectId);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const { data, error } = await getProjects();
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
      setProjects(prev => [data, ...prev]);
      setShowCreateModal(false);
      setNewProjectTitle('');
      onProjectCreate(data.id);
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    setLoading(true);
    const { error } = await switchProject(projectId);
    setLoading(false);

    if (error) {
      alert('切换项目失败: ' + error.message);
      return;
    }

    setIsOpen(false);
    onProjectChange(projectId);
  };

  const handleDeleteProject = async (projectId: string, projectTitle: string) => {
    if (!confirm(`确定要删除项目"${projectTitle}"吗?\n\n此操作将永久删除该项目的所有数据,包括设定和章节内容。`)) {
      return;
    }

    setLoading(true);
    const { error } = await deleteProject(projectId);
    setLoading(false);

    if (error) {
      alert('删除项目失败: ' + error.message);
      return;
    }

    setProjects(prev => prev.filter(p => p.id !== projectId));

    // If deleted current project, switch to another or create new
    if (projectId === currentProjectId) {
      const remaining = projects.filter(p => p.id !== projectId);
      if (remaining.length > 0) {
        handleSwitchProject(remaining[0].id);
      } else {
        setShowCreateModal(true);
      }
    }
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
      p.id === projectId ? { ...p, title: editTitle } : p
    ));
    setEditingProject(null);
    setEditTitle('');
  };

  return (
    <div className="relative">
      {/* Current Project Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all"
        disabled={loading}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">📁</span>
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-200 truncate w-full">
              {currentProject?.title || '选择项目'}
            </span>
            <span className="text-[9px] text-slate-500">
              {projects.length} 个项目
            </span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[100] max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2">
            {/* Create New Project Button */}
            <button
              onClick={() => {
                setShowCreateModal(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:bg-purple-600/10 text-purple-400 border border-purple-600/30 mb-2"
            >
              <span className="text-lg">➕</span>
              <span className="text-xs font-semibold">创建新项目</span>
            </button>

            {/* Project List */}
            <div className="space-y-1">
              {projects.map(project => (
                <div
                  key={project.id}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    project.id === currentProjectId
                      ? 'bg-purple-600/10 border border-purple-600/30'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  {editingProject === project.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameProject(project.id);
                          if (e.key === 'Escape') {
                            setEditingProject(null);
                            setEditTitle('');
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameProject(project.id)}
                        className="text-green-400 hover:text-green-300"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setEditingProject(null);
                          setEditTitle('');
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSwitchProject(project.id)}
                        className="flex-1 flex flex-col items-start text-left"
                      >
                        <span className="text-xs font-semibold text-slate-200 truncate w-full">
                          {project.title}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {new Date(project.updated_at).toLocaleDateString('zh-CN')}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingProject(project.id);
                          setEditTitle(project.title);
                        }}
                        className="text-slate-500 hover:text-slate-300 p-1"
                        title="重命名"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id, project.title)}
                        className="text-red-500 hover:text-red-400 p-1"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-slate-200 mb-4">创建新项目</h3>
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectTitle('');
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                disabled={loading || !newProjectTitle.trim()}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
