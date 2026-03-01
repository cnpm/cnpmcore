#!/bin/bash

# Docker 状态检查脚本

CONTAINER_NAME="nginx-benchmark-server"
IMAGE_NAME="nginx-node-benchmark"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Docker 容器状态 ===${NC}"

# 检查容器状态
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${GREEN}容器状态: 运行中${NC}"
    echo ""
    echo "容器信息:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "$CONTAINER_NAME"
    
    echo ""
    echo "资源使用:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep "$CONTAINER_NAME" || echo "无法获取资源信息"
    
    echo ""
    echo "访问测试:"
    if curl -s http://localhost:8080/health > /dev/null; then
        echo -e "${GREEN}✓ HTTP 服务正常${NC}"
    else
        echo -e "${RED}✗ HTTP 服务异常${NC}"
    fi
    
elif docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo -e "${YELLOW}容器状态: 已停止${NC}"
    echo ""
    echo "最后状态:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "$CONTAINER_NAME"
else
    echo -e "${RED}容器状态: 不存在${NC}"
fi

# 检查镜像
if docker images | grep -q "$IMAGE_NAME"; then
    echo ""
    echo -e "${BLUE}镜像信息:${NC}"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep "$IMAGE_NAME"
else
    echo ""
    echo -e "${RED}镜像不存在${NC}"
fi

# 端口检查
if netstat -tulnp 2>/dev/null | grep -q ":8080" || lsof -i :8080 2>/dev/null; then
    echo ""
    echo -e "${GREEN}端口 8080 已占用${NC}"
else
    echo ""
    echo -e "${YELLOW}端口 8080 空闲${NC}"
fi

# 显示测试命令
echo ""
echo -e "${BLUE}测试命令:${NC}"
echo "健康检查: curl -I http://localhost:8080/health"
echo "下载测试: curl -O http://localhost:8080/download/test-file.txt"
echo "上传测试: curl -X POST -d 'test' http://localhost:8080/upload/"