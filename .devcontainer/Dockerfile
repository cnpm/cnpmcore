# Base image ships Node.js 22 (matches the project engines range) plus common dev tooling.
# https://github.com/devcontainers/images/tree/main/src/typescript-node
FROM mcr.microsoft.com/devcontainers/typescript-node:4-22-bookworm

# The prepare-database-*.sh scripts shell out to the `mysql` / `psql`, `createdb`,
# `dropdb` client CLIs, which are not present in the base image. Install both so the
# container works whether CNPMCORE_DATABASE_TYPE is MySQL (default) or PostgreSQL.
RUN apt-get update \
  && export DEBIAN_FRONTEND=noninteractive \
  && apt-get install -y --no-install-recommends \
    default-mysql-client \
    postgresql-client \
  && apt-get clean -y \
  && rm -rf /var/lib/apt/lists/*
