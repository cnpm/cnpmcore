# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files first for better Docker layer caching
COPY package.json ./

# Install all dependencies (including devDependencies for tsc build)
RUN npm install -g npminstall --registry=https://registry.npmmirror.com \
  && npminstall -c

# Copy source and compile TypeScript (tsc compiles .ts to .js in-place)
COPY . .
RUN npm run tsc

# Prune to production dependencies only and clean up
RUN npmupdate -c --production \
  && npm cache clean --force

# Stage 2: Production — clean, minimal image
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy only the built application from builder (owned by node user)
COPY --from=builder --chown=node:node /usr/src/app/app.js ./
COPY --from=builder --chown=node:node /usr/src/app/app ./app
COPY --from=builder --chown=node:node /usr/src/app/config ./config
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/package.json ./

# Run as non-root user for security
USER node

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
CMD ["npm", "run", "start:foreground"]
