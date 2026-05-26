# RFC: 依赖隔离区（Dependency Buffer Zone）

- **状态**：Draft
- **作者**：@elrrrrrrr
- **日期**：2026-04-28
- **关联系统**：cnpmcore、neoVision、安全扫描、sofamq

---

## 1. 背景

npmcore（基于 cnpmcore 的内部集成版本）从 `registry.npmmirror.com` 实时同步外部 npm 依赖：

- **同步触发入口**（内部版本与开源 cnpmcore 有差异，以下为内部实际形态）
  - **用户主动发起**：用户通过两条路径手动发起同步任务，最终都落到 `PUT /-/package/:fullname/syncs`（`PackageSyncController.createSyncTask`）
    - `tnpm` 客户端：`tnpm sync <pkg>` 命令直连 registry
    - 海兔资产中心前端：白屏点击「同步依赖」按钮，由前端调 registry 接口
    - `DownloadRequestAdvice`（`app/npm/biz/DownloadRequestAdvice.ts`）拦截下载请求后只做 OSS 重定向 + 计数，**不会自动入队同步任务**
  - **ChangesStream 主动监听**：`ChangesStreamWorker`（每 60s）拉上游 `_changes` 流，受 DRM 开关 `com.alipay.npmcore.ops.changeStreamWorkerSwitch` 控制
  - **任务队列维护**：`TaskController` 提供 `PUT /api/admin/npm/task/:taskId/retry` 与 `POST /api/admin/npm/rebuildQueue`，仅用于运维侧重试/重建队列，不是新同步入口
- **执行链路**：`SyncPackageWorker`（每 1s 轮询）→ cnpmcore 原生 `PackageSyncerService.executeTask`（内部版本未重写）→ 拉 manifest → 下 tarball → `packageManagerService.publish()` 落库 + 上传 NFS → **立即对所有用户可见**
- **现有准入控制**
  - `syncPackageBlockList`：包名级黑名单（事后兜底）
  - `PackageBlock` / `blockPackageVersion()` / `blockPackage()`：版本/包级拉黑，已存在 `blockReason` 字段
  - `allowScopes`：私有 scope 隔离同步
- **安全侧现状（已落地，不重做）**
  - 每个新同步的版本会触发安全扫描任务
  - 拉黑消费者：`BlockPackage`（`app/npm_security/message/BlockPackage.ts`），订阅 sofamq topic `TP_TNPM_BAN`、group `GID_NPMCORE`，处理 `BLOCK` / `PASS` 事件
  - 黑名单同步：`SyncPackageBlacklist`（`app/npm_security/schedule/SyncPackageBlacklist.ts`），定时事件 `EC_NPMCORE_SYNC_PACKAGE_BLACKLIST`，从 `bksupplysec.mybank.cn` 拉供应链安全黑名单

## 2. 问题

**核心问题：包从同步完成到对所有用户可见，没有缓冲。**

- 业务方手动触发 `PUT /syncs` 后，任务出队、tarball 落库即对所有用户可见，安全扫描和 `TP_TNPM_BAN` 拉黑事件还没回报
- 供应链攻击窗口 = "上游发布" → "业务方触发同步" → "落库可见" 之间的几十秒到几分钟
- 现有 `syncPackageBlockList` / `blockPackageVersion()` / `bksupplysec` 黑名单都是 **事后兜底**，命中条件是"已知坏"，对 0day / 投毒攻击无效
- 业务方对"哪个版本被拦了 / 为什么暂时不能用"没有可见的查询入口，定位靠经验

## 3. 目标

1. 引入 **依赖隔离区（缓冲区）**：包同步入库后默认进入 6h 静默期，对所有用户不可见
2. 静默期内广播给现有订阅者：**安全扫描（现有）** + **neoVision H1 业务回归（新增）**，命中风险则升级为永久拉黑
3. 提供 **逃逸通道**：包级 / scope 级白名单 + 白屏管理员审批
4. **完全复用** 现有 block 表 + `TP_TNPM_BAN` topic，零 schema 变更，零新增 topic
5. 业务方有 **只读查询接口**，能看到当前缓冲区里有哪些版本、为什么 block

## 4. 非目标

- 不改变同步触发逻辑（被动 / 主动入口照旧）
- 不改 NFS 存储格式、不动 tarball 落地路径
- 不重做现有安全扫描和 neoVision 内部实现
- 不引入独立的 staging registry 集群，**在主 registry 上做状态机**

## 5. 方案

### 5.1 总体流程对比

**旧流程**

```
拉 manifest → 下 tgz → publish → 全员可见
                                    ↓ 异步
                                  触发扫描
```

**新流程（端到端时序）**

```
 ┌──────────────┐   ┌──────────┐   ┌──────────────────┐   ┌─────────────┐   ┌──────────┐
 │ tnpm 客户端  │   │ 海兔资产 │   │  registry 接口   │   │ npmcore     │   │ block 表 │
 │              │   │  中心    │   │  PUT /syncs      │   │ Syncer+AOP  │   │          │
 └──────┬───────┘   └─────┬────┘   └────────┬─────────┘   └──────┬──────┘   └────┬─────┘
        │ tnpm sync       │                 │                    │               │
        ├────────────────►│                 │                    │               │
        │                 │ 点击「同步」    │                    │               │
        │                 ├────────────────►│                    │               │
        │                 │                 │  入队 SyncPackage  │               │
        │                 │                 ├───────────────────►│               │
        │                 │                 │                    │ publish + NFS │
        │                 │                 │                    ├──────────────►│
        │                 │                 │                    │ insert        │
        │                 │                 │                    │ reason='[buffer] release at T+6h'
        │                 │                 │                    │               │
        │                 │                 │                    │ ① 广播 enter-buffer 消息
        │                 │                 │                    ├──────┐        │
        │                 │                 │                    │      ▼        │
        │                 │                 │                    │  ┌─────────────────────┐
        │                 │                 │                    │  │ TP_TNPM_BAN  topic  │
        │                 │                 │                    │  │  (sofamq 广播)      │
        │                 │                 │                    │  └──┬───────────┬──────┘
        │                 │                 │                    │     │           │
        │                 │                 │                    │  ②订阅       ②订阅
        │                 │                 │                    │     ▼           ▼
        │                 │                 │                    │ ┌────────┐ ┌──────────┐
        │                 │                 │                    │ │ 安全   │ │ neoVision│
        │                 │                 │                    │ │ 扫描   │ │  H1 回归 │
        │                 │                 │                    │ └───┬────┘ └────┬─────┘
        │                 │                 │                    │     │ 拉 tarball + 跑检测
        │                 │                 │                    │     │           │
        │                 │                 │                    │     │ 命中? ────┤
        │                 │                 │                    │     │           │
        │                 │                 │                    │     ▼           ▼
        │                 │                 │                    │   ④ BLOCK 消息回投 TP_TNPM_BAN
        │                 │                 │                    │           │
        │                 │                 │                    │  BlockPackage 消费者
        │                 │                 │                    │     ↓
        │                 │                 │                    │  insert reason='[security] ...' / '[neovision] ...'
        │                 │                 │                    │     │
                                                                       ▼
                                              ⑥ 永久拉黑：buffer + security/neovision 共存

  ─── T+6h ───
        │                 │                 │                    │
        │                 │                 │  BufferReleaseQueue 触发
        │                 │                 │                    │
        │                 │                 │   listPackageVersionBlocks ?
        │                 │                 │   ┌────────────────┴───────────────┐
        │                 │                 │   ▼                                ▼
        │                 │                 │  ⑤ 仅 [buffer] 记录             ⑥ 还有其他前缀
        │                 │                 │   removePackageVersionBlock        do nothing
        │                 │                 │   → 版本对外可用                   → 永久拉黑
        │                 │                 │
```

**状态机（一个 block 记录的生命周期）**

```
                        ┌──────────────────────┐
   sync 完成 ──────────►│  [buffer]  (6h 倒计时) │
                        └────────┬─────────────┘
                                 │
                ┌────────────────┼─────────────────────────────┐
                │                │                             │
       ① 6h 到期 + 无其他    ② 期间被安全/                 ③ 命中白名单 /
          block 记录            neoVision 加 [security]         管理员审批通过
                │                / [neovision] 记录             ticket
                ▼                ▼                              ▼
          buffer 记录被     buffer 记录保留 +                 buffer 记录
          自动 remove       新增永久拉黑记录                   被提前 remove
                │                │                              │
                ▼                ▼                              ▼
            版本可用         版本永久不可用                    版本可用
                            （只有管理员能解）
```

### 5.2 实现原理：复用 block 表，零结构变更

**完全复用现有 `package_version_blocks` 表**，不新增表，不新增字段。现有字段：

```
id, gmt_create, gmt_modified, package_id, package_version_block_id, version, reason
```

**通过 `reason` 字段前缀约定区分记录来源**

| 前缀 | 来源 | 是否可被自动解除 |
|---|---|---|
| `[buffer]` | 缓冲区记录，sync 落库时写入 | ✅ 6h 到期由解除队列删除 |
| `[security]` | 安全扫描拉黑 | ❌ 仅管理员手动 |
| `[neovision]` | neoVision 回归命中 | ❌ 仅管理员手动 |
| `[bksupplysec]` | 供应链黑名单同步 | ❌ 仅管理员手动 |
| 其他 / 无前缀 | 历史 manual 记录 | ❌ 仅管理员手动 |

示例 `reason`：

```
[buffer] in dependency buffer zone, release at 2026-04-28T20:00:00Z
[security] CVE-2024-XXXX detected by scan v3.2
[neovision] H1 regression failed: payment flow timeout
```

**关键属性的"无字段"实现**

| 概念 | 实现方式 |
|---|---|
| 记录类型 | `reason` 字段前缀，`LIKE '[buffer]%'` 查询 |
| 进入时间 | 复用现有 `gmt_create` |
| 是否可自动解除 | 由 `reason` 前缀推导，逻辑写在 service 层，不落库 |
| 预计放出时间 | 写入 `reason` 字符串里（运维可读，机器也可解析），或由 `gmt_create + bufferDurationMs` 计算 |

**默认行为**

- `[buffer]` 记录：从 sync 落库瞬间写入，所有用户视角等同 blocked，**默认不可用**
- 其他前缀记录：保留现状，永久 block，**只能管理员手动解除**
- 多类型可叠加：一个版本可能同时存在 `[buffer]` + `[security]` 两条记录，任何一条存在都判定为不可用

**解除逻辑（关键）**

> 安全、neoVision 只具备拉黑能力，**不具备解除拦截能力**。解除只能由管理员或缓冲区到期机制处理。

- `[buffer]` 记录：由 npmcore 内部新增的 `BufferReleaseQueue` 消费，6h 后尝试自动 `removePackageVersionBlock`（详见 5.3）
- 其他前缀记录：管理员通过白屏审批后人工解除，没有自动通道
- 一个版本要"对外可用"，必须**所有 block 记录都被移除**（即 `findPackageVersionBlock` 返回空 + 全包级 `*` 记录也不存在）

### 5.3 入库逻辑 + 解除队列

cnpmcore 原生 `PackageSyncerService` 在内部版本未被重写，建议在 npmcore 侧通过 AOP（参考现有 `DownloadRequestAdvice` 的拦截模式）切到 `executeTask()` 之后。

**入库流程**

1. cnpmcore 完成 `publish()`、tarball 上传 NFS（不动）
2. AOP 后置切面：
   - 检查白名单（5.5），命中则跳过整个缓冲流程
   - 否则调用现有 `savePackageVersionBlock()`，写入 reason 形如 `[buffer] in dependency buffer zone, release at <ISO ts>`
3. 触发安全扫描（payload 带 tarball NFS 地址，让扫描方少一跳）
4. 触发 neoVision H1 回归任务

**解除队列 `BufferReleaseQueue`（npmcore 新增）**

- 入库时把 `{ fullname, version, releaseAt: gmt_create + bufferDurationMs }` 投递到内部延迟队列（基于现有 Redis）
- 6h 后消费者拉起，按以下顺序判定（全部基于 `listPackageVersionBlocks(packageId)` + reason 前缀过滤）：
  1. 该版本是否还存在 `reason LIKE '[buffer]%'` 的记录？不存在说明已被管理员手动放出，跳过
  2. 该版本是否存在其他前缀的 block 记录？存在则**不删除 buffer 记录**，留给管理员处理
  3. 都通过 → 调用现有 `removePackageVersionBlock(packageVersionBlockId)`，版本对外可用
- 无论是否成功解除，都打 Tracer log（标记 `source=auto-release`），并推一条事件到海兔资产中心刷新前端列表
- 队列消费失败重试 3 次；终态失败时人工介入

**dist-tags 与 manifest 可见性**

block 表本身就是版本可见性的真值源，缓冲区记录的过滤逻辑直接复用现有 `findPackageVersionBlock` / `listPackageVersionBlocks` 的拦截路径，不需要单独维护"隐藏 latest"逻辑：

- 落 `[buffer]` 记录的版本 = 现有 block 拦截下载逻辑命中 = 客户端 install 报错 → 不会被选作 `latest`
- manifest 接口对外返回 `versions` 字典时，过滤掉所有有 block 记录的版本（无论 reason 前缀）
- 管理员视角接口（带 admin token）可见全量，便于审批操作

### 5.4 缓冲期配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `bufferDurationMs` | `6 * 3600 * 1000` | 缓冲时长，6h（DRM 可热更） |
| `bufferReleaseQueueKey` | `npmcore:buffer:release` | 解除队列 Redis key |
| `bufferEscapeAllowList` | `[]` | 跳过缓冲的包/scope 白名单（详见 5.5） |

> 没有 `requiredChecks` 概念 —— 安全/neoVision 不参与 release 决策，只能加 block，不能给 pass。"无安全 block + 6h 到期"即放行。

### 5.5 逃逸通道（白名单 + 白屏审批）

逃逸 = 跳过 6h 缓冲 / 提前解除 buffer 记录。两条独立通路：

**逃逸路径 A：白名单（自动，不进缓冲区）**

`bufferEscapeAllowList` 配置，支持三种粒度：

```ts
bufferEscapeAllowList: [
  'lodash',           // 包名精确匹配
  '@scope/*',         // scope 通配
  '@scope/pkg',       // scope 下精确包
]
```

AOP 后置切面命中白名单时**根本不写 buffer 记录**，等同立即可用。

> 用途：底层基础库、生态深度信任的包。白名单变更走 PR 评审 + DRM 推送。

**逃逸路径 B：白屏审批（人工提前解除）**

走海兔资产中心前端，**复用 `npm_security` 现有的 `Ticket` 实体**，新增一种 ticket 类型 `buffer_escape`，payload 里带 `{ fullname, version, reason }`：

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/-/buffer/escape` | 业务方提交申请，落一条 `buffer_escape` ticket |
| `GET` | `/-/buffer/escape` | 申请人 / 管理员列表查询（走现有 ticket 列表接口） |
| `PUT` | `/-/buffer/escape/:id/approve` | 管理员审批通过 → 删除该版本的 buffer 记录 |
| `PUT` | `/-/buffer/escape/:id/reject` | 管理员驳回 |

审批通过仅删除 `blockType=buffer` 记录，**不影响其他类型 block**（如 security 已经拉黑则申请通过也不解封，需要走 security 类的另一个解封流程）。

### 5.6 安全扫描 / neoVision 如何消费缓冲区版本

**核心原则**：安全和 neoVision 只能写"加 block 记录"，不能写"删 block 记录"。它们消费缓冲区版本的方式是：

1. **拿到待扫描版本**：通过两条途径
   - **被动推送**（推荐）：AOP 入库时，除了写 buffer 记录，同时投递扫描任务到现有链路，payload 带 tarball NFS 地址
   - **主动拉取**（兜底）：扫描方可调 `GET /-/buffer/list?status=pending`，拿到当前缓冲区里所有版本，自行调度
2. **下载 tarball**：直接走 NFS 地址 / `registry.antgroup-inc.cn` tarball URL，**不受 buffer 记录影响**（tarball 文件本身可达，只是 manifest/version 对外不可见）
3. **回报结果**：
   - 命中风险 → 通过 `TP_TNPM_BAN` 投递 `BLOCK` 事件，`BlockPackage` 消费者写一条 `blockType: 'security'` 或 `'neovision'` 的记录（与 buffer 记录共存）
   - 未命中 → **什么都不做**，6h 到期由 `BufferReleaseQueue` 自动放行
4. **撤回拉黑能力**：安全/neoVision 不开放 unblock 通道，要解除 security/neovision 类记录只能管理员白屏操作

**链路改动**

- `BlockPackage` 消费者扩展：按消息 `source` 字段拼 reason 前缀（`[security]` / `[neovision]` / `[bksupplysec]`），仍然走 `savePackageVersionBlock()`
- 扫描方需要能直接读 tarball，提供 `GET /-/buffer/list` 列表接口供拉取扫描清单（按 `reason LIKE '[buffer]%'` 过滤）
- 既有 `blockPackageVersion()` / `removePackageVersionBlock()` / reason 字段直接复用，零结构变更

### 5.7 neoVision H1 业务回归（新增）

- 同步完成后通过 `TP_TNPM_BAN` 广播 enter-buffer 事件，neoVision 订阅消费
- 回归用 `npm overrides` 把指定包指向待验证版本，跑 H1 主路径
- **只能投 BLOCK，不能投 PASS**：不参与 release 决策，命中即升级为永久拉黑，未命中默默不动作
- 不是所有包都能跑回归（工具链、纯 build-time 依赖、纯类型包），由 neoVision 自行判定"豁免回归"，cnpmcore 不感知

### 5.8 消息契约（复用 `TP_TNPM_BAN`）

> 仅定接口语义，具体 schema 后续技术评审补。

- **完全复用** 现有 sofamq topic `TP_TNPM_BAN`（group `GID_NPMCORE`），不另起新 topic
- 事件类型扩展为三种：
  - `ENTER_BUFFER`（新增）：npmcore 作为生产者，广播某 version 进入缓冲区，订阅方（安全 / neoVision）拉起检测
  - `BLOCK`（既有）：任意生产者上报命中风险，`BlockPackage` 消费者按消息 `source` 字段拼 reason 前缀（`[security]` / `[neovision]` / `[bksupplysec]`），写一条 block 记录
  - `UNBLOCK`（既有）：保留语义，仅管理员/系统使用
- payload 增加 `source` 字段（`npmcore-buffer` / `security-scan` / `neovision-h1` / `bksupplysec` / `manual`），用于 reason 前缀拼接
- `SyncPackageBlacklist` 的 `bksupplysec` 黑名单同步保留独立调度，落地时也通过 `TP_TNPM_BAN` 转发，下游只需关心一个 topic

### 5.9 缓冲区可见性接口

为业务方排查 install 失败、为安全/neoVision 拉取待扫描清单提供入口：

| 方法 | 路径 | 用途 | 受众 |
|---|---|---|---|
| `GET` | `/-/buffer/list?fullname=xxx` | 查询某包当前在缓冲的版本，附 enterAt、剩余时长 | 业务方只读 |
| `GET` | `/-/buffer/list?status=pending` | 全量缓冲版本列表（分页） | 安全/neoVision 拉取 |
| `GET` | `/-/buffer/version/:fullname/:version` | 单版本详情，含全部 block 记录类型 | 业务方 + 管理员 |

业务方 install 失败时拿到的报错附带：

```
Package <name>@<version> is currently in dependency buffer zone.
See https://<registry>/-/buffer/list?fullname=<name>
```

> **可见性约束**：业务方接口仅返回包名 / 版本 / 进入时间 / 剩余时长，不暴露具体扫描结果（避免帮攻击者反推绕过策略）。安全/neoVision 拉取接口需要鉴权 token。

## 6. 数据模型变更

**核心思路：零 schema 变更。** 不新增表、不新增字段、不新增索引。所有语义通过现有字段的约定承载。

### 6.1 `package_version_blocks` 表（现有，零变更）

现有字段：`id` / `gmt_create` / `gmt_modified` / `package_id` / `package_version_block_id` / `version` / `reason`

| 概念 | 复用方式 |
|---|---|
| 缓冲区 / 安全 / neoVision / 黑名单 / 手动 类型 | `reason` 前缀 `[buffer]` / `[security]` / `[neovision]` / `[bksupplysec]` / `[manual]` |
| 进入缓冲时间 | `gmt_create` |
| 预计放出时间 | `gmt_create + config.bufferDurationMs`（运行时计算）+ reason 字符串里冗余一份给运维肉眼读 |
| 是否可被自动解除 | reason 前缀 = `[buffer]` 即可，逻辑写在 service 层 |
| 多记录共存判定不可用 | 现有 `findPackageVersionBlock` / `listPackageVersionBlocks` 不变 |

> 历史记录无需 backfill：现有 reason 没有方括号前缀，会被识别为 `manual` 类，行为与现状一致。

### 6.2 不新增任何表 / 任何字段

- **审批工单**：复用 `npm_security` 现有的 `Ticket` 表，新增一种 ticket 类型枚举值 `buffer_escape`，payload 里带 `fullname` / `version` / `reason`
- **审计**：block 表本身的 insert/delete 即审计入口（带 `gmt_create` / `gmt_modified`），删除前后打 Tracer log 标记来源（`source=auto-release` / `source=admin` / `source=ticket-approve`）
- **解除队列**：基于现有 Redis（`RedisQueueAdapter`），不落 DB
- **rebuild 兜底**：服务重启不影响正确性 —— 即便延迟队列丢消息，也可以由扫表任务（每 5min 扫一次 `reason LIKE '[buffer]%' AND gmt_create < now() - bufferDurationMs`）补齐


## 7. 兼容性 & 迁移

- **零 schema 变更**，无需任何 ALTER TABLE / 新表迁移
- 历史 block 记录无前缀，service 层识别为 `manual` 类，行为与现状一致
- 新同步进来的包从上线开始写 `[buffer]` 记录
- **灰度策略**
  - 阶段 1：开 1h 缓冲，仅观察解除队列消费延迟、消息链路稳定性、扫描方接入情况
  - 阶段 2：升到 6h，开放白屏审批工单通道
  - 阶段 3：开放 `bufferEscapeAllowList` 白名单 + 接入 neoVision H1 订阅

## 8. 失败模式与风险

| 风险 | 缓解 |
|---|---|
| 6h 缓冲太长导致业务投诉无法 install 新版本 | 白名单 + 白屏审批兜底；业务方可查询接口预知放出时间 |
| Redis 解除队列丢消息，version 永远卡 `[buffer]` | 定时扫表兜底（`reason LIKE '[buffer]%' AND gmt_create < now() - bufferDurationMs`），每 5min 补一次 |
| 扫描 / 回归任务积压，6h 内未跑完 | 不阻塞 release（安全/neoVision 不参与放行决策）；扫描方未及时 BLOCK 是它们自己的 SLA 问题，不是 cnpmcore 的 |
| 多集群（参见 prod_multi_cluster：sync 与 consumer 分集群、Redis 不共享） | block 表 DB 共享，扫表兜底天然跨集群一致；解除队列只需保证至少一个集群能消费即可（`removePackageVersionBlock` 幂等） |
| 攻击者通过白屏审批通道绕过 | 申请必须实名 + 审批人不能等于申请人 + ticket 表本身是审计源 |
| 缓冲列表暴露给外部反推绕过窗口 | 业务方接口仅返回包名 / 版本 / 进入时间 / 剩余时长，不暴露扫描细节；安全/neoVision 拉清单接口需 token 鉴权 |

## 9. 推进计划

| 阶段 | 内容 | 负责方 |
|---|---|---|
| P0 | AOP 切入 `executeTask` 后置 + 写 `[buffer]` 记录 + Redis 解除队列 + 扫表兜底 | npmcore |
| P1 | 缓冲区只读列表接口 + install 报错带链接 + manifest 过滤 block 版本 | npmcore |
| P2 | `bufferEscapeAllowList` 白名单（DRM 配置）+ 白屏审批 ticket（复用 `Ticket` 表） | npmcore + 海兔资产中心 |
| P3 | `TP_TNPM_BAN` 扩展 `ENTER_BUFFER` 事件 + neoVision H1 订阅接入 | npmcore + neoVision + 安全 |
| P4 | `bksupplysec` 改走 `TP_TNPM_BAN` 转发，下游统一 topic | npmcore + 安全 |

## 10. 常见问题（FAQ）

### Q1：依赖如何解封 / 逃逸？

按 block 记录的 `reason` 前缀区分，没有"统一解封"通道：

| reason 前缀 | 解封方式 |
|---|---|
| `[buffer]` | ① 6h 到期，`BufferReleaseQueue` 自动 `removePackageVersionBlock`；② 命中 `bufferEscapeAllowList` 白名单，**入库时根本不写**；③ 业务方走海兔资产中心提 `buffer_escape` ticket，管理员审批通过 |
| `[security]` / `[neovision]` / `[bksupplysec]` | **只能管理员白屏手动解除**，没有自动通道、没有时效。安全和 neoVision 仅有"加 block"权限，无"删 block"权限 |
| 其他（无前缀，等同 manual） | 管理员加的、管理员删 |

一个版本要恢复可用 = 该版本下**所有** block 记录都被删除（`listPackageVersionBlocks` 返回空）。

### Q2：安全 / neoVision 如何消费缓冲区版本？

两条获取途径：

1. **被动推送**（推荐）：AOP 入库后置切面投递扫描任务，payload 带 tarball NFS 地址 → 扫描方直接用
2. **主动拉取**（兜底）：`GET /-/buffer/list?status=pending`（鉴权 token）→ 拉到全量待扫描清单，自行调度

回报方式：

- 命中风险 → 走现有 `TP_TNPM_BAN` 投递 `BLOCK` 事件，`BlockPackage` 消费者按 `source` 字段拼 reason 前缀（`[security] ...` 或 `[neovision] ...`），与 `[buffer]` 记录共存
- 未命中 → **什么都不做**，6h 到期由解除队列自动放行

> 关键：tarball 文件本身在 NFS 上始终可达，buffer 记录只挡 manifest/version 的对外可见性，不挡扫描方下载。

### Q3：如何自动触发解除隔离？

依赖 npmcore 内部新增的 `BufferReleaseQueue`：

1. **入队**：AOP 后置切面写完 buffer 记录后，往 Redis 延迟队列投 `{ fullname, version, releaseAt: now() + bufferDurationMs }`
2. **触发**：到 `releaseAt` 时间点，消费者拉起任务
3. **判定逻辑**（全部基于 `listPackageVersionBlocks` + reason 前缀过滤，无 schema 依赖）：
   - 该版本是否还存在 `reason LIKE '[buffer]%'` 记录？不在说明已被管理员手动放出，跳过
   - 该版本是否还有其他前缀的 block 记录？有 → 不解除 buffer 记录（或者说就算解了 buffer，版本仍被其他记录 block，效果一样），留给管理员处理
   - 都通过 → 调用 `removePackageVersionBlock(packageVersionBlockId)`，版本对外可用
4. **审计**：调用前后打 Tracer log，标记 `source=auto-release`
5. **失败重试**：消费失败重试 3 次（间隔 1min/5min/30min），终态失败告警人工介入
6. **幂等**：删除时按 `reason LIKE '[buffer]%'` 过滤，重复消费无副作用
7. **兜底**：定时扫表任务（每 5min）补漏 —— `SELECT * WHERE reason LIKE '[buffer]%' AND gmt_create < now() - bufferDurationMs`，防止 Redis 队列丢消息

> 解除队列**不感知**安全 / neoVision 的扫描状态，它只负责到期尝试删 buffer 记录。其他类型 block 是否存在，是它判定"是否需要解"的输入，不是"是否能解"的依赖。

## 11. 待讨论

1. **H1 回归豁免规则**：由 neoVision 自己判定还是 cnpmcore 提供包元数据辅助（如 `keywords` 含 `types-only`）？
2. **缓冲列表可见性边界**：业务方可见最小信息是什么？是否要按 token / scope 分层（让其他 BU 看不到本 BU 在测什么版本）？
3. **多集群下解除一致性**：DB 共享但 Redis 不共享，定时扫表兜底是各集群各跑（依赖 `removePackageVersionBlock` 幂等）还是抢锁 leader 跑？
4. **`bufferEscapeAllowList` 配置位置**：DRM 还是 DB 表？DRM 热更但缺评审，DB 表灵活但又违背"零新表"原则（可考虑塞到 npm_security 现有 Whitelist 表）
5. **改动落点**：新增逻辑放 npmcore 内部仓（AOP 拦截覆盖 cnpmcore 行为）还是回流开源 cnpmcore？前者快但只服务内部
6. **`TP_TNPM_BAN` 扩展 `ENTER_BUFFER` 事件**：对现有外部消费者是否破坏向后兼容？是否需要 schema 版本号或新建子 topic
7. **manifest 过滤性能**：每次 GET manifest 都查 block 表 → 是否需要 cache？block 记录变化时的失效策略

