# Org & Team Management

cnpmcore supports an Organization -> Team -> Package permission model for managing private package access.

## Concepts

| Concept | Description |
|---------|-------------|
| **Org** | Organization, corresponds to a scope (e.g., org `mycompany` -> `@mycompany`) |
| **OrgMember** | Org member with role `owner` (can manage) or `member` |
| **Team** | Permission unit. Each Org auto-creates a `developers` default team |
| **TeamMember** | Team member with role `owner` (can manage team) or `member` |
| **TeamPackage** | Team's read access grant to a package |

## Protocol Compatibility

cnpmcore implements both **npm CLI compatible** endpoints and **private (extended)** endpoints.

| Label | Meaning |
|-------|---------|
| **npm compatible** | Follows the npm registry API contract. Request/response format is compatible with `npm` CLI. |
| **Private** | cnpmcore extension. Not part of the npm registry API. Uses custom routes or adds extra fields (e.g., `role`). |

> **Rule**: npm compatible endpoints never change their response format. Extended fields (like `role`) are only available via private endpoints.

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
# Returns: [{"name": "developers", "description": "...", "role": "owner"}, ...]
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

The creator is **auto-added as team `owner`**.

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

#### List Members — npm compatible (GET /-/team/:orgName/:teamName/user)

Returns a **string array** `["alice", "bob"]`, compatible with `npm team ls`.

```bash
# npm CLI
npm team ls @mycompany:frontend --registry=http://localhost:7001

# HTTP
curl http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <token>"
```

#### List Members with Role — Private (GET /-/team/:orgName/:teamName/member)

Returns **objects with role info**: `[{"user": "alice", "role": "owner"}, {"user": "bob", "role": "member"}]`.

```bash
curl http://localhost:7001/-/team/mycompany/frontend/member \
  -H "Authorization: Bearer <token>"
```

#### Add Member (PUT /-/team/:orgName/:teamName/user)

npm compatible. The `role` field is a **private extension** — npm CLI does not send it, defaults to `member`.

```bash
# npm CLI (adds as member)
npm team add @mycompany:frontend alice --registry=http://localhost:7001

# HTTP with role (private extension)
curl -X PUT http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice", "role": "owner"}'
```

#### Remove Member (DELETE /-/team/:orgName/:teamName/user)

```bash
# npm CLI
npm team rm @mycompany:frontend alice --registry=http://localhost:7001

# HTTP
curl -X DELETE http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice"}'
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

### List User's Teams — Private (GET /-/user/:username/team?org=orgName)

Returns teams with role info. Only self or admin can access.

```bash
curl http://localhost:7001/-/user/alice/team?org=mycompany \
  -H "Authorization: Bearer <token>"
# Returns: [{"name": "mycompany:frontend", "description": "...", "role": "owner"}, ...]
```

## Permission Summary

| Operation | Required Permission |
|-----------|-------------------|
| Create / Delete Org | Admin |
| View Org info | Logged-in user |
| Add / Remove Org member | Admin or Org Owner |
| View Org members | Logged-in user |
| Create Team | Admin or Org Owner (allowScopes: any logged-in user) |
| Delete Team | Admin, Org Owner, or **Team Owner** |
| View Teams / Team info / Team members | Logged-in user |
| Add / Remove Team member | Admin, Org Owner, or **Team Owner** |
| Grant / Revoke package access | Admin, Org Owner, or **Team Owner** |
| View Team packages | Logged-in user |

> **Team Owner** is a new role. When a team is created, the creator is automatically added as the team owner. Team owners can manage their own team without needing org-level owner permissions.

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

## API Endpoints

### npm CLI Compatible

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/-/org` | Create org |
| GET | `/-/org/:orgName` | View org |
| DELETE | `/-/org/:orgName` | Delete org |
| GET | `/-/org/:orgName/member` | List org members |
| PUT | `/-/org/:orgName/member` | Add org member |
| DELETE | `/-/org/:orgName/member/:username` | Remove org member |
| PUT | `/-/org/:orgName/team` | Create team |
| GET | `/-/org/:orgName/team` | List teams |
| GET | `/-/team/:orgName/:teamName` | View team |
| DELETE | `/-/team/:orgName/:teamName` | Delete team |
| GET | `/-/team/:orgName/:teamName/user` | List team members (string array) |
| PUT | `/-/team/:orgName/:teamName/user` | Add team member |
| DELETE | `/-/team/:orgName/:teamName/user` | Remove team member |
| GET | `/-/team/:orgName/:teamName/package` | List team packages |
| PUT | `/-/team/:orgName/:teamName/package` | Grant package access |
| DELETE | `/-/team/:orgName/:teamName/package` | Revoke package access |

### Private (cnpmcore extensions)

| Method | Path | Description | Notes |
|--------|------|-------------|-------|
| GET | `/-/team/:orgName/:teamName/member` | List team members with role | Returns `[{user, role}]` |
| GET | `/-/user/:username/team?org=orgName` | List user's teams with role | Returns `[{name, description, role}]` |
| GET | `/-/org/:orgName/member/:username/team` | List user's teams in org | Returns `[{name, description, role}]` |
| PUT | `/-/team/:orgName/:teamName/user` body `{user, role}` | Add member with role | `role` field is a private extension (npm CLI ignores it) |
