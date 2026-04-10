# Org 与 Team 管理

cnpmcore 支持 Organization -> Team -> Package 权限模型，用于管理私有包的访问控制。

## 概念

| 概念 | 说明 |
|------|------|
| **Org** | 组织，对应一个 scope（例如 org `mycompany` -> `@mycompany`） |
| **OrgMember** | 组织成员，角色为 `owner`（可管理）或 `member` |
| **Team** | 权限单元。每个 Org 自动创建 `developers` 默认团队 |
| **TeamMember** | 团队成员，角色为 `owner`（可管理团队）或 `member` |
| **TeamPackage** | 团队对包的读取授权 |

## 协议兼容性

cnpmcore 同时实现了 **npm CLI 兼容**接口和**私有（扩展）**接口。

| 标签 | 含义 |
|------|------|
| **npm 兼容** | 遵循 npm registry API 协议，请求/响应格式兼容 `npm` CLI |
| **私有** | cnpmcore 扩展，不属于 npm registry API，使用自定义路由或额外字段（如 `role`） |

> **规则**：npm 兼容接口的响应格式不会改变，扩展字段（如 `role`）仅通过私有接口提供。

## Team 角色扩展

### npm 原始模型的问题

在 npm 原始模型中，`@scope` 对应一个 Org，Org 下的 Team 没有角色信息。Team 成员是扁平的——只有"在"或"不在"两种状态，所有能操作 Team 的人拥有相同权限。

这在企业场景中会产生问题：企业通常只有一个 Org（对应一个 `@scope`），所有员工都是 Org 成员。由于 npm 的 Team 没有角色区分，**任何 Org 成员都可以随意修改任何 Team**——添加/删除成员、授权/撤销包访问——这在实际使用中是不可接受的。

### cnpmcore 的扩展方案

cnpmcore 在保持 npm CLI 完全兼容的前提下，为 Team 成员增加了 `role` 字段：

- **owner** — 可以管理 Team（增删成员、管理包授权、删除 Team）
- **member** — 普通成员，仅拥有 Team 授权范围内的包读取权限

#### 核心行为

1. **创建 Team 时**，创建者自动成为 Team Owner
2. **Team 的写操作**（增删成员、管理包、删除 Team）要求操作者是 Team Owner、Org Owner 或 Admin
3. 普通 Org 成员**无法直接管理其他人的 Team**
4. **授权包访问时**，非 Admin 用户只能添加自己是 maintainer 的包（Admin 可以添加任意包）

#### npm CLI 兼容性

用户仍然可以通过 npm CLI 直接创建和管理自己的 Team：

```bash
# 创建 Team（创建者自动成为 owner）
npm team create @mycompany:frontend --registry=http://localhost:7001

# 添加成员（仅 team owner 可操作，通过 npm CLI 添加的成员默认为 member）
npm team add @mycompany:frontend alice --registry=http://localhost:7001

# 查看成员（返回纯用户名列表，兼容 npm CLI）
npm team ls @mycompany:frontend --registry=http://localhost:7001
```

#### 私有接口补充

由于 npm CLI 不支持 Team 角色概念，以下操作需要通过私有接口完成：

- **查看成员角色** — `GET /-/team/:org/:team/member`
- **修改成员角色** — `PATCH /-/team/:org/:team/member/:username`

```bash
# 查看成员（含角色信息）
curl http://localhost:7001/-/team/mycompany/frontend/member \
  -H "Authorization: Bearer <token>"
# 返回: [{"user": "alice", "role": "owner"}, {"user": "bob", "role": "member"}]

# 将成员提升为 team owner
curl -X PATCH http://localhost:7001/-/team/mycompany/frontend/member/alice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "owner"}'

# 将成员降为普通 member
curl -X PATCH http://localhost:7001/-/team/mycompany/frontend/member/alice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'
```

## Org 管理（仅限 Admin）

### 创建 Org

```bash
curl -X PUT http://localhost:7001/-/org \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "mycompany", "description": "My Company"}'
```

### 删除 Org

```bash
# 级联删除所有团队、成员和包授权
curl -X DELETE http://localhost:7001/-/org/mycompany \
  -H "Authorization: Bearer <admin-token>"
```

### 查看 Org 信息

```bash
curl http://localhost:7001/-/org/mycompany \
  -H "Authorization: Bearer <token>"
```

## 成员管理

Admin 或 Org Owner 可以管理成员。

### 添加成员（npm CLI 兼容）

```bash
# npm CLI
npm org set mycompany alice --registry=http://localhost:7001

# 设为 owner
npm org set mycompany alice owner --registry=http://localhost:7001

# HTTP
curl -X PUT http://localhost:7001/-/org/mycompany/member \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice", "role": "member"}'
```

新成员会**自动加入 `developers` 团队**。

### 查看成员（npm CLI 兼容）

```bash
# npm CLI
npm org ls mycompany --registry=http://localhost:7001

# HTTP — 返回 { "alice": "owner", "bob": "member" }
curl http://localhost:7001/-/org/mycompany/member \
  -H "Authorization: Bearer <token>"
```

### 移除成员（npm CLI 兼容）

```bash
# npm CLI
npm org rm mycompany alice --registry=http://localhost:7001

# HTTP
curl -X DELETE http://localhost:7001/-/org/mycompany/member/alice \
  -H "Authorization: Bearer <admin-token>"
```

移除成员会**自动从该 Org 的所有团队中移除**。

### 查看用户所属团队

```bash
curl http://localhost:7001/-/org/mycompany/member/alice/team \
  -H "Authorization: Bearer <token>"
# 返回: [{"name": "developers", "description": "...", "role": "owner"}, ...]
```

## Team 管理

### 创建 Team（npm CLI 兼容）

```bash
# npm CLI
npm team create @mycompany:frontend --registry=http://localhost:7001

# HTTP
curl -X PUT http://localhost:7001/-/org/mycompany/team \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "frontend", "description": "Frontend team"}'
```

创建者会**自动成为 Team `owner`**。

### 查看 Team 列表（npm CLI 兼容）

```bash
# npm CLI
npm team ls @mycompany --registry=http://localhost:7001

# HTTP
curl http://localhost:7001/-/org/mycompany/team \
  -H "Authorization: Bearer <token>"
```

### 删除 Team（npm CLI 兼容）

```bash
# npm CLI
npm team destroy @mycompany:frontend --registry=http://localhost:7001

# HTTP
curl -X DELETE http://localhost:7001/-/org/mycompany/team/frontend \
  -H "Authorization: Bearer <admin-token>"
```

> `developers` 默认团队**不可删除**。

### Team 成员

#### 查看成员 — npm 兼容（GET /-/team/:orgName/:teamName/user）

返回**字符串数组** `["alice", "bob"]`，兼容 `npm team ls`。

```bash
# npm CLI
npm team ls @mycompany:frontend --registry=http://localhost:7001

# HTTP
curl http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <token>"
```

#### 查看成员（含角色）— 私有（GET /-/team/:orgName/:teamName/member）

返回**带角色信息的对象**: `[{"user": "alice", "role": "owner"}, {"user": "bob", "role": "member"}]`。

```bash
curl http://localhost:7001/-/team/mycompany/frontend/member \
  -H "Authorization: Bearer <token>"
```

#### 修改成员角色 — 私有（PATCH /-/team/:orgName/:teamName/member/:username）

```bash
curl -X PATCH http://localhost:7001/-/team/mycompany/frontend/member/alice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "owner"}'
```

#### 添加成员（PUT /-/team/:orgName/:teamName/user）

npm 兼容。添加的成员默认为 `member` 角色，修改角色请使用 PATCH 接口。

```bash
# npm CLI
npm team add @mycompany:frontend alice --registry=http://localhost:7001

# HTTP
curl -X PUT http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice"}'
```

#### 移除成员（DELETE /-/team/:orgName/:teamName/user）

```bash
# npm CLI
npm team rm @mycompany:frontend alice --registry=http://localhost:7001

# HTTP
curl -X DELETE http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice"}'
```

### Team 包授权

> **注意**：授权包访问时，操作者必须是该包的 maintainer（Admin 不受此限制）。这确保了 Team Owner 只能将自己有权限的包添加到团队中。

```bash
# 授权（npm CLI 兼容）
npm access grant read-only @mycompany:frontend @mycompany/ui-lib \
  --registry=http://localhost:7001

# 查看包列表（npm CLI 兼容）
npm access ls-packages @mycompany:frontend --registry=http://localhost:7001

# 撤销授权（npm CLI 兼容）
npm access revoke @mycompany:frontend @mycompany/ui-lib \
  --registry=http://localhost:7001
```

## 权限总结

| 操作 | 所需权限 |
|------|---------|
| 创建 / 删除 Org | Admin |
| 查看 Org 信息 | 登录用户 |
| 添加 / 移除 Org 成员 | Admin 或 Org Owner |
| 查看 Org 成员 | 登录用户 |
| 创建 Team | Admin 或 Org Owner（allowScopes: 任意登录用户） |
| 删除 Team | Admin、Org Owner 或 **Team Owner** |
| 查看 Team / Team 信息 / Team 成员 | 登录用户 |
| 添加 / 移除 Team 成员 | Admin、Org Owner 或 **Team Owner** |
| 授权包访问 | Admin、Org Owner 或 **Team Owner**（且必须是包的 maintainer，Admin 除外） |
| 撤销包访问 | Admin、Org Owner 或 **Team Owner** |
| 查看 Team 包列表 | 登录用户 |

> **Team Owner** 是 cnpmcore 的扩展角色。创建 Team 时，创建者自动成为 Team Owner。Team Owner 可以管理自己的团队，无需 Org 级别的 Owner 权限。

## 私有包读取鉴权

cnpmcore 对 `allowScopes`（self scope）中的包支持基于 Team-Package 绑定的读取鉴权：

- **self scope + 无 team 绑定** = 所有人可读（无需登录）
- **self scope + 有 team 绑定** = 仅 team 成员可读

### 鉴权规则

```
请求 GET /@scope/name（manifest / version / tarball）
  ↓
scope 不在 allowScopes → 公开包，无需鉴权
  ↓
scope 在 allowScopes（self scope）：
  1. 查找包是否有 Team-Package 绑定
  2. 无绑定 → 放行（所有人可读）
  3. 有绑定：
     a. 未登录 → 401
     b. admin 用户 → 放行
     c. 用户在某个 Team 中且该 Team 被授权访问此包 → 放行
     d. 都不满足 → 403
```

> **默认所有 self scope 包都是公开可读的。** 只有通过 Team-Package 绑定后，才会对该包启用读取鉴权。

### 使用流程

以 scope `@mycompany` 为例：

#### 第一步：配置 allowScopes 并创建 Org

```js
// config/config.prod.ts
config.cnpmcore = {
  allowScopes: ['@mycompany'],
};
```

```bash
# 创建 Org（admin）
curl -X PUT http://localhost:7001/-/org \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "mycompany", "description": "My Company"}'
```

#### 第二步：发布包

发布后的包默认**所有人可读**，无需任何额外配置。

```bash
npm publish --registry=http://localhost:7001
```

#### 第三步：（可选）对需要保护的包绑定 Team

只有绑定了 Team 的包才会启用读取鉴权：

```bash
# 授权 developers 团队访问包
npm access grant read-only @mycompany:developers @mycompany/secret-lib \
  --registry=http://localhost:7001
```

绑定后，只有 `developers` 团队的成员才能读取 `@mycompany/secret-lib`。其他未绑定 Team 的 `@mycompany/*` 包仍然所有人可读。

#### 精细控制

创建额外的 Team 可以实现更精细的权限控制：

```bash
# 创建团队（创建者自动成为 team owner）
npm team create @mycompany:frontend --registry=http://localhost:7001

# 将用户加入团队（team owner 即可操作）
curl -X PUT http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <team-owner-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "bob"}'

# 授权团队访问特定包
npm access grant read-only @mycompany:frontend @mycompany/secret-lib \
  --registry=http://localhost:7001
```

### CDN 缓存行为

- self scope 包的响应头设为 `Cache-Control: private, no-store`，不会被 CDN 缓存
- 非 self scope 包保持原有 CDN 缓存策略不变

## API 接口列表

### npm CLI 兼容

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/-/org` | 创建 Org |
| GET | `/-/org/:orgName` | 查看 Org |
| DELETE | `/-/org/:orgName` | 删除 Org |
| GET | `/-/org/:orgName/member` | 查看 Org 成员 |
| PUT | `/-/org/:orgName/member` | 添加 Org 成员 |
| DELETE | `/-/org/:orgName/member/:username` | 移除 Org 成员 |
| PUT | `/-/org/:orgName/team` | 创建 Team |
| GET | `/-/org/:orgName/team` | 查看 Team 列表 |
| GET | `/-/team/:orgName/:teamName` | 查看 Team 信息 |
| DELETE | `/-/team/:orgName/:teamName` | 删除 Team |
| GET | `/-/team/:orgName/:teamName/user` | 查看 Team 成员（字符串数组） |
| PUT | `/-/team/:orgName/:teamName/user` | 添加 Team 成员 |
| DELETE | `/-/team/:orgName/:teamName/user` | 移除 Team 成员 |
| GET | `/-/team/:orgName/:teamName/package` | 查看 Team 包列表 |
| PUT | `/-/team/:orgName/:teamName/package` | 授权包访问 |
| DELETE | `/-/team/:orgName/:teamName/package` | 撤销包访问 |

### 私有接口（cnpmcore 扩展）

| 方法 | 路径 | 说明 | 备注 |
|------|------|------|------|
| GET | `/-/team/:orgName/:teamName/member` | 查看 Team 成员（含角色） | 返回 `[{user, role}]` |
| PATCH | `/-/team/:orgName/:teamName/member/:username` | 修改 Team 成员角色 | Body `{role: "owner"\|"member"}` |
| GET | `/-/org/:orgName/member/:username/team` | 查看用户在 Org 中所属的 Team | 返回 `[{name, description, role}]` |
