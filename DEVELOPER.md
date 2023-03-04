# 如何贡献 cnpmcore

## 环境初始化

本项目的外部服务依赖有：MySQL 数据服务、Redis 缓存服务。

可以通过 Docker 来快速启动本地开发环境：

```bash
# 启动本地依赖服务
docker-compose up -d

# 关闭本地依赖服务
docker-compose down
```

> 手动初始化依赖服务参见[文档](./docs/setup.md)

## 本地开发

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
# 初始化数据库
MYSQL_DATABASE=cnpmcore npm run prepare-database

# 启动 Web 服务
npm run dev

# 访问
curl -v http://127.0.0.1:7001
```

### 单元测试

```bash
npm run test
```

## 项目结构

```txt
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
├── infra
│   └── NFSClientAdapter.ts
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

infra：

基于 PaaS 基础设置实现各种 adapter 真实适配实现，cnpmcore 会内置一种实现，企业自定义的 cnpmcore 应该自行基于自身的
PaaS 环境实现自己的 infra module。

- NFSClientAdapter.ts
- QueueAdapter.ts
- AuthAdapter.ts

## Controller 开发指南

目前只支持 HTTP 协议的 Controller，代码在 `app/port/controller` 目录下。
基于类继承的模式来实现，类关系大致如下：

```txt
+----------------------+   +----------------------+   +---------------+
| PackageController.ts |   | PackageTagController |   | XxxController |
+---------------+------+   +---+------------------+   +--+------------+
                |              |                         |
                | extends      | extends                 | extends
                v              v                         v
            +-----------------------------------------------+
            |               AbstractController              |
            +-----------------------+-----------------------+
                                    |
                                    | extends
                                    v
                          +------------------------+
                          |  MiddlewareController  |
                          +------------------------+
```

- MiddlewareController 里面核心的功能就是编排中间件的加载顺序。

### AbstractController

不会有任何路由处理逻辑。

封装一些基础的数据 Entity 访问方法，如果 Entity 不存在，则直接抛 NotFoundError 异常，避免在每个 Controller 里面重复实现。
例如会封装 PackageEntity、PackageVersionEntity 等查询方法。

```ts
// try to get package entity, throw NotFoundError when package not exists
private async getPackageEntity(scope: string, name: string) {
  const packageEntity = await this.packageRepository.findPackage(scope, name);
  if (!packageEntity) {
    const fullname = getFullname(scope, name);
    throw new NotFoundError(`${fullname} not found`);
  }
  return packageEntity;
}
```

### 请求合法性校验三部曲

我们约定按以下顺序进行请求合法性校验：

- 请求参数校验：必须先对请求参数合法性进行强制校验，降低后续所有潜在的安全、伪造等合法性问题发生的概率
- 用户认证：用户登录和 Token 权限校验，确保当前用户的被认证授权的身份，特别是全站管理员权限，一定要谨慎使用
- 资源操作权限校验：这是我们规避水平权限安全漏洞的唯一防御手段，一旦忘记实现，这里肯定会出现安全漏洞

#### 1、请求参数校验

使用 [egg-typebox-validate](https://github.com/xiekw2010/egg-typebox-validate) 来做请求参数校验，只需要定义一次参数类型和规则，就能同时拥有参数校验和类型定义。
详细使用方式可以参考 [PR#12](https://github.com/cnpm/cnpmcore/pull/12)。

使用方式请直接参考 `app/port/typebox.ts` 代码。

#### 2、用户登录和 Token 权限校验

UserRoleManager 会封装请求用户相关的接口，已经入注到 AbstractController 下，如获取当前登录用户

```ts
const authorizedUserAndToken = await this.userRoleManager.getAuthorizedUserAndToken(ctx);
```

大多数情况下，直接使用 `userRoleManager.requiredAuthorizedUser(ctx, tokenRole)` 接口获取当前登录用户会更合适，它会对未登录的请求抛出 UnauthorizedError 异常。

```ts
const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
```

`tokenRole` 默认有以下权限：

- `read`：读权限，代表 token 是 readonly 授权的
- `publish`：写权限，代表 token 是 automation 或者 setting 授权的
- `setting`：管理权限，代表 token 是用户完全授权的

#### 3、资源操作权限校验

通过 UserRoleManager 来收敛所有资源操作的权限校验，已经入注到 AbstractController 下。
我们约定所有用户权限验证都在 Controller 层完成，Service 和 Repository 不做权限校验。

如判断当前请求用户是否是包维护者：

```ts
const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
const pkg = await this.getPackageEntityByFullname(fullname);
await this.userRoleManager.requiredPackageMaintainer(pkg, authorizedUser);
```

当然，大部分对包进行写操作的请求下，我们在 AbstractController 里面抽取了一个更加简便的方法，一次性将数据获取和权限校验包含在一起：

```ts
const { pkg } = await this.ensurePublishAccess(ctx, fullname);
```

## Service 开发指南

## Repository 开发指南

### Repository 类方法命名规则

- `findSomething` 查询一个模型数据
- `saveSomething` 保存一个模型数据，包含新增、更新逻辑，尽量不单独区分
- `removeSomething` 移除一个模型数据
- `listSomethings` 查询一批模型数据

## DDD 常见问题答疑

### 为什么有了 Model 之后还需要一层 Entity 的封装

请先阅读「[领域驱动设计](https://www.yuque.com/liberty/rf322x)」

### 修改一个 Model

可能需要涉及3个地方的修改：

1. sql/*.sql
2. repository/model/*.ts
3. core/entity/*.ts

目前还不会做 Model 到 SQL 的自动转换生成，核心原因有：

1. SQL 变更需要进行 Review
2. 自动转换出现问题，很难被发现
3. 我们的经验还不够丰富，先依赖人工
