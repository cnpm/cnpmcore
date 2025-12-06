# Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/app

# Copy package files for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --registry=https://registry.npmmirror.com

# Copy source files
COPY . .

# Build TypeScript
RUN npm run tsc

# Production stage
FROM node:22-bookworm-slim

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --registry=https://registry.npmmirror.com \
  && npm cache clean --force \
  && rm -rf /root/.npm /tmp/*

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy necessary runtime files
COPY app.ts index.d.ts module.d.ts ./
COPY config ./config
COPY sql ./sql

# Copy HTML templates from source
COPY app/port/*.html ./app/port/

ENV NODE_ENV=production \
  EGG_SERVER_ENV=prod \
  CNPMCORE_CONFIG_REGISTRY= \
  CNPMCORE_CONFIG_SOURCE_REGISTRY=https://registry.npmmirror.com \
  CNPMCORE_CONFIG_SOURCE_REGISTRY_IS_CNPM=true \
  CNPMCORE_DATABASE_TYPE= \
  CNPMCORE_DATABASE_NAME= \
  CNPMCORE_DATABASE_HOST= \
  CNPMCORE_DATABASE_PORT=3306 \
  CNPMCORE_DATABASE_USER= \
  CNPMCORE_DATABASE_PASSWORD= \
  CNPMCORE_REDIS_HOST= \
  CNPMCORE_REDIS_PORT=6379 \
  CNPMCORE_REDIS_PASSWORD= \
  CNPMCORE_REDIS_DB= \
  CNPMCORE_NFS_TYPE=s3 \
  CNPMCORE_NFS_S3_CLIENT_ENDPOINT= \
  CNPMCORE_NFS_S3_CLIENT_BUCKET= \
  CNPMCORE_NFS_S3_CLIENT_ID= \
  CNPMCORE_NFS_S3_CLIENT_SECRET= \
  CNPMCORE_NFS_S3_CLIENT_FORCE_PATH_STYLE=true \
  CNPMCORE_NFS_S3_CLIENT_DISABLE_URL=true \
  TZ=Asia/Shanghai

EXPOSE 7001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:foreground"]
