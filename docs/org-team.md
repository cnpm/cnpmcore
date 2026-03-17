# Org & Team Management

cnpmcore supports an Organization -> Team -> Package permission model for managing private package access.

## Concepts

| Concept | Description |
|---------|-------------|
| **Org** | Organization, corresponds to a scope (e.g., org `mycompany` -> `@mycompany`) |
| **OrgMember** | Org member with role `owner` (can manage) or `member` |
| **Team** | Permission unit. Each Org auto-creates a `developers` default team |
| **TeamPackage** | Team's read access grant to a package |

## Org Management (Admin only)

### Create Org

```bash
curl -X PUT http://localhost:7001/-/org \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "mycompany", "description": "My Company"}'
```

### Delete Org

```bash
# Cascade deletes all teams, members, and package grants
curl -X DELETE http://localhost:7001/-/org/mycompany \
  -H "Authorization: Bearer <admin-token>"
```

### View Org Info

```bash
curl http://localhost:7001/-/org/mycompany \
  -H "Authorization: Bearer <token>"
```

## Member Management

Admin or Org Owner can manage members.

### Add Member (npm CLI compatible)

```bash
# npm CLI
npm org set mycompany alice --registry=http://localhost:7001

# Set as owner
npm org set mycompany alice owner --registry=http://localhost:7001

# HTTP
curl -X PUT http://localhost:7001/-/org/mycompany/member \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice", "role": "member"}'
```

New members are **auto-added to the `developers` team**.

### List Members (npm CLI compatible)

```bash
# npm CLI
npm org ls mycompany --registry=http://localhost:7001

# HTTP — returns { "alice": "owner", "bob": "member" }
curl http://localhost:7001/-/org/mycompany/member \
  -H "Authorization: Bearer <token>"
```

### Remove Member (npm CLI compatible)

```bash
# npm CLI
npm org rm mycompany alice --registry=http://localhost:7001

# HTTP
curl -X DELETE http://localhost:7001/-/org/mycompany/member/alice \
  -H "Authorization: Bearer <admin-token>"
```

Removing a member **auto-removes from all teams** in the org.

### List User's Teams

```bash
curl http://localhost:7001/-/org/mycompany/member/alice/team \
  -H "Authorization: Bearer <token>"
# Returns: [{"name": "developers", "description": "..."}, ...]
```

## Team Management

### Create Team (npm CLI compatible)

```bash
# npm CLI
npm team create @mycompany:frontend --registry=http://localhost:7001

# HTTP
curl -X PUT http://localhost:7001/-/org/mycompany/team \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "frontend", "description": "Frontend team"}'
```

### List Teams (npm CLI compatible)

```bash
# npm CLI
npm team ls @mycompany --registry=http://localhost:7001

# HTTP
curl http://localhost:7001/-/org/mycompany/team \
  -H "Authorization: Bearer <token>"
```

### Delete Team (npm CLI compatible)

```bash
# npm CLI
npm team destroy @mycompany:frontend --registry=http://localhost:7001

# HTTP
curl -X DELETE http://localhost:7001/-/org/mycompany/team/frontend \
  -H "Authorization: Bearer <admin-token>"
```

> The `developers` default team **cannot be deleted**.

### Team Members

```bash
# List members (npm CLI compatible)
npm team ls @mycompany:frontend --registry=http://localhost:7001

# Add member (must be an org member first)
curl -X PUT http://localhost:7001/-/org/mycompany/team/frontend/member \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice"}'

# Remove member
curl -X DELETE http://localhost:7001/-/org/mycompany/team/frontend/member/alice \
  -H "Authorization: Bearer <admin-token>"
```

### Team Package Access

```bash
# Grant access (npm CLI compatible)
npm access grant read-only @mycompany:frontend @mycompany/ui-lib \
  --registry=http://localhost:7001

# List packages (npm CLI compatible)
npm access ls-packages @mycompany:frontend --registry=http://localhost:7001

# Revoke access (npm CLI compatible)
npm access revoke @mycompany:frontend @mycompany/ui-lib \
  --registry=http://localhost:7001
```

## Permission Summary

| Operation | Required Permission |
|-----------|-------------------|
| Create / Delete Org | Admin |
| View Org info | Logged-in user |
| Add / Remove Org member | Admin or Org Owner |
| View Org members | Logged-in user |
| Create / Delete Team | Admin or Org Owner |
| View Teams / Team info / Team members | Logged-in user |
| Add / Remove Team member | Admin or Org Owner |
| Grant / Revoke package access | Admin or Org Owner |
| View Team packages | Logged-in user |

## 私有包读取鉴权

cnpmcore 支持对 `allowScopes` 中的 scope 包进行读取鉴权。开启后，`npm install` 私有 scope 包时需要登录，并且用户所在的 Team 必须被授权访问该包。

### 鉴权规则

```
请求 GET /@scope/name（manifest / version / tarball）
  ↓
scope 不在 allowScopes → 公开包，无需鉴权
  ↓
scope 在 allowScopes（私有包）：
  1. 未登录 → 401
  2. admin 用户 → 放行
  3. scope 去掉 @ 查找 Org（@mycompany → org mycompany）
  4. Org 不存在 → 放行（向后兼容，未建 Org 的私有 scope 不拦截）
  5. 用户在某个 Team 中且该 Team 被授权访问此包 → 放行
  6. 都不满足 → 403（即使是 Org 成员，没有 Team-Package 授权也无法读取）
```

> **注意**：仅加入 Org 不会自动获得所有包的读取权限。必须通过 Team-Package 授权将包分配给 Team，Team 中的成员才能读取。

### 开启私有包读取鉴权全流程

以下以内部 scope `@mycompany` 为例，从零开始演示完整流程。

#### 第一步：配置 allowScopes

在部署配置中将私有 scope 添加到 `allowScopes`：

```js
// config/config.prod.ts 或环境变量
config.cnpmcore = {
  allowScopes: ['@mycompany'],
  // ...
};
```

`allowScopes` 中的 scope 既是允许发布的 scope，也是读取鉴权生效的 scope。

#### 第二步：创建 Org

使用 admin 账号创建与 scope 对应的 Org（scope `@mycompany` 对应 org 名 `mycompany`）：

```bash
curl -X PUT http://localhost:7001/-/org \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "mycompany", "description": "My Company"}'
```

创建 Org 时会自动生成 `developers` 默认团队。

#### 第三步：添加成员

将需要读取私有包的用户添加到 Org：

```bash
# 通过 npm CLI
npm org set mycompany alice --registry=http://localhost:7001

# 或 HTTP API
curl -X PUT http://localhost:7001/-/org/mycompany/member \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice", "role": "member"}'
```

成员添加后会自动加入 `developers` 团队。

#### 第四步：发布私有包

Org 成员使用自己的 token 发布包：

```bash
npm publish --registry=http://localhost:7001
# 包名须为 @mycompany/xxx
```

#### 第五步：授权 Team 访问包

发布完成后，需要将包授权给 Team，Team 中的成员才能读取。

最简单的方式是把包授权给 `developers` 团队（所有 Org 成员都在这个团队中）：

```bash
# 授权 developers 团队访问包（npm CLI）
npm access grant read-only @mycompany:developers @mycompany/ui-lib \
  --registry=http://localhost:7001

# 或 HTTP API
curl -X PUT http://localhost:7001/-/org/mycompany/team/developers/package \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"package": "@mycompany/ui-lib"}'
```

> **这一步是必须的。** 仅加入 Org 不会自动获得包的读取权限，必须通过 Team-Package 授权。

如果需要更精细的控制（某些包只对特定团队开放），可以创建额外的 Team：

```bash
# 创建团队
npm team create @mycompany:frontend --registry=http://localhost:7001

# 将用户加入团队
curl -X PUT http://localhost:7001/-/org/mycompany/team/frontend/member \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "bob"}'

# 授权团队访问特定包
npm access grant read-only @mycompany:frontend @mycompany/secret-lib \
  --registry=http://localhost:7001
```

#### 第六步：安装私有包

客户端需要配置 token 才能安装私有 scope 下的包：

```bash
# 登录获取 token
npm login --registry=http://localhost:7001

# 安装
npm install @mycompany/ui-lib --registry=http://localhost:7001
```

未登录 → 401；登录但没有 Team-Package 授权 → 403。

#### （可选）第七步：配置 defaultOrg 自动分配

如果希望新注册用户自动加入某个 Org，可配置 `defaultOrg`：

```js
config.cnpmcore = {
  defaultOrg: 'mycompany',
  // ...
};
```

配置后，用户首次注册（`npm login` / `npm adduser`）时会自动成为该 Org 的 `member` 并加入 `developers` 团队，无需 admin 手动添加。

> 仅影响新注册用户。`defaultOrg` 对应的 Org 必须提前创建好，否则只会打印 warning 日志。
> 自动加入 Org 后，用户仍需 `developers` 团队被授权了对应的包才能读取。

### CDN 缓存行为

- 私有 scope 包的响应头设为 `Cache-Control: private, no-store`，不会被 CDN 缓存
- 非私有 scope 包保持原有 CDN 缓存策略不变
- 服务端 Redis 缓存不受影响（鉴权在返回数据前完成）

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/-/org` | Create org |
| GET | `/-/org/:orgName` | View org |
| DELETE | `/-/org/:orgName` | Delete org |
| GET | `/-/org/:orgName/member` | List org members |
| PUT | `/-/org/:orgName/member` | Add org member |
| DELETE | `/-/org/:orgName/member/:username` | Remove org member |
| GET | `/-/org/:orgName/member/:username/team` | List user's teams in org |
| PUT | `/-/org/:orgName/team` | Create team |
| GET | `/-/org/:orgName/team` | List teams |
| GET | `/-/org/:orgName/team/:teamName` | View team |
| DELETE | `/-/org/:orgName/team/:teamName` | Delete team |
| GET | `/-/org/:orgName/team/:teamName/member` | List team members |
| PUT | `/-/org/:orgName/team/:teamName/member` | Add team member |
| DELETE | `/-/org/:orgName/team/:teamName/member/:username` | Remove team member |
| GET | `/-/org/:orgName/team/:teamName/package` | List team packages |
| PUT | `/-/org/:orgName/team/:teamName/package` | Grant package access |
| DELETE | `/-/org/:orgName/team/:teamName/package/@:scope/:name` | Revoke package access |
