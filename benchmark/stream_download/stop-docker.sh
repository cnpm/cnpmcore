#!/bin/bash

# Docker 停止脚本
set -e

CONTAINER_NAME="nginx-benchmark-server"
IMAGE_NAME="nginx-node-benchmark"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== 停止 Docker 容器 ===${NC}"

# 停止容器
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "正在停止容器 $CONTAINER_NAME..."
    docker stop "$CONTAINER_NAME"
    echo -e "${GREEN}容器已停止${NC}"
else
    echo "容器 $CONTAINER_NAME 未运行"
fi

# 删除容器
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "正在删除容器 $CONTAINER_NAME..."
    docker rm "$CONTAINER_NAME"
    echo -e "${GREEN}容器已删除${NC}"
fi

# 可选：删除镜像
echo ""
read -p "是否删除镜像 $IMAGE_NAME? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "正在删除镜像 $IMAGE_NAME..."
    docker rmi "$IMAGE_NAME" || echo "镜像不存在或正在使用"
    echo -e "${GREEN}镜像已删除${NC}"
fi

echo -e "${GREEN}清理完成${NC}"