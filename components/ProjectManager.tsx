import React, { useState } from 'react';
import { Project } from '../services/cloudbaseProjectService';
import { getProjects, createProject, switchProject, deleteProject, renameProject } from '../services/cloudbaseProjectService';
import { getProjectData } from '../services/cloudbaseProjectService';

interface ProjectManagerProps {
  onSelectProject: (projectId: string) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

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
      setProjects(prev => [data, ...prev]);
      setShowCreateModal(false);
      setNewProjectTitle('');
      // Automatically select the new project
      await switchProject(data._id);
      onSelectProject(data._id);
    }
  };

  const handleSelectProject = async (projectId: string) => {
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

    setProjects(prev => prev.filter(p => p.id !== projectId));
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

  if (loading && projects.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">加载项目中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-purple-900/20">
            🖋️
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            InkFlow
          </h1>
          <p className="text-slate-400 text-sm">选择一个项目开始创作</p>
        </div>

        {/* Create New Project Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-3 p-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-semibold transition-all shadow-lg shadow-purple-900/20"
          >
            <span className="text-2xl">➕</span>
            <span>创建新项目</span>
          </button>
        </div>

        {/* Projects Grid */}
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(project => (
              <div
                key={project._id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-purple-500/50 transition-all group"
              >
                {editingProject === project._id ? (
                  <div className="space-y-3">
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
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRenameProject(project._id)}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingProject(null);
                          setEditTitle('');
                        }}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-200 mb-2 group-hover:text-purple-400 transition-colors">
                          {project.title}
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>📅 {new Date(project.created_at).toLocaleDateString('zh-CN')}</span>
                          <span>🔄 {new Date(project.updated_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectProject(project._id)}
                        disabled={loading}
                        className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                      >
                        打开项目
                      </button>
                      <button
                        onClick={() => {
                          setEditingProject(project._id);
                          setEditTitle(project.title);
                        }}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                        title="重命名"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project._id, project.title)}
                        className="px-4 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/30 rounded-xl transition-colors"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-2xl">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-slate-400 mb-4">还没有项目</p>
            <p className="text-slate-500 text-sm">点击上方按钮创建你的第一个小说项目</p>
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
    </div>
  );
};

export default ProjectManager;
