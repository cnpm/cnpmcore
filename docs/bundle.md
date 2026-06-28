# 打包 / snapshot 启动 cnpmcore

cnpmcore 可以通过 [`@eggjs/egg-bundler`](https://github.com/eggjs/egg/tree/next/tools/egg-bundler)
打包成一个自包含、可部署的 CommonJS 产物，由 `egg-bin bundle` 命令驱动。打包后的产物以
Egg 单进程模式（`mode: 'single'`，agent 与 worker 同进程）启动，适用于加速冷启动、缩小部署
镜像以及 Serverless 场景。

> 要求：`egg` / `@eggjs/core` / `@eggjs/tegg-plugin` 需包含 bundle 启动路径修复
> （见 eggjs/egg#5987）。请使用包含该修复的发布版本。`@eggjs/egg-bundler` 已在
> `devDependencies` 中声明。

## 1. 构建产物

```bash
# 自动外置（externals）原生/可选平台包，内联其余所有内容（含 egg 与 @eggjs/*）。
# 大多数情况下无需手动 --force-external。
npx egg-bin bundle
```

默认产物输出到 `./dist-bundle`，包含 `worker.js`（入口）、若干 `@utoo/pack` chunk、
拷贝的运行时资源（如 `app/port/*.html`）以及 `bundle-manifest.json`。

如果 `.egg/manifest.json` 不存在，打包器会先以 `metadataOnly` 模式启动应用生成它。

## 2. 准备 external 依赖

被识别为 external 的包（leoric、数据库驱动 `mysql`/`pg`/`sqlite3`、`@cnpmjs/packument`
的原生平台包等）不会被内联，必须能从 `worker.js` 旁解析到。两种方式：

```bash
# 方式 A：把应用 package.json 拷到产物目录并安装生产依赖
cd dist-bundle
cp ../package.json .
npm ci --omit=dev

# 方式 B（本地验证）：直接复用项目已安装的 node_modules
cd dist-bundle
ln -s ../node_modules node_modules
```

## 3. 启动 snapshot

cnpmcore 需要 MySQL（或 PostgreSQL）与 Redis。通过环境变量配置后启动 `worker.js`：

```bash
cd dist-bundle
EGG_SERVER_ENV=prod \
NODE_ENV=production \
CNPMCORE_DATABASE_TYPE=MySQL \
CNPMCORE_DATABASE_NAME=cnpmcore \
CNPMCORE_DATABASE_HOST=127.0.0.1 \
CNPMCORE_REDIS_HOST=127.0.0.1 \
CNPMCORE_FORCE_LOCAL_FS=true \
CNPMCORE_CONFIG_REGISTRY=http://127.0.0.1:7001 \
node worker.js
# => [egg-bundler] server listening on port 7001
```

常用环境变量：

| 变量                       | 说明                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `CNPMCORE_DATABASE_TYPE`   | `MySQL`（默认）或 `PostgreSQL`。                                     |
| `CNPMCORE_DATABASE_NAME`   | 数据库名（如 `cnpmcore`），需提前建库并执行 `sql/` 下的初始化脚本。 |
| `CNPMCORE_DATABASE_HOST`   | 数据库地址，默认 `127.0.0.1`。                                       |
| `CNPMCORE_REDIS_HOST`      | Redis 地址，默认 `127.0.0.1`。                                        |
| `CNPMCORE_FORCE_LOCAL_FS`  | 生产环境下 `NFSClientAdapter` 默认禁止本地 fs 存储；设为 `true` 可使用本地 fs（仅用于自托管/验证，生产建议配置真实 NFS/OSS/S3）。 |
| `CNPMCORE_CONFIG_REGISTRY` | 当前 registry 对外地址。npm manifest 里的 `dist.tarball` 会使用它，做本地 snapshot 回归时必须指向本地启动端口。 |
| `CNPMCORE_DATA_DIR`        | 本地数据目录，包含 local fs NFS 存储。建议本地回归时指到临时目录，避免污染已有数据。 |
| `CNPMCORE_REDIS_DB`        | Redis DB 编号。并行启动多份 snapshot 时建议显式指定不同 DB。          |
| `PORT`                     | 监听端口，默认 `7001`。                                              |

数据库初始化（MySQL 示例）：

```bash
CNPMCORE_DATABASE_NAME=cnpmcore bash ./prepare-database-mysql.sh
```

本地研发时建议使用独立端口、独立数据库和独立数据目录，避免和正在运行的 `egg-cnpmcore-snap`
或源码 dev server 互相污染：

```bash
CNPMCORE_DATABASE_NAME=cnpmcore_snapshot_regression bash ./prepare-database-mysql.sh

cd dist-bundle
PORT=7002 \
EGG_SERVER_ENV=prod \
NODE_ENV=production \
CNPMCORE_DATABASE_TYPE=MySQL \
CNPMCORE_DATABASE_NAME=cnpmcore_snapshot_regression \
CNPMCORE_DATABASE_HOST=127.0.0.1 \
CNPMCORE_REDIS_HOST=127.0.0.1 \
CNPMCORE_REDIS_DB=15 \
CNPMCORE_FORCE_LOCAL_FS=true \
CNPMCORE_CONFIG_REGISTRY=http://127.0.0.1:7002 \
CNPMCORE_DATA_DIR=/tmp/cnpmcore-snapshot-regression-data \
node worker.js
```

启动后先确认健康检查和数据库路径都可用。只看 `/-/ping` 不够，`/-/ping` 通过但 ORM
未连接时，npm 登录、发布等真实 registry 路径仍会失败。

```bash
curl -sS http://127.0.0.1:7002/-/ping
curl -sS http://127.0.0.1:7002/
```

## 4. npm 客户端功能回归

snapshot 启动后即为一个可用的 npm registry。回归时应在临时目录中使用独立 `.npmrc`
和 cache，并显式把 npm registry 指向 snapshot 服务，避免读写全局 npm 配置。

### 4.1 准备临时 npm 客户端

```bash
REGISTRY=http://127.0.0.1:7002
WORKDIR=$(mktemp -d /tmp/cnpmcore-snapshot-npm-regression.XXXXXX)
USERCONFIG=$WORKDIR/.npmrc
CACHE=$WORKDIR/cache
PKG_NAME=@cnpmcore/snapshot-regression-$(date +%s)
export REGISTRY WORKDIR USERCONFIG CACHE PKG_NAME

mkdir -p "$WORKDIR/pkg" "$WORKDIR/consumer" "$CACHE"

# 注册或登录管理员用户。config.cnpmcore.admins 默认包含 cnpmcore_admin。
node -e "
const fs = require('node:fs/promises');
const registry = process.env.REGISTRY;
const userconfig = process.env.USERCONFIG;
const user = {
  name: 'cnpmcore_admin',
  password: '12345678',
  email: 'admin@cnpmjs.org',
  type: 'user',
};
fetch(registry + '/-/user/org.couchdb.user:' + user.name, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(user),
}).then(async res => {
  const text = await res.text();
  if (!res.ok) throw new Error(res.status + ' ' + text);
  const body = JSON.parse(text);
  const url = new URL(registry);
  await fs.writeFile(userconfig, '\n//' + url.host + '/:_authToken=' + body.token + '\n');
  console.log(body.id);
});
"

npm whoami --registry="$REGISTRY" --userconfig="$USERCONFIG" --cache="$CACHE"
```

### 4.2 发布、查看、安装

发布包名必须使用允许的 scope。默认允许 `@cnpm`、`@cnpmcore`、`@example`，
非 scope 包默认不允许发布。

```bash
cat > "$WORKDIR/pkg/package.json" <<EOF
{
  "name": "$PKG_NAME",
  "version": "1.0.0",
  "description": "cnpmcore snapshot npm client regression fixture",
  "main": "index.js",
  "files": ["index.js"],
  "license": "MIT"
}
EOF

cat > "$WORKDIR/pkg/index.js" <<'EOF'
module.exports = function snapshotRegression() {
  return 'cnpmcore snapshot npm client ok';
};
EOF

npm publish \
  "$WORKDIR/pkg" \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

npm view "$PKG_NAME" name version dist.tarball dist.integrity \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

cat > "$WORKDIR/consumer/package.json" <<EOF
{
  "name": "cnpmcore-snapshot-regression-consumer",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "$PKG_NAME": "1.0.0"
  }
}
EOF

npm install \
  --package-lock=false \
  --no-audit \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE" \
  --prefix "$WORKDIR/consumer"

node -e "
const pkg = require(process.env.WORKDIR + '/consumer/node_modules/' + process.env.PKG_NAME);
const value = pkg();
if (value !== 'cnpmcore snapshot npm client ok') throw new Error(value);
console.log(value);
"
```

### 4.3 元数据和权限接口

```bash
npm dist-tag add "$PKG_NAME@1.0.0" beta \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

npm dist-tag ls "$PKG_NAME" \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

npm dist-tag rm "$PKG_NAME" beta \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

npm deprecate "$PKG_NAME@1.0.0" "snapshot regression deprecation check" \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

npm view "$PKG_NAME@1.0.0" deprecated \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

npm owner ls "$PKG_NAME" \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

npm access list collaborators "$PKG_NAME" \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"
```

### 4.4 删除和回查

```bash
npm unpublish --force "$PKG_NAME@1.0.0" \
  --registry="$REGISTRY" \
  --userconfig="$USERCONFIG" \
  --cache="$CACHE"

ENCODED_PKG=$(node -e "
const [scope, name] = process.argv[1].split('/');
console.log(scope + '%2f' + name);
" "$PKG_NAME")
curl -sS "$REGISTRY/$ENCODED_PKG" | grep unpublished

# unpublish 后再次安装应失败，常见结果为 ETARGET。
if npm install "$PKG_NAME@1.0.0" \
    --package-lock=false \
    --no-audit \
    --registry="$REGISTRY" \
    --userconfig="$USERCONFIG" \
    --cache="$CACHE" \
    --prefix "$WORKDIR/consumer"; then
  echo "unexpected install success after unpublish"
  exit 1
else
  echo "expected install failure after unpublish"
fi
```

## 限制

- 仅单进程模式；agent 与 worker 同进程，暂不支持集群模式打包。
- 原生 addon 始终保持 external，必须在部署目标上预先存在。
