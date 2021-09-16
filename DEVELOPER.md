# 如何共享 cnpmcore

## 安装数据库

假设大家使用 macOS 开发，Linux 和 Windows 环境自行参考

### MySQL

```bash
brew install mysql
brew services start mysql
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

## 项目结构

```
app
├── common
│   └── adapter
├── core
│   ├── entity
│   ├── event
│   ├── service
│   └── util
├── port
│   └── controller
├── repository
│   └── model
└── test
    ├── control
    │   └── response_time.test.js
    └── controller
        └── home.test.js
```

common：
- util：全局工具类
- adapter：外部服务调用

core：
- entity：核心模型，实现业务行为
- event：异步事件定义，以及消费，串联业务
- service：核心业务
- util：服务 core 内部，不对外暴露

repository：
- model：ORM 模型，数据定义
- XXXRepository: 仓储接口，存储、查询过程

port：
- controller：HTTP controller

## DDD 常见问题答疑

### 为什么有了 Model 之后还需要一层 Entity 的封装

TBD，蓝诀正在写一个 DDD 知识库，等他写好就链接过来。

### 修改一个 Model

可能需要涉及3个地方的修改：

1. sql/*.sql
2. repository/model/*.ts
3. core/entity/*.ts

目前还不会做 Model 到 SQL 的自动转换生成，核心原因有：

1. SQL 变更需要进行 Review
2. 自动转换出现问题，很难被发现
3. 我们的经验还不够丰富，先依赖人工
