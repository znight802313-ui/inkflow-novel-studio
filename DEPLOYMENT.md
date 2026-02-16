# InkFlow 部署指南

## 部署到 Vercel

### 1. 准备工作

确保你已经有:
- GitHub 账号
- Vercel 账号 (可以用 GitHub 登录: https://vercel.com)

### 2. 将项目推送到 GitHub

```bash
# 初始化 Git 仓库 (如果还没有)
git init

# 添加所有文件
git add .

# 创建第一个提交
git commit -m "Initial commit: InkFlow 小说创作智能体"

# 在 GitHub 上创建一个新仓库,然后关联
git remote add origin https://github.com/你的用户名/inkflow-novel-studio.git

# 推送到 GitHub
git push -u origin main
```

### 3. 在 Vercel 上部署

1. 访问 https://vercel.com 并登录
2. 点击 "Add New Project"
3. 选择你刚才创建的 GitHub 仓库
4. 配置环境变量:
   - 点击 "Environment Variables"
   - 添加以下环境变量:
     ```
     VITE_TCB_ENV_ID=ai-novel-6gz22r4k5fbbee49
     ANTHROPIC_BASE_URL=https://mixai.cc/v1
     ANTHROPIC_AUTH_TOKEN=sk-a7YqF4A9MnkAWjxq
     ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
     AVAILABLE_MODELS=[次]claude-sonnet-4-5-thinking,[次]gemini-3-pro-preview-thinking,[次]gemini-3-flash-preview,[新]claude-sonnet-4-5-20250929
     ```
5. 点击 "Deploy"
6. 等待部署完成 (通常 1-2 分钟)
7. 部署完成后,Vercel 会给你一个 URL,例如: `https://inkflow-novel-studio.vercel.app`

### 4. 配置自定义域名 (可选)

如果你有自己的域名:
1. 在 Vercel 项目设置中,点击 "Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

### 5. 自动部署

配置完成后,每次你推送代码到 GitHub,Vercel 会自动重新部署:

```bash
git add .
git commit -m "更新功能"
git push
```

## 部署到其他平台

### Netlify

1. 访问 https://netlify.com 并登录
2. 点击 "Add new site" → "Import an existing project"
3. 选择你的 GitHub 仓库
4. 配置:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 添加环境变量 (同 Vercel)
6. 点击 "Deploy site"

### 腾讯云静态网站托管

1. 访问腾讯云控制台
2. 进入 CloudBase → 静态网站托管
3. 上传 `dist` 目录下的所有文件
4. 配置环境变量

## 注意事项

1. **环境变量安全**:
   - 不要将 `.env.local` 文件提交到 Git
   - 在部署平台上配置环境变量

2. **API 密钥保护**:
   - 考虑将 API 调用移到后端,避免暴露密钥
   - 或者使用 Vercel Serverless Functions

3. **CloudBase 配置**:
   - 确保 CloudBase 环境 ID 正确
   - 检查 CloudBase 安全规则,允许来自你的域名的请求

4. **测试**:
   - 部署后测试所有功能
   - 检查登录、注册、项目管理等功能是否正常

## 故障排查

### 部署失败
- 检查 build 日志
- 确保所有依赖都在 `package.json` 中
- 运行 `npm run build` 本地测试

### 环境变量不生效
- 确保变量名以 `VITE_` 开头 (Vite 要求)
- 重新部署项目

### CloudBase 连接失败
- 检查环境 ID 是否正确
- 检查 CloudBase 控制台的安全配置
- 确保允许来自你的域名的请求

## 成功部署后

部署成功后,你可以:
- 在任何设备上访问你的应用
- 分享链接给其他用户
- 使用同一账号在不同设备上登录
- 数据会自动同步到云端

祝你部署顺利! 🎉
