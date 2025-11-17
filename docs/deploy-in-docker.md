# 通过 Docker 部署 cnpmcore

## 构建镜像

```bash
npm run images
```

Docker 镜像采用了多阶段构建优化，详细信息请参阅 [DOCKER_OPTIMIZATION.md](../DOCKER_OPTIMIZATION.md)。

主要优化包括：
- 使用多阶段构建分离编译和运行环境
- 仅在生产镜像中包含生产依赖
- 优化层缓存以加快重新构建速度
- 使用 dumb-init 处理信号

预期镜像大小比单阶段构建减少 30-50%。

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
