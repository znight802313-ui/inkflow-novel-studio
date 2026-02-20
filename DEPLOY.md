# 部署说明

## 自动部署配置

项目已配置自动部署到腾讯云 CloudBase。

### 方式 1：GitHub Actions 自动部署（推荐）

每次推送代码到 `main` 分支时，GitHub Actions 会自动构建并部署到腾讯云。

**设置步骤：**

1. 获取腾讯云 API 密钥：
   - 访问：https://console.cloud.tencent.com/cam/capi
   - 创建或查看你的 SecretId 和 SecretKey

2. 在 GitHub 仓库设置 Secrets：
   - 进入你的 GitHub 仓库
   - 点击 Settings → Secrets and variables → Actions
   - 添加以下两个 secrets：
     - `CLOUDBASE_SECRET_ID`: 你的腾讯云 SecretId
     - `CLOUDBASE_SECRET_KEY`: 你的腾讯云 SecretKey

3. 完成！之后每次推送代码到 main 分支，会自动部署。

### 方式 2：本地手动部署

如果你想立即部署当前版本：

```bash
npm run deploy
```

这会构建项目并部署到腾讯云。

## 部署地址

https://ai-novel-6gz22r4k5fbbee49-1404964184.tcloudbaseapp.com/

## 环境变量

确保在腾讯云控制台配置了以下环境变量：
- `VITE_TCB_ENV_ID`: ai-novel-6gz22r4k5fbbee49
