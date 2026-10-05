# 通过 Docker 部署 cnpmcore

## 构建镜像

```bash
npm run images
```

## 通过环境变量配置参数

需要在 docker 容器中配置数据存储参数，否则启动会失败，cnpmcore 镜像要求数据存储与计算分离。

### MySQL

```bash
CNPMCORE_DATABASE_TYPE=MySQL
CNPMCORE_DATABASE_NAME=cnpmcore
CNPMCORE_DATABASE_HOST=127.0.0.1
CNPMCORE_DATABASE_PORT=3306
CNPMCORE_DATABASE_USER=your-db-user-name
CNPMCORE_DATABASE_PASSWORD=your-db-user-password
```

### PostgreSQL

```bash
CNPMCORE_DATABASE_TYPE=PostgreSQL
CNPMCORE_DATABASE_NAME=cnpmcore
CNPMCORE_DATABASE_HOST=127.0.0.1
CNPMCORE_DATABASE_PORT=5432
CNPMCORE_DATABASE_USER=your-db-user-name
CNPMCORE_DATABASE_PASSWORD=your-db-user-password
```

### Redis

```bash
CNPMCORE_REDIS_HOST=127.0.0.1
CNPMCORE_REDIS_PORT=6379
CNPMCORE_REDIS_PASSWORD=your-redis-password
CNPMCORE_REDIS_DB=1
```

### 文件存储

目前支持的文件存储服务有阿里云 OSS、AWS S3，以及兼容 S3 的 minio。

#### OSS

```bash
CNPMCORE_NFS_TYPE=oss
CNPMCORE_NFS_OSS_ENDPOINT==https://your-oss-endpoint
CNPMCORE_NFS_OSS_BUCKET=your-bucket-name
CNPMCORE_NFS_OSS_ID=oss-ak
CNPMCORE_NFS_OSS_SECRET=oss-sk
```

#### S3 / minio

```bash
CNPMCORE_NFS_TYPE=s3
CNPMCORE_NFS_S3_CLIENT_ENDPOINT=https://your-s3-endpoint
CNPMCORE_NFS_S3_CLIENT_BUCKET=your-bucket-name
CNPMCORE_NFS_S3_CLIENT_ID=s3-ak
CNPMCORE_NFS_S3_CLIENT_SECRET=s3-sk
CNPMCORE_NFS_S3_CLIENT_DISABLE_URL=true
```

如果使用的是 minio，请务必设置 `CNPMCORE_NFS_S3_CLIENT_FORCE_PATH_STYLE=true`

```bash
CNPMCORE_NFS_S3_CLIENT_FORCE_PATH_STYLE=true
```

### 日志

```bash
CNPMCORE_LOG_DIR=/var/log/cnpmcore
```

### registry 域名

```bash
CNPMCORE_CONFIG_REGISTRY=https://your-registry.com
# 从中国镜像获取数据
CNPMCORE_CONFIG_SOURCE_REGISTRY=https://registry.npmmirror.com
CNPMCORE_CONFIG_SOURCE_REGISTRY_IS_CNPM=true
```

### 时区

时区可以通过环境变量`TZ`来设置，可以使用地区标识符如`Asia/Shanghai`，也可以使用时区标识符如`Etc/GMT-8`（东八区）、`Etc/GMT+8`（西八区），具体TZ列表见[List](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List)。

```bash
TZ=Asia/Shanghai
```

### 使用 `config.prod.js` 覆盖

直接覆盖 `/usr/src/app/config/config.prod.js` 文件也可以实现生产配置自定义。

```js
module.exports = {
  cnpmcore: {
    registry: 'https://your-registry.com',
    sourceRegistry: 'https://registry.npmmirror.com',
    sourceRegistryIsCNpm: true,
    enableWebAuthn: true,
  },
  orm: {
    database: 'cnpmcore',
    host: '127.0.0.1',
    port: 3306,
    user: 'your-db-user-name',
    password: 'your-db-user-password',
  },
  redis: {
    client: {
      port: 6379,
      host: '127.0.0.1',
      password: 'your-redis-password',
      db: 1,
    },
  },
  nfs: {
    client: new (require('s3-cnpmcore'))({
      region: 'default',
      endpoint: 'https://your-s3-endpoint',
      credentials: {
        accessKeyId: 's3-ak',
        secretAccessKey: 's3-sk',
      },
      bucket: 'your-bucket-name',
      forcePathStyle: true,
      disableURL: true,
    }),
  },
  logger: {
    dir: '/var/log/cnpmcore',
  },
};
```

通过 docker volumes 设置配置文件

```bash
docker run -p 7001:7001 -it --rm \
  -v /path-to/config.prod.js:/usr/src/app/config/config.prod.js \
  --name cnpmcore-prod cnpmcore
```

## 运行容器

### 启动方式与健康检查

项目提供的 Docker 镜像默认通过 `npm run start:foreground` 前台启动服务。
自定义容器启动命令或 CI 部署脚本时，也应使用前台模式：

```bash
npm run start:foreground
```

在 Node.js 24（24.7.0 及以上）中，SimpleWebAuthn 14 会在模块导入时检测后量子密码算法支持，
触发 `SubtleCrypto.supports()` 和 `ML-DSA-44` 的 `ExperimentalWarning`，无需登录请求也会出现。
这些警告本身不会导致 Node.js 退出，但 Egg 的 daemon 启动检查可能将 stderr 输出判为启动失败并停止服务。
前台模式不会使用这一 daemon 启动检查。

如果在容器外部署且需要 daemon 模式，请使用：

```bash
npm start
```

`npm start` 先删除旧的 `egg.status`，再通过 `eggctl start --daemon --ignore-stderr` 启动服务。
启动命令返回成功后，[健康检查脚本](../scripts/wait-for-ready.mjs) 会轮询 `http://127.0.0.1:7001/`，
确认 HTTP 状态码为 `200` 且 JSON 响应包含非空字符串 `instance_start_time` 后，才创建新的 `egg.status`。
健康检查默认最多等待 60 秒；超时后输出最后一次错误并以非零状态码退出，不创建 `egg.status`。

健康检查默认使用 `PORT` 环境变量指定的端口，未设置时使用 `7001`。
自定义监听地址时，可通过 `CNPMCORE_HEALTH_CHECK_URL` 指定检查 URL；
通过 `CNPMCORE_HEALTH_CHECK_TIMEOUT` 设置检查超时，单位为毫秒。

`--ignore-stderr` 也会跳过对实际 stderr 错误的启动检查，因此自定义部署脚本时必须保留 HTTP 健康检查。
容器和 CI 使用前台模式时，也应在健康检查通过后再标记部署成功，具体逻辑可参考 [CI 部署检查](../.github/workflows/nodejs.yml)。

### 基于 MySQL 运行

```bash
docker run -p 7001:7001 -it --rm \
  -e CNPMCORE_CONFIG_REGISTRY=https://your-registry.com \
  -e CNPMCORE_CONFIG_SOURCE_REGISTRY=https://registry.npmmirror.com \
  -e CNPMCORE_CONFIG_SOURCE_REGISTRY_IS_CNPM=true \
  -e CNPMCORE_DATABASE_TYPE=MySQL \
  -e CNPMCORE_DATABASE_NAME=cnpmcore \
  -e CNPMCORE_DATABASE_HOST=127.0.0.1 \
  -e CNPMCORE_DATABASE_PORT=3306 \
  -e CNPMCORE_DATABASE_USER=your-db-user-name \
  -e CNPMCORE_DATABASE_PASSWORD=your-db-user-password \
  -e CNPMCORE_NFS_TYPE=s3 \
  -e CNPMCORE_NFS_S3_CLIENT_ENDPOINT=https://your-s3-endpoint \
  -e CNPMCORE_NFS_S3_CLIENT_BUCKET=your-bucket-name \
  -e CNPMCORE_NFS_S3_CLIENT_ID=s3-ak \
  -e CNPMCORE_NFS_S3_CLIENT_SECRET=s3-sk \
  -e CNPMCORE_NFS_S3_CLIENT_FORCE_PATH_STYLE=true \
  -e CNPMCORE_NFS_S3_CLIENT_DISABLE_URL=true \
  -e CNPMCORE_REDIS_HOST=127.0.0.1 \
  -e CNPMCORE_REDIS_PORT=6379 \
  -e CNPMCORE_REDIS_PASSWORD=your-redis-password \
  -e CNPMCORE_REDIS_DB=1 \
  -e TZ=Asia/Shanghai \
  --name cnpmcore-prod cnpmcore
```

### 基于 PostgreSQL 运行

```bash
docker run -p 7001:7001 -it --rm \
  -e CNPMCORE_CONFIG_REGISTRY=https://your-registry.com \
  -e CNPMCORE_CONFIG_SOURCE_REGISTRY=https://registry.npmmirror.com \
  -e CNPMCORE_CONFIG_SOURCE_REGISTRY_IS_CNPM=true \
  -e CNPMCORE_DATABASE_TYPE=PostgreSQL \
  -e CNPMCORE_DATABASE_NAME=cnpmcore \
  -e CNPMCORE_DATABASE_HOST=127.0.0.1 \
  -e CNPMCORE_DATABASE_PORT=5432 \
  -e CNPMCORE_DATABASE_USER=your-db-user-name \
  -e CNPMCORE_DATABASE_PASSWORD=your-db-user-password \
  -e CNPMCORE_NFS_TYPE=s3 \
  -e CNPMCORE_NFS_S3_CLIENT_ENDPOINT=https://your-s3-endpoint \
  -e CNPMCORE_NFS_S3_CLIENT_BUCKET=your-bucket-name \
  -e CNPMCORE_NFS_S3_CLIENT_ID=s3-ak \
  -e CNPMCORE_NFS_S3_CLIENT_SECRET=s3-sk \
  -e CNPMCORE_NFS_S3_CLIENT_FORCE_PATH_STYLE=true \
  -e CNPMCORE_NFS_S3_CLIENT_DISABLE_URL=true \
  -e CNPMCORE_REDIS_HOST=127.0.0.1 \
  -e CNPMCORE_REDIS_PORT=6379 \
  -e CNPMCORE_REDIS_PASSWORD=your-redis-password \
  -e CNPMCORE_REDIS_DB=1 \
  -e TZ=Asia/Shanghai \
  --name cnpmcore-prod cnpmcore
```

## 演示地址

https://registry.fengmk2.com

管理员账号：`cnpmcore_admin/12345678`

通过 npm login 可以登录

```bash
npm login --registry=https://registry.fengmk2.com
```

查看当前登录用户

```bash
npm whoami --registry=https://registry.fengmk2.com
```

## cnpm/cnpmcore 镜像

https://github.com/cnpm/cnpmcore/pkgs/container/cnpmcore

```bash
docker pull ghcr.io/cnpm/cnpmcore:latest
```
