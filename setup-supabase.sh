#!/bin/bash

# InkFlow Supabase 一键配置脚本
# 使用方法: ./setup-supabase.sh YOUR_URL YOUR_ANON_KEY

echo "🚀 InkFlow Supabase 配置脚本"
echo "================================"

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ 错误: 缺少参数"
    echo ""
    echo "使用方法:"
    echo "  ./setup-supabase.sh YOUR_SUPABASE_URL YOUR_ANON_KEY"
    echo ""
    echo "示例:"
    echo "  ./setup-supabase.sh https://xxxxx.supabase.co eyJhbGc..."
    echo ""
    echo "📖 获取配置信息:"
    echo "  1. 访问 https://supabase.com"
    echo "  2. 创建新项目或选择现有项目"
    echo "  3. 进入 Settings -> API"
    echo "  4. 复制 Project URL 和 anon public key"
    exit 1
fi

SUPABASE_URL=$1
ANON_KEY=$2

echo "📝 配置信息:"
echo "  URL: $SUPABASE_URL"
echo "  Key: ${ANON_KEY:0:20}..."
echo ""

# 更新 .env.local
echo "✏️  更新 .env.local 文件..."
sed -i.bak "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=$SUPABASE_URL|" .env.local
sed -i.bak "s|VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$ANON_KEY|" .env.local

echo "✅ 配置已更新!"
echo ""
echo "📋 下一步:"
echo "  1. 在 Supabase Dashboard 执行 SQL 脚本 (supabase-setup.sql)"
echo "  2. 重启开发服务器: npm run dev"
echo "  3. 打开浏览器测试: http://localhost:3002"
echo ""
echo "🎉 完成!"
