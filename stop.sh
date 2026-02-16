#!/bin/bash

# InkFlow Web Novel Studio 停止脚本

cd "$(dirname "$0")"

# 添加 Node.js 到 PATH
export PATH="$HOME/.local/node/bin:$PATH"

if [ -f ".server.pid" ]; then
    PID=$(cat .server.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        rm .server.pid
        echo "✅ 服务器已停止 (PID: $PID)"
    else
        rm .server.pid
        echo "⚠️  服务器进程不存在"
    fi
else
    # 尝试通过端口查找进程
    PID=$(lsof -ti:3000)
    if [ -n "$PID" ]; then
        kill $PID
        echo "✅ 服务器已停止 (PID: $PID)"
    else
        echo "⚠️  没有找到运行中的服务器"
    fi
fi
