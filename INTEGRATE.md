# 🥚 如何在 [tegg](https://github.com/eggjs/tegg) 中集成 cnpmcore

> 文档中的示例项目可以在 [这里](https://github.com/eggjs/examples/commit/bed580fe053ae573f8b63f6788002ff9c6e7a142) 查看，在开始前请确保已阅读 [DEVELOPER.md](DEVELOPER.md) 中的相关文档，完成本地开发环境搭建。

在生产环境中，我们也可以直接部署 cnpmcore 系统，实现完整的 Registry 镜像功能。
但通常，在企业内部会有一些内部的中间件服务或限制，例如文件存储、缓存服务、登录鉴权流程等。

除了源码部署、二次开发的方式，我们还提供了 npm 包的方式，便于 [tegg](https://github.com/eggjs/tegg) 应用集成。
这样既可以享受到丰富的自定义扩展能力，又可以享受到 cnpmcore 持续迭代的功能演进。

下面，让我们以 [tegg](https://github.com/eggjs/tegg) 初始化的应用为例，以 npm 包的方式集成 cnpmcore，并扩展登录功能，以支持企业内 [SSO](https://en.wikipedia.org/wiki/Single_sign-on) 登录。

## 🚀 快速开始

### 🆕 新建一个 tegg 应用

> 我们以 <https://github.com/eggjs/examples/tree/master/hello-tegg> 为例

```shell
.
├── app
│   ├── biz
│   ├── controller
│   └── middleware
├── config
│   ├── config.default.ts
│   └── plugin.ts
├── package.json
├── test
│   ├── biz
│   └── controller
└── tsconfig.json
```

### 📦︎ 安装 cnpmcore 修改对应配置

  ```shell
  npm i cnpmcore -S
  ```

1. 修改 `ts-config.json` 配置，这是因为 cnpmcore 使用了 [subPath](https://nodejs.org/api/packages.html#subpath-exports)

    ```json
    {
      "extends": "@eggjs/tsconfig",
      "compilerOptions": {
        "baseUrl": "./",
        "moduleResolution": "NodeNext",
        "target": "ES2020",
        "module": "Node16"
      }
    }
    ```

2. 修改 `config/plugin.ts` 文件，开启 cnpmcore 依赖的一些插件

    ```typescript
    // 开启如下插件
    {
      redis: {
        enable: true,
        package: 'egg-redis',
      },
      teggOrm: {
        enable: true,
        package: '@eggjs/tegg-orm-plugin',
      },
      eventbusModule: {
        enable: true,
        package: '@eggjs/tegg-eventbus-plugin',
      },
      tracer: {
        enable: true,
        package: 'egg-tracer',
      },
      typeboxValidate: {
        enable: true,
        package: 'egg-typebox-validate',
      },
    }
    ```

3. 修改 `config.default.ts` 文件，可以直接覆盖默认配置

```typescript
import { SyncMode } from 'cnpmcore/common/constants';
import { cnpmcoreConfig } from 'cnpmcore/common/config';

export default () => {
  const config = {};
  config.cnpmcore = {
    ...cnpmcoreConfig,
    enableChangesStream: false,
    syncMode: SyncMode.all,
    allowPublicRegistration: true,
    // 放开注册配置
  };
  return config;
}
```

### 🧑‍🤝‍🧑 集成 cnpmcore

1. 创建文件夹，用于存放自定义的 infra module，这里以 app/infra 为例

    ```shell
    ├── infra
    │   ├── AuthAdapter.ts
    │   ├── NFSAdapter.ts
    │   ├── QueueAdapter.ts
    │   └── package.json
    ```

* 添加 `package.json` ，声明 infra 作为一个 eggModule 单元

    ```JSON
    {
      "name": "infra",
      "eggModule": {
        "name": "infra"
      }
    }
    ```

* 添加 `XXXAdapter.ts` 在对应的 Adapter 中继承 cnpmcore 默认的 Adapter，以 AuthAdapter 为例

    ```typescript
      import { AccessLevel, SingletonProto } from '@eggjs/tegg';
      import { AuthAdapter } from 'cnpmcore/infra/AuthAdapter';

      @SingletonProto({
        name: 'authAdapter',
        accessLevel: AccessLevel.PUBLIC,
      })
      export class MyAuthAdapter extends AuthAdapter {
      }
    ```

2. 添加 `config/module.json`，将 cnpmcore 作为一个 module 集成进我们新增的 tegg 应用中

    ```json
    [
      {
        "path": "../app/biz"
      },
      {
        "path": "../app/infra"
      },
      {
        "package": "cnpmcore/common"
      },
      {
        "package": "cnpmcore/core"
      },
      {
        "package": "cnpmcore/port"
      },
      {
        "package": "cnpmcore/repository"
      }
    ]
    ```

### ✍🏻 重载 AuthAdapter 实现

我们以 AuthAdapter 为例，来实现 npm cli 的 SSO 登录的功能。

我们需要实现了 getAuthUrl 和 ensureCurrentUser 这两个方法:

  1. getAuthUrl 引导用户访问企业内实际的登录中心。
  2. ensureCurrentUser 当用户完成访问后，需要回调到应用进行鉴权流程。
我们约定通过 `POST /-/v1/login/sso/:sessionId` 这个路由来进行登录验证。
当然，你也可以任意修改地址和登录回调，只需保证更新 redis 中的 token 状态即可。

修改 AuthAdapter.ts 文件

```typescript
import { AccessLevel, EggContext, SingletonProto } from '@eggjs/tegg';
import { AuthAdapter } from 'cnpmcore/infra/AuthAdapter';
import { randomUUID } from 'crypto';
import { AuthUrlResult, userResult } from 'node_modules/cnpmcore/dist/app/common/typing';

const ONE_DAY = 3600 * 24;

@SingletonProto({
  name: 'authAdapter',
  accessLevel: AccessLevel.PUBLIC,
})
export class MyAuthAdapter extends AuthAdapter {
  async getAuthUrl(ctx: EggContext): Promise<AuthUrlResult> {
    const sessionId = randomUUID();
    await this.redis.setex(sessionId, ONE_DAY, '');
    return {
      // 替换实际企业内的登录中心地址，这里我们以系统内默认的 hello 路由为例
      loginUrl: `${ctx.origin}/hello?name=${sessionId}`,
      doneUrl: `${ctx.href}/done/session/${sessionId}`,
    };
  }

  async ensureCurrentUser(): Promise<userResult | null> {
    return {
      name: 'hello',
      email: 'hello@cnpmjs.org',
    };
  }
}

```

### 自定义依赖冷静期

开启 `enableDependencyIsolation` 后，集成侧可以重载 `DependencyIsolationAdapter`，为不同包版本返回自定义的冷静期截止时间和拦截文案。返回 `null` 表示该版本不进入冷静期。
集成侧未提供 `dependencyIsolationAdapter` 时会自动使用默认策略，默认 reason 中的释放时间使用 GMT+8（`+08:00`）。

```typescript
import { AccessLevel, SingletonProto } from '@eggjs/tegg';
import {
  DependencyIsolationAdapter,
} from 'cnpmcore/infra/DependencyIsolationAdapter';
import {
  DependencyIsolationContext,
  DependencyIsolationPolicy,
} from 'cnpmcore/common/typing';

@SingletonProto({
  name: 'dependencyIsolationAdapter',
  accessLevel: AccessLevel.PUBLIC,
})
export class MyDependencyIsolationAdapter extends DependencyIsolationAdapter {
  async ensureDependencyIsolation(
    context: DependencyIsolationContext,
  ): Promise<DependencyIsolationPolicy | null> {
    const expiredAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    return {
      expiredAt,
      reason: `${context.fullname}@${context.version} is waiting for security review`,
    };
  }
}
```

修改 HelloController 的实现，实际也可以通过登录中心回调、页面确认等方式实现

```typescript
  // 触发回调接口，会自动完成用户创建
  await this.httpclient.request(`${ctx.origin}/-/v1/login/sso/${name}`, { method: 'POST' });
```

## 🎉 功能验证

1. 在命令行输入 `npm login --registry=http://127.0.0.1:7001`

    ```shell
    npm login --registry=http://127.0.0.1:7001
    npm notice Log in on http://127.0.0.1:7001/
    Login at:
    http://127.0.0.1:7001/hello?name=e44e8c43-211a-4bcd-ae78-c4cbb1a78ae7
    Press ENTER to open in the browser...
    ```

2. 界面提示回车打开浏览器访问登录中心，也就是我们在 getAuthUrl，返回的 loginUrl 配置

3. 由于我们 mock 了对应实现，界面会直接显示登录成功

    ```shell
    Logged in on http://127.0.0.1:7001/.
    ```

4. 在命令行输入 `npm whoami --registry=http://127.0.0.1:7001` 验证

    ```shell
    npm whoami --registry=http://127.0.0.1:7001
    hello
    ```
