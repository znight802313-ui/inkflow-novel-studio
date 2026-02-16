# Supabase 快速配置指南 (5分钟完成)

## 步骤 1: 创建 Supabase 项目

1. 打开浏览器访问: https://supabase.com
2. 点击右上角 "Start your project" 或 "Sign in"
3. 使用 GitHub 账号登录(最快)或注册新账号
4. 登录后,点击 "New Project"
5. 填写项目信息:
   - **Name**: `inkflow-test` (或任意名称)
   - **Database Password**: 设置一个强密码(请记住这个密码!)
   - **Region**: 选择 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`
   - **Pricing Plan**: 选择 `Free` (免费版)
6. 点击 "Create new project"
7. 等待约 2 分钟,项目创建完成

## 步骤 2: 执行数据库脚本

1. 在 Supabase Dashboard 左侧菜单,点击 **SQL Editor** (图标像 </> )
2. 点击右上角 **"New query"** 按钮
3. 复制下面的完整 SQL 脚本并粘贴到编辑器中
4. 点击右下角 **"Run"** 按钮执行
5. 确认看到绿色的成功提示

```sql
-- InkFlow Database Setup Script
-- 复制下面的全部内容到 Supabase SQL Editor 中执行

-- 1. 创建 projects 表
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

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

-- 2. 创建 novel_settings 表
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

CREATE INDEX IF NOT EXISTS idx_novel_settings_project_id ON novel_settings(project_id);

-- 3. 创建 chapters 表
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

CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(project_id, number);

-- 4. 启用 Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

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

-- 6. 创建触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_novel_settings_updated_at ON novel_settings;
CREATE TRIGGER update_novel_settings_updated_at
    BEFORE UPDATE ON novel_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chapters_updated_at ON chapters;
CREATE TRIGGER update_chapters_updated_at
    BEFORE UPDATE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## 步骤 3: 获取 API 密钥

1. 在 Supabase Dashboard 左侧菜单,点击 **Settings** (齿轮图标)
2. 点击 **API** 选项
3. 找到并复制以下两个值:

   **Project URL** (在 "Project URL" 下方):
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```

   **anon public** (在 "Project API keys" 下方):
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...很长的字符串
   ```

## 步骤 4: 配置环境变量

将你复制的值告诉我,格式如下:

```
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ开头的很长字符串
```

我会帮你更新 `.env.local` 文件并重启服务。

---

## 如果你已经有 Supabase 项目

直接提供给我:
1. Project URL
2. anon public key

我会立即配置好!
