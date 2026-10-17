# 🚀 开启包同步服务

> 我们将以 `127.0.0.1:7001` 为例，演示如何开启包同步服务，在实际部署中请替换对应的 registry 站点，更多部署相关内容可以参考 [deploy-in-docker](./deploy-in-docker.md)

## 🔌 确保 registry 服务已开启

cnpmcore 实现了所有 registry 相关 api 这意味着我们可以直接使用 npm 客户端进行相关验证工作。

```bash
npm ping --registry=http://127.0.0.1:7001
```

预期输出

```bash
npm notice PING http://127.0.0.1:7001/
npm notice PONG 19ms
npm notice PONG {
npm notice PONG   "pong": true,
npm notice PONG   "use": 1.7822079999605194
npm notice PONG }
```

## 🔑 确认管理员账号

在默认配置中，我们内置了 `cnpmcore_admin` 作为管理员账号，你可以通过修改不同环境对应的配置文件来定义对应管理员账号。
此外，我们默认开启了 webAuth，只需执行 npm login 即可在命令行进行登录相关操作

```shell
npm login --registry=http://127.0.0.1:7001
```

预期将在浏览器唤起登录相关页面，输入账号 `cnpmcore_admin` 及密码即可（未创建时会自动注册）

```bash
Login at:
http://localhost:7001/-/v1/login/request/session/ada5af3e-773d-4e64-b8bb-e98ffe25d1c0
Press ENTER to open in the browser...
```

查看本地对应授权信息，注意服务端将不会存储 token 值，请妥善保存，或者进行对应 revoke 操作

```shell
cat ~/.npmrc
# //127.0.0.1:7001/:_authToken=cnpm_1byTg6qJuZZm3ZnMpFl43fz6DsbhwN2rH_373PXC
```

其中，`cnpm_1byTg6qJuZZm3ZnMpFl43fz6DsbhwN2rH_373PXC` 就是我们的管理员 token，后续我们将用这个 token 来进行同步任务初始化，我们可以通过 `whoami` 来验证 token 是否有效

```bash
curl -H "Authorization: Bearer cnpm_1byTg6qJuZZm3ZnMpFl43fz6DsbhwN2rH_373PXC" http://127.0.0.1:7001/-/whoami
```

## 🔄 开始同步

首先，我们需要将默认的 SyncMode 改为 `admin` 或 `all` 开启包同步服务。
目前 cnpmcore 支持多 registry 同步，系统会根据 `sourceRegistry` 自动创建对应 registry 记录，这里我们先通过一次同步任务来完成 registry 初始化。

```bash
# 客户端发起同步请求，这里我们尝试同步 cnpmcore 这个 npm 包
curl -H "Authorization: Bearer cnpm_1byTg6qJuZZm3ZnMpFl43fz6DsbhwN2rH_373PXC" -X PUT http://127.0.0.1:7001/-/package/cnpmcore/syncs

# 任务正在等待调度
{"ok":true,"id":"66115f2a7fe6f66eb7aab348","type":"sync_package","state":"waiting"}

npm view cnpmcore --registry=http://127.0.0.1:7001

# cnpmcore@3.53.4 | MIT | deps: 44 | versions: 178
# npm core
# https://github.com/cnpm/npmcore#readme
# ...
```

🎉 目前我们的 registry 服务已经支持包同步功能啦，下面我们将继续开启自动同步能力。

### 🤖 自动同步上游 changesStream

npm registry 将通过服务实时广播相关包变更，也就是 `changesStreamRegistry` 这个配置。我们可以开启 `enableChangesStream` 进行自动同步。可以观察 `tasks` 表内任务状态。

### 热门包延迟复查

热门包收到 changes 后的有限延迟复查支持通过 `cnpmcore.syncRecheck` 开启，默认关闭。
阈值、容量、共享下载量快照和重试预算见 [RFC 1170](./rfcs/1170-popular-package-sync-rechecks.md)。

### 📦 同步所有存量包

changesStream 内包含了包所有版本变更信息，在存量同步场景存在大量冗余，我们可以通过一个脚本来快速创建同步任务。

```typescript
import { load } from 'all-package-names';
import urllib from 'urllib';
import { setTimeout } from 'timers/promises';

async function createTask(url: string) {
  const result = await urllib.request(url, {
    method: 'PUT',
    timeout: 10000,
    dataType: 'json',
  });
  return result;
}

async function main() {
  const data = await load();
  const total = data.packageNames.length;
  console.log('Total %d packages', total);
  const lastIndex = 0;
  for (const [index, fullname] of data.packageNames.entries()) {
    if (index < lastIndex) continue;
    let success = false;

    while (!success) {
      try {
        const url = `http://localhost:7001/-/package/${fullname}/syncs`;
        const result = await createTask(url);
        const data = result.data;
        if (data && data.id) {
          const logUrl = `${url}/${data.id}/log`;
          console.log('[%s/%s] %s, status: %s, log: %s', index, total, fullname, result.status, logUrl);
        } else {
          console.log('[%s/%s] %s, status: %s, data: %j', index, total, fullname, result.status, data);
        }
        success = true;
      } catch (err: any) {
        console.error('[%s/%s] %s, error: %s', index, total, fullname, err.message);
        await setTimeout(1000);
      }
    }
  }
}

main();
```

## 🚗 使用 cnpm 作为默认的同步源

可以直接通过 cnpm 作为同步源，获得更稳定的同步效率。

```typescript
// 同步源
sourceRegistry: 'https://registry.npmmirror.com',
sourceRegistryIsCNpm: true,

// changesStream
changesStreamRegistry: 'https://registry.npmmirror.com/_changes',
changesStreamRegistryMode: ChangesStreamMode.json,
```

## 🎯 为 scope 指定单独同步源

在某些场景下，我们可能需要为特定的 scope 指定单独的同步源。例如，公司内部的一些私有包需要从特定的 registry 同步。以下是具体操作步骤：

### 1. 创建 Registry

首先需要创建一个新的 registry，并指定其 changesStream 信息：

```bash
# 创建新的 registry
curl -H "Authorization: Bearer cnpm_1byTg6qJuZZm3ZnMpFl43fz6DsbhwN2rH_373PXC" \
  -X POST http://127.0.0.1:7001/-/registry \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom-registry",
    "host": "https://custom.registry.com/",
    "changeStream": "https://custom.registry.com/_changes",
    "type": "cnpmcore"
  }'
```

### 2. 创建 Scope 并关联 Registry

创建完 registry 后，我们可以为特定的 scope 指定这个 registry：

```bash
# 创建 scope 并关联到指定的 registry
curl -H "Authorization: Bearer cnpm_1byTg6qJuZZm3ZnMpFl43fz6DsbhwN2rH_373PXC" \
  -X POST http://127.0.0.1:7001/-/scope \
  -H "Content-Type: application/json" \
  -d '{
    "name": "@custom",
    "registryId": "REGISTRY_ID"  # 替换为上一步创建的 registry ID
  }'
```

### 3. 开启自动同步

创建完 registry 和 scope 后，需要开启自动同步功能：

```bash
# 为指定的 registry 开启同步任务
curl -H "Authorization: Bearer cnpm_1byTg6qJuZZm3ZnMpFl43fz6DsbhwN2rH_373PXC" \
  -X POST http://127.0.0.1:7001/-/registry/REGISTRY_ID/sync \
  -H "Content-Type: application/json" \
  -d '{
    "since": "1"  # 可选参数，指定从哪个序列号开始同步
  }'
```
