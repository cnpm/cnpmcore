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

### MySQL 5.7

```bash
$ brew install mysql@5.7
$ brew services start mysql
```

### MySQL 8

```bash
$ brew install mysql
$ brew services start mysql
```

如果遇到以下异常

```log
Uncaught Error: ER_NOT_SUPPORTED_AUTH_MODE: Client does not support authentication protocol requested by server; consider upgrading MySQL client
```

需要先确认安装的 MySQL 版本，如果是 8.x，在执行时可能会报错不支持此种鉴权方式，需要改一下 MySQL 设置

```bash
# 登录数据库
mysql -u root

> use mysql;
> update user set plugin='mysql_native_password' where user='root';
> quit;

# 重启 MySQL
brew services restart mysql
```

### Redis

```bash
brew install redis
brew services start redis
```
