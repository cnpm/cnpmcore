# 本地开发环境 - PostgreSQL

## 依赖列表

本项目的外部服务依赖有：

- 数据库：PostgreSQL
- 缓存：Redis

## 手动初始化

假设大家使用 macOS 开发，Linux 和 Windows 环境自行参考。

### PostgreSQL 17

> https://wiki.postgresql.org/wiki/Homebrew

```bash
brew install postgresql@17
brew services start postgresql@17

echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
```

验证是否安装成功

```bash
psql postgres
```

### Redis

```bash
brew install redis
brew services start redis
```
