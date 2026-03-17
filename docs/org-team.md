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
