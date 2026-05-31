#!/usr/bin/env bash
#
# Runs once after the dev container is created:
#   1. install npm dependencies
#   2. wait for the database to accept connections
#   3. initialize the `cnpmcore` development database
#
set -euo pipefail

echo "📦 Installing npm dependencies..."
npm install

DB_TYPE="${CNPMCORE_DATABASE_TYPE:-MySQL}"
# Development database name (kept separate from the test suite's cnpmcore_unittest_* dbs).
DEV_DB_NAME="cnpmcore"

if [ "$DB_TYPE" = "PostgreSQL" ]; then
  PG_HOST="${CNPMCORE_DATABASE_HOST:-postgres}"
  PG_PORT="${CNPMCORE_DATABASE_PORT:-5432}"
  PG_USER="${CNPMCORE_DATABASE_USER:-postgres}"
  echo "⏳ Waiting for PostgreSQL at ${PG_HOST}:${PG_PORT}..."
  until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" >/dev/null 2>&1; do
    sleep 1
  done
  echo "🗄️  Initializing PostgreSQL database '${DEV_DB_NAME}'..."
  CNPMCORE_DATABASE_NAME="$DEV_DB_NAME" CNPMCORE_TEST_WORKERS=0 \
    bash ./prepare-database-postgresql.sh
else
  DB_HOST="${CNPMCORE_DATABASE_HOST:-mysql}"
  DB_PORT="${CNPMCORE_DATABASE_PORT:-3306}"
  DB_USER="${CNPMCORE_DATABASE_USER:-root}"
  echo "⏳ Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
  until mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --silent >/dev/null 2>&1; do
    sleep 1
  done
  echo "🗄️  Initializing MySQL database '${DEV_DB_NAME}'..."
  CNPMCORE_DATABASE_NAME="$DEV_DB_NAME" CNPMCORE_TEST_WORKERS=0 \
    bash ./prepare-database-mysql.sh
fi

cat <<'EOF'

✅ cnpmcore dev container is ready!

Start the registry (MySQL):
    CNPMCORE_DATABASE_NAME=cnpmcore npm run dev
Then open the forwarded port 7001.

Run the test suite (uses its own cnpmcore_unittest databases):
    npm run test

EOF
