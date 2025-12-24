# Nginx 下载/上传测试服务器

## 快速开始

> **注意**: 请先切换到 `benchmark/stream_download` 目录下执行以下命令

### 构建镜像

```bash
docker build --platform linux/amd64 -t nginx-node-benchmark .
```

### 运行容器

```bash
docker run -rm -d --platform linux/amd64 \
  --name nginx-benchmark-server \
  -p 8080:80 \
  -v $(pwd)/nginx:/var/www/html \
  nginx-node-benchmark
```

### 测试

```bash
# 下载测试
curl -O http://localhost:8080/download/test-file.txt

# 上传测试
curl -X POST -d "test" http://localhost:8080/upload/
```

### 停止

```bash
docker stop nginx-benchmark-server && docker rm nginx-benchmark-server
```

### 运行生成大文件

```bash
sh generate_50mb_file.sh
```

### 运行 node 测试

```bash
docker exec -ti nginx-benchmark-server bash
cd /root/workspace
node benchmark.js
```
