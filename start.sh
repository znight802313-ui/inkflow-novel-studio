#!/bin/bash

# InkFlow Web Novel Studio 启动脚本
# 此脚本会在后台启动开发服务器

cd "$(dirname "$0")"

# 添加 Node.js 到 PATH
export PATH="$HOME/.local/node/bin:$PATH"

# 检查 node 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js"
    echo ""
    echo "安装方法（选择其一）："
    echo "1. 访问 https://nodejs.org 下载安装包"
    echo "2. 使用 Homebrew: brew install node"
    echo ""
    exit 1
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
fi

# 检查是否已有服务在运行
if lsof -i:3000 &> /dev/null; then
    echo "⚠️  端口 3000 已被占用，可能服务已在运行"
    echo "访问地址: http://localhost:3000"
    # 自动打开浏览器
    if command -v open &> /dev/null; then
        open "http://localhost:3000"
    fi
    exit 0
fi

# 启动开发服务器（后台运行）
echo "🚀 正在启动 InkFlow Web Novel Studio..."
nohup npm run dev > .server.log 2>&1 &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 检查服务器是否成功启动
if lsof -i:3000 &> /dev/null; then
    echo "✅ 服务器启动成功！"
    echo ""
    echo "📍 访问地址: http://localhost:3000"
    echo "📝 进程 PID: $SERVER_PID"
    echo "📄 日志文件: .server.log"
    echo ""
    echo "停止服务: ./stop.sh 或 kill $SERVER_PID"

    # 保存 PID 到文件
    echo $SERVER_PID > .server.pid

    # 自动打开浏览器
    if command -v open &> /dev/null; then
        open "http://localhost:3000"
    fi
else
    echo "❌ 服务器启动失败，请查看日志: cat .server.log"
    exit 1
fi
