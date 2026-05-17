#!/bin/bash

# Docker 启动脚本
set -e

# 设置变量
IMAGE_NAME="nginx-node-benchmark"
CONTAINER_NAME="nginx-benchmark-server"
HOST_PORT="8080"
CONTAINER_PORT="80"
MOUNT_DIR="$(pwd)/nginx"
CONTAINER_MOUNT_DIR="/var/www/html"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 启动 Docker 容器 ===${NC}"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行或未安装${NC}"
    exit 1
fi

# 检查 nginx 目录是否存在
if [ ! -d "$MOUNT_DIR" ]; then
    echo -e "${YELLOW}警告: nginx 目录不存在，正在创建...${NC}"
    mkdir -p "$MOUNT_DIR"
fi

# 检查是否有测试文件，如果没有就创建一些
if [ ! -f "$MOUNT_DIR/test-file.txt" ]; then
    echo -e "${YELLOW}创建测试文件...${NC}"
    cp nginx/test-file.txt "$MOUNT_DIR/" 2>/dev/null || echo "测试文件已存在"
fi

if [ ! -f "$MOUNT_DIR/large-test-file.bin" ]; then
    echo -e "${YELLOW}创建大测试文件...${NC}"
    cp nginx/large-test-file.bin "$MOUNT_DIR/" 2>/dev/null || dd if=/dev/zero of="$MOUNT_DIR/large-test-file.bin" bs=1M count=10
fi

# 停止并删除已存在的容器
echo "检查并停止已存在的容器..."
docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true

# 构建 Docker 镜像
echo "构建 Docker 镜像..."
docker build -t "$IMAGE_NAME" .

# 启动容器 (添加 ulimit 和 privileged 模式用于 coredump)
echo "启动容器..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$HOST_PORT:$CONTAINER_PORT" \
    -v "$MOUNT_DIR:$CONTAINER_MOUNT_DIR:ro" \
    --ulimit core=-1 \
    --privileged \
    --restart unless-stopped \
    "$IMAGE_NAME"

# 等待容器启动
echo "等待容器启动..."
sleep 3

# 检查容器状态
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${GREEN}容器启动成功！${NC}"
    echo -e "${GREEN}访问地址: http://localhost:$HOST_PORT${NC}"
    echo -e "${GREEN}下载测试: http://localhost:$HOST_PORT/download/${NC}"
    echo -e "${GREEN}上传测试: http://localhost:$HOST_PORT/upload/${NC}"
    echo -e "${GREEN}健康检查: http://localhost:$HOST_PORT/health${NC}"
    
    # 显示容器信息
    echo ""
    echo "容器信息:"
    docker ps | grep "$CONTAINER_NAME"
    
    echo ""
    echo "测试命令:"
    echo "下载测试: curl -O http://localhost:$HOST_PORT/download/test-file.txt"
    echo "上传测试: curl -X POST -d 'test' http://localhost:$HOST_PORT/upload/"
    
else
    echo -e "${RED}容器启动失败！${NC}"
    echo "查看日志:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi