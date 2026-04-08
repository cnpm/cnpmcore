# Org & Team Management

cnpmcore supports an Organization -> Team -> Package permission model for managing private package access.

## Concepts

| Concept         | Description                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| **Org**         | Organization, corresponds to a scope (e.g., org `mycompany` -> `@mycompany`) |
| **OrgMember**   | Org member with role `owner` (can manage) or `member`                        |
| **Team**        | Permission unit. Each Org auto-creates a `developers` default team           |
| **TeamMember**  | Team member with role `owner` (can manage team) or `member`                  |
| **TeamPackage** | Team's read access grant to a package                                        |

## Protocol Compatibility

cnpmcore implements both **npm CLI compatible** endpoints and **private (extended)** endpoints.

| Label              | Meaning                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **npm compatible** | Follows the npm registry API contract. Request/response format is compatible with `npm` CLI.                  |
| **Private**        | cnpmcore extension. Not part of the npm registry API. Uses custom routes or adds extra fields (e.g., `role`). |

> **Rule**: npm compatible endpoints never change their response format. Extended fields (like `role`) are only available via private endpoints.

## Team Role Extension

### The Problem with npm's Original Model

In npm's original model, `@scope` maps to an Org, and Teams under an Org have no role information. Team membership is flat — a user is either "in" or "not in" the team, and everyone who can operate on a Team has equal permissions.

This causes problems in enterprise scenarios: companies typically have a single Org (mapping to one `@scope`), and all employees are Org members. Since npm's Teams have no role differentiation, **any Org member can freely modify any Team** — adding/removing members, granting/revoking package access — which is unacceptable in practice.

### cnpmcore's Extension

cnpmcore adds a `role` field to Team members while maintaining full npm CLI compatibility:

- **owner** — Can manage the Team (add/remove members, manage package access, delete Team)
- **member** — Regular member, only has read access to packages authorized for the Team

#### Core Behavior

1. When a **Team is created**, the creator is automatically added as Team Owner
2. **Team write operations** (add/remove members, manage packages, delete Team) require the operator to be a Team Owner, Org Owner, or Admin
3. Regular Org members **cannot directly manage other people's Teams**

#### npm CLI Compatibility

Users can still create and manage their own Teams via npm CLI:

```bash
# Create Team (creator automatically becomes owner)
npm team create @mycompany:frontend --registry=http://localhost:7001

# Add member (only team owner can operate; members added via npm CLI default to member role)
npm team add @mycompany:frontend alice --registry=http://localhost:7001

# List members (returns plain username list, npm CLI compatible)
npm team ls @mycompany:frontend --registry=http://localhost:7001
```

#### Private API Supplement

Since npm CLI doesn't support Team role concepts, the following operations require private APIs:

- **View member roles** — `GET /-/team/:org/:team/member`
- **Update member role** — `PATCH /-/team/:org/:team/member/:username`

```bash
# List members (with role info)
curl http://localhost:7001/-/team/mycompany/frontend/member \
  -H "Authorization: Bearer <token>"
# Returns: [{"user": "alice", "role": "owner"}, {"user": "bob", "role": "member"}]

# Promote member to team owner
curl -X PATCH http://localhost:7001/-/team/mycompany/frontend/member/alice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "owner"}'

# Demote to regular member
curl -X PATCH http://localhost:7001/-/team/mycompany/frontend/member/alice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'
```

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

#### Update Member Role — Private (PATCH /-/team/:orgName/:teamName/member/:username)

```bash
curl -X PATCH http://localhost:7001/-/team/mycompany/frontend/member/alice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "owner"}'
```

#### Add Member (PUT /-/team/:orgName/:teamName/user)

npm compatible. Members are always added with `member` role. Use the PATCH endpoint to change roles.

```bash
# npm CLI
npm team add @mycompany:frontend alice --registry=http://localhost:7001

# HTTP
curl -X PUT http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "alice"}'
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

## Permission Summary

| Operation                             | Required Permission                                  |
| ------------------------------------- | ---------------------------------------------------- |
| Create / Delete Org                   | Admin                                                |
| View Org info                         | Logged-in user                                       |
| Add / Remove Org member               | Admin or Org Owner                                   |
| View Org members                      | Logged-in user                                       |
| Create Team                           | Admin or Org Owner (allowScopes: any logged-in user) |
| Delete Team                           | Admin, Org Owner, or **Team Owner**                  |
| View Teams / Team info / Team members | Logged-in user                                       |
| Add / Remove Team member              | Admin, Org Owner, or **Team Owner**                  |
| Grant / Revoke package access         | Admin, Org Owner, or **Team Owner**                  |
| View Team packages                    | Logged-in user                                       |

> **Team Owner** is a cnpmcore extension role. When a team is created, the creator is automatically added as the team owner. Team owners can manage their own team without needing org-level owner permissions.

## Private Package Read Authentication

cnpmcore supports Team-Package binding based read authentication for packages in `allowScopes` (self scope):

- **self scope + no team binding** = publicly readable (no login required)
- **self scope + has team binding** = only team members can read

### Authentication Flow

```
Request GET /@scope/name (manifest / version / tarball)
  ↓
scope not in allowScopes → public package, no auth needed
  ↓
scope in allowScopes (self scope):
  1. Check if package has Team-Package binding
  2. No binding → allow (publicly readable)
  3. Has binding:
     a. Not logged in → 401
     b. Admin user → allow
     c. User is in a Team that has access to this package → allow
     d. None of the above → 403
```

> **By default, all self scope packages are publicly readable.** Read authentication is only enabled after a Team-Package binding is created.

### Usage Guide

Using scope `@mycompany` as an example:

#### Step 1: Configure allowScopes and Create Org

```js
// config/config.prod.ts
config.cnpmcore = {
  allowScopes: ['@mycompany'],
};
```

```bash
# Create Org (admin)
curl -X PUT http://localhost:7001/-/org \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "mycompany", "description": "My Company"}'
```

#### Step 2: Publish Packages

Published packages are **publicly readable** by default, no additional configuration needed.

```bash
npm publish --registry=http://localhost:7001
```

#### Step 3: (Optional) Bind Team to Protected Packages

Only packages with Team bindings will have read authentication enabled:

```bash
# Grant developers team access to a package
npm access grant read-only @mycompany:developers @mycompany/secret-lib \
  --registry=http://localhost:7001
```

After binding, only `developers` team members can read `@mycompany/secret-lib`. Other `@mycompany/*` packages without Team bindings remain publicly readable.

#### Fine-grained Control

Create additional Teams for more granular permission control:

```bash
# Create team (creator automatically becomes team owner)
npm team create @mycompany:frontend --registry=http://localhost:7001

# Add user to team (team owner can operate)
curl -X PUT http://localhost:7001/-/team/mycompany/frontend/user \
  -H "Authorization: Bearer <team-owner-token>" \
  -H "Content-Type: application/json" \
  -d '{"user": "bob"}'

# Grant team access to specific package
npm access grant read-only @mycompany:frontend @mycompany/secret-lib \
  --registry=http://localhost:7001
```

### CDN Cache Behavior

- Self scope packages have `Cache-Control: private, no-store` header, will not be cached by CDN
- Non-self scope packages retain the original CDN caching strategy

## API Endpoints

### npm CLI Compatible

| Method | Path                                 | Description                      |
| ------ | ------------------------------------ | -------------------------------- |
| PUT    | `/-/org`                             | Create org                       |
| GET    | `/-/org/:orgName`                    | View org                         |
| DELETE | `/-/org/:orgName`                    | Delete org                       |
| GET    | `/-/org/:orgName/member`             | List org members                 |
| PUT    | `/-/org/:orgName/member`             | Add org member                   |
| DELETE | `/-/org/:orgName/member/:username`   | Remove org member                |
| PUT    | `/-/org/:orgName/team`               | Create team                      |
| GET    | `/-/org/:orgName/team`               | List teams                       |
| GET    | `/-/team/:orgName/:teamName`         | View team                        |
| DELETE | `/-/team/:orgName/:teamName`         | Delete team                      |
| GET    | `/-/team/:orgName/:teamName/user`    | List team members (string array) |
| PUT    | `/-/team/:orgName/:teamName/user`    | Add team member                  |
| DELETE | `/-/team/:orgName/:teamName/user`    | Remove team member               |
| GET    | `/-/team/:orgName/:teamName/package` | List team packages               |
| PUT    | `/-/team/:orgName/:teamName/package` | Grant package access             |
| DELETE | `/-/team/:orgName/:teamName/package` | Revoke package access            |

### Private (cnpmcore extensions)

| Method | Path                                          | Description                 | Notes                                 |
| ------ | --------------------------------------------- | --------------------------- | ------------------------------------- |
| GET    | `/-/team/:orgName/:teamName/member`           | List team members with role | Returns `[{user, role}]`              |
| PATCH  | `/-/team/:orgName/:teamName/member/:username` | Update team member role     | Body `{role: "owner"\|"member"}`      |
| GET    | `/-/org/:orgName/member/:username/team`       | List user's teams in org    | Returns `[{name, description, role}]` |
