#!/bin/bash

set -e

# Get data directory, default to .cnpmcore_unittest for tests
DATA_DIR=${CNPMCORE_DATA_DIR:-.cnpmcore_unittest}
DB_NAME=${CNPMCORE_DATABASE_NAME:-cnpmcore_unittest}
DB_PATH=${CNPMCORE_SQLITE_PATH:-"${DATA_DIR}/${DB_NAME}.sqlite"}

# Create data directory if it doesn't exist
mkdir -p "${DATA_DIR}"

# Check if this is a test environment (unittest in name or path)
IS_TEST=false
if [[ "$DB_NAME" == *"unittest"* ]] || [[ "$DATA_DIR" == *"unittest"* ]]; then
  IS_TEST=true
fi

# For tests: always start fresh (remove existing database)
# For dev: only create if doesn't exist
if [ "$IS_TEST" = true ] && [ -f "$DB_PATH" ]; then
  echo "Removing existing test database: $DB_PATH"
  rm -f "$DB_PATH"
fi

# Create database if it doesn't exist
if [ ! -f "$DB_PATH" ]; then
  echo "Creating SQLite database at: $DB_PATH"
  sqlite3 "$DB_PATH" < sql/ddl_sqlite.sql
  echo "SQLite database ready: $DB_PATH"
else
  echo "SQLite database already exists: $DB_PATH"
fi
