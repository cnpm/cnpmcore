FROM node:24.12.0

# 安装 nginx 和其他必要工具
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    vim \
    gdb \
    procps \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 配置 coredump
RUN echo "ulimit -c unlimited" >> /etc/bash.bashrc \
    && mkdir -p /tmp/cores \
    && chmod 777 /tmp/cores

# 创建 nginx 配置目录
RUN mkdir -p /etc/nginx/conf.d

# 复制 nginx 配置文件
COPY nginx.conf /etc/nginx/sites-available/default

# 创建 nginx 工作目录
RUN mkdir -p /var/www/html

# 创建启动脚本
COPY start-nginx.sh /usr/local/bin/start-nginx.sh
RUN chmod +x /usr/local/bin/start-nginx.sh

# 暴露端口
EXPOSE 80 9229

# 设置工作目录
WORKDIR /var/www/html

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

RUN mkdir -p /root/workspace

COPY gc.js /root/workspace/gc.js
COPY benchmark.js /root/workspace/benchmark.js
COPY benchmark_undici.js /root/workspace/benchmark_undici.js

RUN cd /root/workspace && npm i urllib --registry https://registry.npmmirror.com

# 启动命令
CMD ["/usr/local/bin/start-nginx.sh"]