# 如何贡献 cnpmcore

## 安装数据库

假设大家使用 macOS 开发，Linux 和 Windows 环境自行参考

### MySQL 5.7

```bash
brew install mysql@5.7
brew services start mysql
```

### MySQL 8

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

## 本地开发

### 安装依赖

```bash
npm install
```

### 开发运行

初始化数据库：

```bash
MYSQL_DATABASE=cnpmcore npm run prepare-database
```

启动 web 服务：

```bash
DEBUG_LOCAL_SQL=true npm run dev
```

访问：

```bash
curl -v http://127.0.0.1:7001
```

### 运行单元测试

```bash
npm run test
```

## Controller 开发指南

目前只支持 HTTP 协议的 Controller，代码在 `app/port/controller` 目录下。
基于类继承的模式来实现，类关系大致如下：

```
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
我们约定所有用户权限验证都在 Controller 层完全，Service 和 Repository 不做权限校验。

如判断当前请求用户是否是包维护者：

```ts
const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
const pkg = await this.getPackageEntityByFullname(fullname);
await this.userRoleManager.requiredPackageMaintainer(pkg, authorizedUser);
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
