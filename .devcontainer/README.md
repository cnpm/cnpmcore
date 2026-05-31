# Dev Container / GitHub Codespaces

This folder lets you develop cnpmcore in a fully provisioned container, either in
[GitHub Codespaces](https://github.com/features/codespaces) (in the browser or VS Code)
or locally with the
[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
extension. It bundles the external services cnpmcore needs (MySQL + Redis) and initializes
the development database automatically.

## Quick start

### GitHub Codespaces

1. On GitHub, click **Code -> Codespaces -> Create codespace on master**.
2. Wait for the container to build and `post-create.sh` to finish (installs deps and
   creates the `cnpmcore` database).
3. Start the registry:
   ```bash
   CNPMCORE_DATABASE_NAME=cnpmcore npm run dev
   ```
4. Open the forwarded port **7001** to reach the registry.

### VS Code Dev Containers (local)

1. Install Docker and the **Dev Containers** extension.
2. Open the repo and run **Dev Containers: Reopen in Container**.
3. Same as steps 3-4 above.

## What's inside

| Service | Image            | Purpose                               |
| ------- | ---------------- | ------------------------------------- |
| `app`   | `Dockerfile`     | Node.js 22 workspace + db client CLIs |
| `mysql` | `mysql:9`        | Default development/test database     |
| `redis` | `redis:6-alpine` | Cache + distributed lock (dev only)   |

The `app` container is preconfigured (via `docker-compose.yml` `environment:`) to reach
MySQL at host `mysql` and Redis at host `redis`, so the connection settings already point
at the right places.

> The test suite uses `ioredis-mock` and an Elasticsearch mock, so Redis/ES are only
> needed for `npm run dev`, not for `npm run test`.

## Common tasks

```bash
# Start the dev registry (MySQL)
CNPMCORE_DATABASE_NAME=cnpmcore npm run dev

# Run the full test suite (creates its own cnpmcore_unittest_* databases)
npm run test

# Run a single test file (fast)
npm run test:local test/path/to/file.test.ts

# Lint / format / type-check in one pass
npx vp check
```

> `npm run dev` needs `CNPMCORE_DATABASE_NAME=cnpmcore` because the dev database name is
> intentionally not set globally (that keeps the test suite's `cnpmcore_unittest_*`
> databases separate from your dev data).

## Switching to PostgreSQL

1. In `docker-compose.yml`, uncomment the `postgres` service and the `cnpm-postgres`
   volume.
2. On the `app` service, set:
   ```yaml
   CNPMCORE_DATABASE_TYPE: PostgreSQL
   CNPMCORE_DATABASE_HOST: postgres
   CNPMCORE_DATABASE_PORT: '5432'
   CNPMCORE_DATABASE_USER: postgres
   CNPMCORE_DATABASE_PASSWORD: postgres
   ```
   and change `depends_on` from `mysql` to `postgres`.
3. Rebuild the container (**Dev Containers: Rebuild Container**).
4. Run with `npm run dev:postgresql` / `npm run test:postgresql`.

The `app` image already includes the `postgresql-client`, so `post-create.sh` will pick
up `CNPMCORE_DATABASE_TYPE=PostgreSQL` and initialize the PostgreSQL database instead.
