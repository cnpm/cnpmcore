#!/bin/bash

# set -ex

# read variables from environment
db_host=${CNPMCORE_DATABASE_HOST:-127.0.0.1}
db_port=${CNPMCORE_DATABASE_PORT:-3306}
db_username=${CNPMCORE_DATABASE_USER:-root}
db_password=${CNPMCORE_DATABASE_PASSWORD:-} # default to empty password
db_name=${CNPMCORE_DATABASE_NAME:-cnpmcore_unittest}

# prepare MySQL param
param="-h $db_host -P $db_port -u $db_username"
if [ -n "$db_password" ]; then
  param="$param -p$db_password"
fi

if [ "$CI" ]; then
  echo "⛷️ Skipping database creation in CI environment."
else
  # reset database
  echo "️😈 Reset database $db_name in local"
  mysql $param -e "DROP DATABASE IF EXISTS $db_name"
  mysql $param -e "CREATE DATABASE $db_name CHARACTER SET utf8"
fi


# find all sql files and sort
sql_files=$(ls sql/mysql/*.sql | sort)
echo "🤖 Running the following SQL files:"

# execute sql files
for file in $sql_files; do
  echo "🔖 Running $file..."
  mysql $param $db_name < "$file"
done

echo "🎉 prepare database $db_name done"
mysql $param -e "USE $db_name; SHOW TABLES;"
