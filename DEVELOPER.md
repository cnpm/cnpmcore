# 如何共享 cnpmcore

## 项目结构

```
app
├── common
│   └── adapter
├── core
│   ├── entity
│   ├── events
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
- events：异步事件定义，以及消费，串联业务
- service：核心业务
- util：服务 core 内部，不对外暴露

repository：
- model：ORM 模型，数据定义
- XXXRepository: 仓储接口，存储、查询过程

port：
- controller：HTTP controller

