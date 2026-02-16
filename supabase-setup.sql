-- InkFlow Supabase Database Setup Script
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 1. 创建 projects 表 (小说项目)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_synced_at timestamp with time zone,
  is_active boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

-- ============================================
-- 2. 创建 novel_settings 表 (小说设定)
-- ============================================
CREATE TABLE IF NOT EXISTS novel_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  title text,
  style text,
  tags text[],
  gold_finger text,
  synopsis text,
  leveling_system text,
  background text,
  author_note text,
  characters jsonb DEFAULT '[]'::jsonb,
  current_plot_progress text,
  cover_image text,
  cover_visual_prompt text,
  novel_type text DEFAULT 'long',
  target_total_words integer,
  target_chapter_count integer,
  updated_at timestamp with time zone DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_novel_settings_project_id ON novel_settings(project_id);

-- ============================================
-- 3. 创建 chapters 表 (章节内容)
-- ============================================
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  number integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(project_id, number)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(project_id, number);

-- ============================================
-- 4. 启用 Row Level Security (RLS)
-- ============================================

-- projects 表 RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- 创建新策略
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- novel_settings 表 RLS
ALTER TABLE novel_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage settings of their projects" ON novel_settings;

CREATE POLICY "Users can manage settings of their projects"
  ON novel_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = novel_settings.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- chapters 表 RLS
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage chapters of their projects" ON chapters;

CREATE POLICY "Users can manage chapters of their projects"
  ON chapters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = chapters.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. 创建自动更新 updated_at 的触发器
-- ============================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为 projects 表创建触发器
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 novel_settings 表创建触发器
DROP TRIGGER IF EXISTS update_novel_settings_updated_at ON novel_settings;
CREATE TRIGGER update_novel_settings_updated_at
    BEFORE UPDATE ON novel_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 chapters 表创建触发器
DROP TRIGGER IF EXISTS update_chapters_updated_at ON chapters;
CREATE TRIGGER update_chapters_updated_at
    BEFORE UPDATE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. 创建辅助函数 (可选)
-- ============================================

-- 获取项目统计信息的函数
CREATE OR REPLACE FUNCTION get_project_stats(project_uuid uuid)
RETURNS TABLE (
  chapter_count bigint,
  total_words bigint,
  last_chapter_title text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as chapter_count,
    COALESCE(SUM(LENGTH(content)), 0)::bigint as total_words,
    (SELECT title FROM chapters WHERE project_id = project_uuid ORDER BY number DESC LIMIT 1) as last_chapter_title
  FROM chapters
  WHERE project_id = project_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成!
-- ============================================
-- 数据库设置完成。现在您可以:
-- 1. 在 Supabase Dashboard 的 Authentication 设置中启用 Email provider
-- 2. 复制您的 Project URL 和 anon key 到 .env.local 文件
-- 3. 重启开发服务器,开始使用云端同步功能
