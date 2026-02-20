# 头像素材库

将你的头像素材（2MB以内）放在这个文件夹中。

支持的格式：jpg, jpeg, png, webp

## 使用方法

1. 将头像图片放入此文件夹
2. 运行更新脚本生成清单文件：
   ```bash
   npm run update-avatars
   ```
   或者手动运行：
   ```bash
   ./scripts/update-avatar-manifest.sh
   ```

3. 应用会自动加载 `avatars-manifest.json` 中列出的所有头像

## 当前状态

- 已有 188 个头像素材
- 清单文件已生成：`avatars-manifest.json`

## 搜索功能

头像文件名会作为搜索关键词，建议使用有意义的命名，例如：
- `仙侠-剑仙.png`
- `武侠-少林高僧.png`
- `都市-总裁.png`

