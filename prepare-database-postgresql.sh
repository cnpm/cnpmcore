#!/bin/bash

# set -ex

# read variables from environment
db_host=${POSTGRES_HOST:-127.0.0.1}
db_port=${POSTGRES_PORT:-5432}
db_username=${POSTGRES_USER:-postgres}
db_password=${POSTGRES_PASSWORD:-postgres} # default to empty password
db_name=${CNPMCORE_DATABASE_NAME:-cnpmcore_unittest}

# prepare PostgreSQL param
param=""
if [ -n "$db_host" ]; then
  param="$param --host=$db_host"
fi
if [ -n "$db_port" ]; then
  param="$param --port=$db_port"
fi
if [ -n "$db_username" ]; then
  param="$param --username=$db_username"
fi
if [ -n "$db_password" ]; then
  # https://stackoverflow.com/questions/6405127/how-do-i-specify-a-password-to-psql-non-interactively
  export PGPASSWORD=$db_password
fi

# reset database
echo "️😈 Reset database $db_name in local"
dropdb $param $db_name || echo "ignore database not exists"
# http://www.postgres.cn/docs/15/app-createdb.html
createdb $param --echo --encoding=UTF8 $db_name

# find all sql files and sort
sql_files=$(ls sql/postgresql/*.sql | sort)
echo "🤖 Running the following SQL files:"

# execute sql files
for file in $sql_files; do
  echo "🔖 Running $file..."
  # psql $param --dbname=$db_name --file=$file --echo-all
  psql $param --dbname=$db_name --file=$file --quiet
done

echo "🎉 prepare database $db_name done"
# psql $param --dbname=$db_name -c "SELECT * FROM pg_catalog.pg_tables where schemaname = 'public';"
psql $param --dbname=$db_name -c "\dt"

# Create per-worker databases for vitest parallel execution
# Default to the number of CPU cores
cpu_cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
max_workers=${CNPMCORE_TEST_WORKERS:-$cpu_cores}
for i in $(seq 0 $max_workers); do
  worker_db="${db_name}_${i}"
  echo "😈 Reset worker database $worker_db"
  dropdb $param $worker_db 2>/dev/null || true
  createdb $param --echo --encoding=UTF8 $worker_db
  for file in $sql_files; do
    psql $param --dbname=$worker_db --file=$file --quiet
  done
done
echo "🎉 prepare worker databases done"
