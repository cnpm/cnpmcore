# CNPMCore Internal API Documentation

This document provides comprehensive documentation for cnpmcore's internal APIs that allow direct HTTP requests without using the cnpm client. These APIs enable package synchronization, administration, and other advanced operations.

## Table of Contents

- [Authentication](#authentication)
- [Package Sync API](#package-sync-api)
- [Binary Sync API](#binary-sync-api)
- [Token Management API](#token-management-api)
- [Package Block/Admin API](#package-blockadmin-api)
- [Registry Management API](#registry-management-api)
- [Hook Management API](#hook-management-api)
- [User Management API](#user-management-api)
- [Common Schemas](#common-schemas)

## Authentication

Most internal APIs require authentication using one of these methods:

### Bearer Token Authentication
```bash
curl -H "Authorization: Bearer ${TOKEN}" https://your-registry.com/api/endpoint
```

### Admin Access
Some APIs require admin privileges. Admin users are configured in the registry settings.

## Package Sync API

The package sync functionality allows you to synchronize packages from external registries (like npmjs.org) to your private registry.

### Create Sync Task (Modern API)

Trigger a package synchronization task.

```
PUT /-/package/:fullname/syncs
```

#### Authentication
Required. Must be authenticated user.

#### Parameters

- `fullname` (string): Package name (can include scope, e.g., `@scope/package`)

#### Request Body

```json
{
  "skipDependencies": false,
  "syncDownloadData": false,
  "force": false,
  "forceSyncHistory": false,
  "tips": "Custom sync reason",
  "registryName": "optional-source-registry",
  "specificVersions": "[\"1.0.0\", \"1.0.1\"]"
}
```

#### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skipDependencies` | boolean | No | Skip syncing package dependencies |
| `syncDownloadData` | boolean | No | Sync download statistics data |
| `force` | boolean | No | Force immediate execution (admin only) |
| `forceSyncHistory` | boolean | No | Sync all historical versions (admin only) |
| `tips` | string | No | Custom reason/description for sync |
| `registryName` | string | No | Source registry name |
| `specificVersions` | string | No | JSON array of specific versions to sync |

#### Example Request

```bash
curl -X PUT \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "skipDependencies": false,
    "syncDownloadData": false,
    "force": false,
    "tips": "Manual sync from API"
  }' \
  https://your-registry.com/-/package/lodash/syncs
```

#### Response

```json
{
  "ok": true,
  "id": "sync-task-uuid",
  "type": "package",
  "state": "waiting"
}
```

### Create Sync Task (Legacy API)

Legacy endpoint for compatibility with cnpmjs.org.

```
PUT /:fullname/sync
```

#### Parameters

- `fullname` (string): Package name
- `nodeps` (query): Set to "true" to skip dependencies

#### Example Request

```bash
curl -X PUT \
  -H "Authorization: Bearer your-token-here" \
  "https://your-registry.com/lodash/sync?nodeps=false"
```

#### Response

```json
{
  "ok": true,
  "logId": "sync-task-uuid"
}
```

### Get Sync Task Status

Check the status of a sync task.

```
GET /-/package/:fullname/syncs/:taskId
```

#### Parameters

- `fullname` (string): Package name
- `taskId` (string): Task ID returned from sync creation

#### Example Request

```bash
curl -H "Authorization: Bearer your-token-here" \
  https://your-registry.com/-/package/lodash/syncs/sync-task-uuid
```

#### Response

```json
{
  "ok": true,
  "id": "sync-task-uuid",
  "type": "package",
  "state": "success",
  "logUrl": "https://your-registry.com/-/package/lodash/syncs/sync-task-uuid/log"
}
```

#### Task States

- `waiting`: Task is queued
- `processing`: Task is currently running
- `success`: Task completed successfully
- `error`: Task failed

### Get Sync Task Log

Retrieve the log for a sync task.

```
GET /-/package/:fullname/syncs/:taskId/log
```

#### Parameters

- `fullname` (string): Package name
- `taskId` (string): Task ID

#### Example Request

```bash
curl -H "Authorization: Bearer your-token-here" \
  https://your-registry.com/-/package/lodash/syncs/sync-task-uuid/log
```

#### Response

Returns the log content as plain text or redirects to log URL.

### Legacy Sync Status API

Legacy endpoint for checking sync status.

```
GET /:fullname/sync/log/:taskId
```

#### Example Request

```bash
curl -H "Authorization: Bearer your-token-here" \
  https://your-registry.com/lodash/sync/log/sync-task-uuid
```

#### Response

```json
{
  "ok": true,
  "syncDone": true,
  "log": "[2024-01-01T12:00:00Z] [done] Sync lodash data: {...}",
  "logUrl": "https://your-registry.com/-/package/lodash/syncs/sync-task-uuid/log"
}
```

## Binary Sync API

Manage and sync binary packages (like Node.js, Python, etc.).

### List All Binaries

Get a list of all available binary packages.

```
GET /-/binary/
```

#### Example Request

```bash
curl https://your-registry.com/-/binary/
```

#### Response

```json
[
  {
    "name": "node/",
    "category": "node/",
    "description": "Node.js runtime",
    "distUrl": "https://nodejs.org/dist/",
    "repoUrl": "https://github.com/nodejs/node",
    "type": "dir",
    "url": "https://your-registry.com/-/binary/node/"
  }
]
```

### Browse Binary Directory

Browse files in a binary package directory.

```
GET /-/binary/:binaryName/:subpath
```

#### Parameters

- `binaryName` (string): Binary package name (e.g., "node", "python")
- `subpath` (string): Path within the binary directory
- `since` (query): Filter files modified since date
- `limit` (query): Limit number of results (max 1000)

#### Example Request

```bash
curl https://your-registry.com/-/binary/node/v18.0.0/
```

## Token Management API

Manage authentication tokens for users.

### Create Token

Create a new authentication token.

```
POST /-/npm/v1/tokens
```

#### Authentication
Required. Must provide current password.

#### Request Body

```json
{
  "password": "current-password",
  "readonly": false,
  "automation": false,
  "cidr_whitelist": ["127.0.0.1", "192.168.1.0/24"]
}
```

#### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `password` | string | Yes | Current user password (8-100 chars) |
| `readonly` | boolean | No | Create read-only token |
| `automation` | boolean | No | Mark token for automation use |
| `cidr_whitelist` | array | No | IP address restrictions (max 10) |

#### Example Request

```bash
curl -X POST \
  -H "Authorization: Bearer existing-token" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "my-password",
    "readonly": false,
    "cidr_whitelist": ["127.0.0.1"]
  }' \
  https://your-registry.com/-/npm/v1/tokens
```

#### Response

```json
{
  "token": "npm_xxxxxxxxxxxxxxxxxxxx",
  "key": "full-token-key-hash",
  "cidr_whitelist": ["127.0.0.1"],
  "readonly": false,
  "automation": false,
  "created": "2024-01-01T12:00:00.000Z",
  "updated": "2024-01-01T12:00:00.000Z"
}
```

### List Tokens

Get all tokens for the authenticated user.

```
GET /-/npm/v1/tokens
```

#### Authentication
Required.

#### Example Request

```bash
curl -H "Authorization: Bearer your-token" \
  https://your-registry.com/-/npm/v1/tokens
```

#### Response

```json
{
  "objects": [
    {
      "token": "npm_xx...xx",
      "key": "token-key-hash",
      "cidr_whitelist": null,
      "readonly": false,
      "automation": false,
      "created": "2024-01-01T12:00:00.000Z",
      "updated": "2024-01-01T12:00:00.000Z",
      "lastUsedAt": "2024-01-01T12:30:00.000Z"
    }
  ],
  "total": 1,
  "urls": {}
}
```

### Delete Token

Remove an authentication token.

```
DELETE /-/npm/v1/tokens/token/:tokenKey
```

#### Authentication
Required.

#### Parameters

- `tokenKey` (string): The token key to delete

#### Example Request

```bash
curl -X DELETE \
  -H "Authorization: Bearer your-token" \
  https://your-registry.com/-/npm/v1/tokens/token/token-key-hash
```

#### Response

```json
{
  "ok": true
}
```

## Package Block/Admin API

Administrative APIs for blocking and managing packages. Requires admin access.

### Block Package

Block a package from being downloaded or published.

```
PUT /-/package/:fullname/blocks
```

#### Authentication
Required. Admin access only.

#### Parameters

- `fullname` (string): Package name to block

#### Request Body

```json
{
  "reason": "Detailed reason for blocking this package"
}
```

#### Example Request

```bash
curl -X PUT \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Package contains malicious code"
  }' \
  https://your-registry.com/-/package/malicious-package/blocks
```

#### Response

```json
{
  "ok": true,
  "id": "block-record-id",
  "package_id": "package-internal-id"
}
```

### Unblock Package

Remove a block from a package.

```
DELETE /-/package/:fullname/blocks
```

#### Authentication
Required. Admin access only.

#### Parameters

- `fullname` (string): Package name to unblock

#### Example Request

```bash
curl -X DELETE \
  -H "Authorization: Bearer admin-token" \
  https://your-registry.com/-/package/malicious-package/blocks
```

#### Response

```json
{
  "ok": true
}
```

### Get Package Block Status

Check if a package is blocked and why.

```
GET /-/package/:fullname/blocks
```

#### Parameters

- `fullname` (string): Package name to check

#### Example Request

```bash
curl https://your-registry.com/-/package/some-package/blocks
```

#### Response

```json
{
  "blocked": true,
  "reason": "Package contains malicious code (operator: admin/admin-id)",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

## Registry Management API

Manage multiple npm registries and their configurations.

### List Registries

Get all configured registries.

```
GET /-/registry
```

#### Query Parameters

- `pageSize` (number): Results per page (1-100, default: 20)
- `pageIndex` (number): Page number (0-based, default: 0)

#### Example Request

```bash
curl "https://your-registry.com/-/registry?pageSize=10&pageIndex=0"
```

#### Response

```json
{
  "data": [
    {
      "registryId": "npmjs",
      "name": "Official NPM Registry",
      "host": "https://registry.npmjs.org",
      "type": "npm",
      "userPrefix": "npm:",
      "changeStream": "https://replicate.npmjs.com",
      "response": null
    }
  ],
  "total": 1
}
```

### Get Registry Details

Get details for a specific registry.

```
GET /-/registry/:id
```

#### Parameters

- `id` (string): Registry ID

#### Example Request

```bash
curl https://your-registry.com/-/registry/npmjs
```

### Create Registry

Create a new registry configuration.

```
POST /-/registry
```

#### Authentication
Required. Admin access only.

#### Request Body

```json
{
  "name": "Custom Registry",
  "host": "https://my-custom-registry.com",
  "changeStream": "https://my-custom-registry.com/_changes",
  "type": "cnpm"
}
```

#### Example Request

```bash
curl -X POST \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Registry",
    "host": "https://my-custom-registry.com",
    "type": "cnpm"
  }' \
  https://your-registry.com/-/registry
```

## Hook Management API

Manage webhooks that trigger on package events (publish, install, etc.).

**Base Path**: All hook endpoints use the base path `/-/npm`

### Create Hook

Create a new webhook.

```
POST /-/npm/v1/hooks/hook
```

#### Authentication
Required.

#### Request Body

```json
{
  "type": "package",
  "name": "hook-name",
  "endpoint": "https://your-webhook-endpoint.com/hook",
  "secret": "webhook-secret-key"
}
```

#### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Hook type (e.g., "package") |
| `name` | string | Yes | Hook name (1-428 chars) |
| `endpoint` | string | Yes | Webhook URL (1-2048 chars) |
| `secret` | string | Yes | Secret key for webhook verification (1-200 chars) |

#### Example Request

```bash
curl -X POST \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "package",
    "name": "my-webhook",
    "endpoint": "https://my-server.com/webhook",
    "secret": "my-secret-key"
  }' \
  https://your-registry.com/-/npm/v1/hooks/hook
```

#### Response

```json
{
  "id": "hook-uuid",
  "name": "my-webhook",
  "type": "package",
  "endpoint": "https://my-server.com/webhook",
  "created": "2024-01-01T12:00:00.000Z",
  "updated": "2024-01-01T12:00:00.000Z",
  "delivered": false,
  "last_delivery": null
}
```

### Update Hook

Update an existing webhook.

```
PUT /-/npm/v1/hooks/hook/:id
```

#### Authentication
Required. Must be hook owner.

#### Parameters

- `id` (string): Hook ID

#### Request Body

```json
{
  "endpoint": "https://new-webhook-endpoint.com/hook",
  "secret": "new-secret-key"
}
```

#### Example Request

```bash
curl -X PUT \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://updated-server.com/webhook",
    "secret": "updated-secret"
  }' \
  https://your-registry.com/-/npm/v1/hooks/hook/hook-uuid
```

### Delete Hook

Remove a webhook.

```
DELETE /-/npm/v1/hooks/hook/:id
```

#### Authentication
Required. Must be hook owner.

#### Parameters

- `id` (string): Hook ID

#### Example Request

```bash
curl -X DELETE \
  -H "Authorization: Bearer your-token" \
  https://your-registry.com/-/npm/v1/hooks/hook/hook-uuid
```

#### Response

```json
{
  "id": "hook-uuid",
  "name": "my-webhook",
  "type": "package",
  "endpoint": "https://my-server.com/webhook",
  "created": "2024-01-01T12:00:00.000Z",
  "updated": "2024-01-01T12:00:00.000Z",
  "deleted": "2024-01-01T13:00:00.000Z"
}
```

### List Hooks

Get all hooks for the authenticated user.

```
GET /-/npm/v1/hooks
```

#### Authentication
Required.

#### Example Request

```bash
curl -H "Authorization: Bearer your-token" \
  https://your-registry.com/-/npm/v1/hooks
```

#### Response

```json
{
  "objects": [
    {
      "id": "hook-uuid",
      "name": "my-webhook",
      "type": "package",
      "endpoint": "https://my-server.com/webhook",
      "created": "2024-01-01T12:00:00.000Z",
      "updated": "2024-01-01T12:00:00.000Z",
      "delivered": true,
      "last_delivery": "2024-01-01T12:30:00.000Z"
    }
  ]
}
```

### Get Hook Details

Get details for a specific hook.

```
GET /-/npm/v1/hooks/hook/:id
```

#### Authentication
Required. Must be hook owner.

#### Parameters

- `id` (string): Hook ID

#### Example Request

```bash
curl -H "Authorization: Bearer your-token" \
  https://your-registry.com/-/npm/v1/hooks/hook/hook-uuid
```

## User Management API

Manage user accounts and authentication.

### Create User / Login

Create a new user account or login existing user.

```
PUT /-/user/org.couchdb.user::username
```

#### Parameters

- `username` (string): Username to create/login

#### Request Body

```json
{
  "_id": "org.couchdb.user:username",
  "name": "username",
  "password": "user-password",
  "email": "user@example.com",
  "type": "user",
  "roles": [],
  "date": "2024-01-01T12:00:00.000Z"
}
```

#### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string | Yes | Must be "org.couchdb.user:" + username |
| `name` | string | Yes | Username (1-100 chars) |
| `password` | string | Yes | Password (8-100 chars) |
| `email` | string | No | Email address (valid email format) |
| `type` | string | Yes | Must be "user" |
| `roles` | array | No | User roles (usually empty) |
| `date` | string | No | Registration date |

#### Example Request

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{
    "_id": "org.couchdb.user:johndoe",
    "name": "johndoe",
    "password": "securepassword123",
    "email": "john@example.com",
    "type": "user",
    "roles": []
  }' \
  https://your-registry.com/-/user/org.couchdb.user:johndoe
```

#### Response (Success - New User)

```json
{
  "ok": true,
  "id": "org.couchdb.user:johndoe",
  "rev": "1-hash",
  "token": "user-token-uuid"
}
```

#### Response (Success - Login)

```json
{
  "ok": true,
  "id": "org.couchdb.user:johndoe",
  "rev": "existing-rev-hash",
  "token": "user-token-uuid"
}
```

#### Error Responses

- `401 Unauthorized`: Wrong password for existing user
- `403 Forbidden`: Public registration disabled
- `409 Conflict`: User exists but email differs
- `422 Unprocessable Entity`: Username mismatch in URL/body

## Common Schemas

### Error Response

All APIs return errors in a consistent format:

```json
{
  "error": "error_code",
  "reason": "Human readable error message"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or invalid
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error

### Package Naming

Package names follow npm naming conventions:
- Unscoped: `package-name`
- Scoped: `@scope/package-name`
- Must match regex: `^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$`

## Examples

### Complete Sync Workflow

1. **Trigger sync for a package:**
```bash
curl -X PUT \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"tips": "API sync request"}' \
  https://your-registry.com/-/package/lodash/syncs
```

2. **Check sync status:**
```bash
curl -H "Authorization: Bearer your-token" \
  https://your-registry.com/-/package/lodash/syncs/task-id
```

3. **View sync logs:**
```bash
curl -H "Authorization: Bearer your-token" \
  https://your-registry.com/-/package/lodash/syncs/task-id/log
```

### Batch Operations

For multiple packages, send individual requests or implement your own batch processing script using these APIs.

### Error Handling

Always check the HTTP status code and response body for errors:

```bash
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer token" \
  https://your-registry.com/-/package/nonexistent/syncs)
http_code=$(echo "$response" | tail -c 4)
body=$(echo "$response" | sed 's/...$//')

if [ "$http_code" -ne 201 ]; then
  echo "Error: $body"
  exit 1
fi
```

## Rate Limiting

Be mindful of rate limits when making multiple API requests. Consider implementing:
- Delays between requests
- Exponential backoff for retries
- Concurrent request limits

## Security Considerations

- Always use HTTPS in production
- Store tokens securely and rotate them regularly
- Use read-only tokens when possible
- Implement IP whitelisting for sensitive operations
- Monitor API usage for unusual patterns

---

For more information about cnpmcore, visit the [official documentation](https://github.com/cnpm/cnpmcore).