# Nginx 下载/上传测试服务器

## 快速开始

> **注意**: 请先切换到 `benchmark/stream_download` 目录下执行以下命令

### 构建镜像

```bash
docker build --platform linux/amd64 -t nginx-node-benchmark .
```

### 运行容器

```bash
docker run --rm -d --platform linux/amd64 \
  --name nginx-node-benchmark \
  -p 8080:80 \
  -v $(pwd)/nginx:/var/www/html \
  nginx-node-benchmark
```

### 测试

```bash
# 下载测试
curl -v http://localhost:8080/download/test-file.txt

# 上传测试
curl -v -X POST -d "test" http://localhost:8080/upload/
```

### 停止

```bash
docker stop nginx-node-benchmark && docker rm nginx-node-benchmark
```

### 运行生成大文件

```bash
sh generate_50mb_file.sh
```

### 运行 node 测试

```bash
docker exec -ti nginx-node-benchmark bash

cd /root/workspace
node benchmark.js
```

## 内存分析 (Memory Leak Analysis)

### 运行 benchmark 并生成 coredump

运行 benchmark 60 秒后自动生成 heap snapshot 和 coredump:

```bash
# 使用默认 60 秒
./run-benchmark-with-coredump.sh

# 或指定运行时间（秒）
./run-benchmark-with-coredump.sh 120
```

### 手动复制 coredump 文件

如果需要手动复制 coredump 和 heap snapshot 文件:

```bash
./copy-coredump.sh
```

### 分析 heap snapshot

1. 打开 Chrome DevTools -> Memory 标签
2. 点击 "Load" 加载 `coredumps/*.heapsnapshot` 文件
3. 分析内存分配情况

### 分析 coredump

详细的 coredump 分析指南请参考 [COREDUMP_ANALYSIS.md](./COREDUMP_ANALYSIS.md)

快速分析方法:

```bash
# 使用 strings 提取内存信息
strings coredumps/core.* | grep -E "(heapUsed|rss|external):" | tail -20

# 查找内存相关错误
strings coredumps/core.* | grep -E "(ENOMEM|EMFILE|leak)" | head -20

# 统计对象引用数量
strings coredumps/core.* | grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" | wc -l

# 在容器内使用 gdb 分析
docker exec -it nginx-benchmark-server gdb /usr/local/bin/node /tmp/core.*

# 或将 coredump 复制到本地后使用 lldb 分析
lldb -c coredumps/core.*
```

### 手动触发 heap snapshot

在 benchmark 运行时发送 SIGUSR2 信号生成 heap snapshot:

```bash
# 获取 benchmark 进程 PID
docker exec nginx-benchmark-server cat /tmp/benchmark.pid

# 发送信号生成 heap snapshot
docker exec nginx-benchmark-server kill -SIGUSR2 <PID>
```
