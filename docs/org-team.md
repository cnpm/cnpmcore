# Org & Team 管理

cnpmcore 支持 Organization → Team → Package 三层权限模型，用于控制私有包的读取权限。

## 概念

| 概念 | 说明 |
|------|------|
| **Org** | 组织，对应一个 scope（如 org `mycompany` 对应 `@mycompany`） |
| **OrgMember** | 组织成员，role 为 `owner`（可管理）或 `member` |
| **Team** | 团队，权限分配的核心单元。每个 Org 自动创建 `developers` 默认团队 |
| **TeamPackage** | 团队对包的读取授权记录 |

## 管理员操作（HTTP API）

以下操作需要 Admin 权限，通过 HTTP 请求调用。

### 创建 Org

```bash
# 创建组织，自动创建 developers 默认团队，Admin 自动成为 owner
curl -X PUT http://localhost:7001/-/org \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "mycompany", "description": "My Company"}'
```

### 删除 Org

```bash
# 级联删除所有 team、成员关系、包授权
curl -X DELETE http://localhost:7001/-/org/mycompany \
  -H "Authorization: Bearer <admin-token>"
```

### 查看 Org 信息

```bash
curl http://localhost:7001/-/org/mycompany \
  -H "Authorization: Bearer <token>"
```

## 成员管理

Admin 或 Org Owner 可管理成员。

### 添加成员（npm CLI 兼容）

```bash
# npm CLI 方式
npm org set mycompany alice --registry=http://localhost:7001

# 设置为 owner
npm org set mycompany alice owner --registry=http://localhost:7001

# 等效 HTTP 请求
curl -X PUT http://localhost:7001/-/org/mycompany/member \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice", "role": "member"}'
```

新成员会**自动加入 `developers` 默认团队**。

### 查看成员列表（npm CLI 兼容）

```bash
# npm CLI 方式
npm org ls mycompany --registry=http://localhost:7001

# HTTP 请求
curl http://localhost:7001/-/org/mycompany/member \
  -H "Authorization: Bearer <token>"

# 返回格式: { "alice": "owner", "bob": "member" }
```

### 移除成员（npm CLI 兼容）

```bash
# npm CLI 方式
npm org rm mycompany alice --registry=http://localhost:7001

# HTTP 请求
curl -X DELETE http://localhost:7001/-/org/mycompany/member/alice \
  -H "Authorization: Bearer <admin-token>"
```

移除成员时会**自动从该 Org 下所有 Team 中移除**。

### 查看用户所属 Team

```bash
curl http://localhost:7001/-/org/mycompany/member/alice/team \
  -H "Authorization: Bearer <token>"

# 返回格式: [{"name": "developers", "description": "..."}, ...]
```

## Team 管理

### 创建 Team（npm CLI 兼容）

```bash
# npm CLI 方式
npm team create @mycompany:frontend --registry=http://localhost:7001

# HTTP 请求
curl -X PUT http://localhost:7001/-/org/mycompany/team \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "frontend", "description": "Frontend team"}'
```

### 查看 Org 下所有 Team（npm CLI 兼容）

```bash
# npm CLI 方式
npm team ls @mycompany --registry=http://localhost:7001

# HTTP 请求
curl http://localhost:7001/-/org/mycompany/team \
  -H "Authorization: Bearer <token>"
```

### 删除 Team（npm CLI 兼容）

```bash
# npm CLI 方式
npm team destroy @mycompany:frontend --registry=http://localhost:7001

# HTTP 请求
curl -X DELETE http://localhost:7001/-/org/mycompany/team/frontend \
  -H "Authorization: Bearer <admin-token>"
```

> `developers` 默认团队**不可删除**。

### 查看 Team 详情

```bash
curl http://localhost:7001/-/org/mycompany/team/frontend \
  -H "Authorization: Bearer <token>"
```

## Team 成员管理

### 添加 Team 成员

```bash
curl -X PUT http://localhost:7001/-/org/mycompany/team/frontend/member \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice"}'
```

> 用户必须先是 Org 成员，才能加入 Team。

### 查看 Team 成员列表（npm CLI 兼容）

```bash
# npm CLI 方式
npm team ls @mycompany:frontend --registry=http://localhost:7001

# HTTP 请求
curl http://localhost:7001/-/org/mycompany/team/frontend/member \
  -H "Authorization: Bearer <token>"

# 返回格式: ["alice", "bob"]
```

### 移除 Team 成员

```bash
curl -X DELETE http://localhost:7001/-/org/mycompany/team/frontend/member/alice \
  -H "Authorization: Bearer <admin-token>"
```

## Team 包授权

### 授权 Team 访问包（npm CLI 兼容）

```bash
# npm CLI 方式
npm access grant read-only @mycompany:frontend @mycompany/ui-lib \
  --registry=http://localhost:7001

# HTTP 请求
curl -X PUT http://localhost:7001/-/org/mycompany/team/frontend/package \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"package": "@mycompany/ui-lib"}'
```

### 查看 Team 可访问的包（npm CLI 兼容）

```bash
# npm CLI 方式
npm access ls-packages @mycompany:frontend --registry=http://localhost:7001

# HTTP 请求
curl http://localhost:7001/-/org/mycompany/team/frontend/package \
  -H "Authorization: Bearer <token>"

# 返回格式: { "@mycompany/ui-lib": "read" }
```

### 撤销 Team 的包访问（npm CLI 兼容）

```bash
# npm CLI 方式
npm access revoke @mycompany:frontend @mycompany/ui-lib \
  --registry=http://localhost:7001

# HTTP 请求
curl -X DELETE \
  http://localhost:7001/-/org/mycompany/team/frontend/package/@mycompany/ui-lib \
  -H "Authorization: Bearer <admin-token>"
```

## API 权限总结

| 操作 | 权限要求 |
|------|---------|
| 创建 / 删除 Org | Admin |
| 查看 Org 信息 | 登录用户 |
| 添加 / 移除 Org 成员 | Admin 或 Org Owner |
| 查看 Org 成员列表 | 登录用户 |
| 查看用户所属 Team | 登录用户 |
| 创建 / 删除 Team | Admin 或 Org Owner |
| 查看 Team 列表 / 详情 / 成员 | 登录用户 |
| 添加 / 移除 Team 成员 | Admin 或 Org Owner |
| 授权 / 撤销包访问 | Admin 或 Org Owner |
| 查看 Team 包列表 | 登录用户 |

## 快速上手

### 场景 1：简单模式（只用 developers 团队）

```bash
# 1. Admin 创建 org
curl -X PUT http://localhost:7001/-/org \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"name": "mycompany"}'

# 2. 添加成员（自动加入 developers）
npm org set mycompany alice --registry=http://localhost:7001
npm org set mycompany bob --registry=http://localhost:7001

# 3. 发布 restricted 包（自动授权给 developers team）
npm publish --access restricted --registry=http://localhost:7001

# 4. alice 和 bob 可以安装，其他人收到 403
npm install @mycompany/sdk --registry=http://localhost:7001
```

### 场景 2：细粒度控制（多个 Team）

```bash
# 1. 创建额外 team
npm team create @mycompany:core --registry=http://localhost:7001

# 2. 添加成员到 team
curl -X PUT http://localhost:7001/-/org/mycompany/team/core/member \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"user": "alice"}'

# 3. 将包只授权给 core team
npm access restricted @mycompany/internal-sdk --registry=http://localhost:7001
npm access revoke @mycompany:developers @mycompany/internal-sdk --registry=http://localhost:7001
npm access grant read-only @mycompany:core @mycompany/internal-sdk --registry=http://localhost:7001

# 结果：只有 core team (alice) 可读 @mycompany/internal-sdk
```
