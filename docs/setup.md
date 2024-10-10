# 本地开发环境

## 依赖列表

本项目的外部服务依赖有：

- 数据库：MySQL
- 缓存：Redis

## 通过 Docker 初始化

```bash
# 启动
$ docker-compose up -d

# 关闭
$ docker-compose down
```

## 手动初始化

假设大家使用 macOS 开发，Linux 和 Windows 环境自行参考。

### MySQL 9

```bash
brew install mysql
brew services start mysql
```

### Redis

```bash
brew install redis
brew services start redis
```
