#!/bin/bash

# nginx 启动脚本
set -e

echo "=== 启动 nginx 服务 ==="

# 检查 nginx 配置
nginx -t

# 创建必要的目录
mkdir -p /var/log/nginx
mkdir -p /var/lib/nginx/body
mkdir -p /var/lib/nginx/proxy
mkdir -p /var/lib/nginx/fastcgi

# 设置 nginx 目录权限
# chown -R www-data:www-data /var/www/html
# chmod -R 755 /var/www/html

# 启动 nginx 前台进程
echo "正在启动 nginx..."
nginx -g 'daemon off;' &

NGINX_PID=$!

# 等待 nginx 启动
sleep 2

# 检查 nginx 是否成功启动
if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "nginx 启动失败"
    exit 1
fi

echo "nginx 启动成功，PID: $NGINX_PID"
echo "访问地址: http://localhost"
echo "下载测试: http://localhost/download/"
echo "上传测试: http://localhost/upload/"
echo "健康检查: http://localhost/health"

# 处理信号
handle_signal() {
    echo "接收到信号，正在停止 nginx..."
    nginx -s quit
    wait $NGINX_PID
    echo "nginx 已停止"
    exit 0
}

# 设置信号处理
trap handle_signal SIGTERM SIGINT

# 等待 nginx 进程
wait $NGINX_PID