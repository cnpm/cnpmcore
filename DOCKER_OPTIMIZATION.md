# Docker Image Optimization

This document describes the optimizations applied to reduce Docker image size based on best practices from [A Step-by-Step Guide to Docker Image Optimisation](https://blog.prateekjain.dev/a-step-by-step-guide-to-docker-image-optimisation-reduce-size-by-over-95-d90bcab3819d).

## Optimizations Applied

### 1. Multi-Stage Builds

**Before**: Single-stage build that includes all build tools and dependencies in the final image.

**After**: Two-stage build process:
- **Builder stage**: Contains all development dependencies and TypeScript compilation
- **Production stage**: Contains only runtime dependencies and compiled code

**Benefits**:
- Removes TypeScript compiler and build tools from final image
- Removes devDependencies (testing frameworks, type definitions, etc.)
- Significantly reduces final image size

### 2. Improved Layer Caching

**Before**: Copied entire source code before npm install, causing cache invalidation on any code change.

**After**: 
```dockerfile
# Copy package files first
COPY package*.json ./
# Install dependencies (cached unless package files change)
RUN npm ci --registry=https://registry.npmmirror.com
# Then copy source files
COPY . .
```

**Benefits**:
- Dependencies are cached and only reinstalled when package.json changes
- Faster rebuilds during development
- Reduced build time

### 3. Production Dependencies Only

**Before**: Used custom build script that installed all dependencies then tried to clean up.

**After**: 
```dockerfile
# In production stage
RUN npm ci --only=production --registry=https://registry.npmmirror.com \
  && npm cache clean --force \
  && rm -rf /root/.npm /tmp/*
```

**Benefits**:
- Only production dependencies in final image
- Clean npm cache to save space
- Remove temporary files

### 4. Enhanced .dockerignore

**Before**: Basic exclusions (node_modules, logs, coverage).

**After**: Comprehensive exclusions including:
- Development files (.git, .github, .vscode, .idea)
- Documentation (*.md except README.md, docs/)
- Testing infrastructure (test/)
- Build artifacts (dist, *.tsbuildinfo)
- CI/CD configurations (.husky, prettier, oxlint configs)
- Development scripts (docker-compose files, database setup scripts)

**Benefits**:
- Smaller build context sent to Docker daemon
- Faster build times
- Cleaner image contents

### 5. Selective File Copying

**Before**: Copied entire source directory to production image.

**After**: Only copy necessary runtime files:
- Built dist/ directory
- Configuration files (config/, sql/)
- Entry point files (app.ts, index.d.ts, module.d.ts)
- HTML templates (app/port/*.html)

**Benefits**:
- Smaller final image
- No unnecessary source files in production
- Reduced attack surface

### 6. Signal Handling with dumb-init

**Added**: dumb-init as the entry point for proper signal handling.

```dockerfile
RUN apk add --no-cache dumb-init  # Alpine
# or
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init  # Debian

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:foreground"]
```

**Benefits**:
- Proper handling of SIGTERM and other signals
- Graceful container shutdown
- Prevents zombie processes

### 7. Consolidated RUN Commands

**Before**: Multiple separate RUN commands (via build script).

**After**: Consolidated RUN commands with cleanup in same layer:
```dockerfile
RUN npm ci --only=production --registry=https://registry.npmmirror.com \
  && npm cache clean --force \
  && rm -rf /root/.npm /tmp/*
```

**Benefits**:
- Fewer layers in final image
- Temporary files don't persist in intermediate layers
- Smaller overall image size

## Expected Results

Based on typical multi-stage build optimizations:

- **Development dependencies removed**: ~50-100MB savings (TypeScript, testing tools, type definitions)
- **Source files removed**: ~10-20MB savings (TypeScript source, tests, documentation)
- **Build artifacts cleaned**: ~5-10MB savings (npm cache, temporary files)
- **Total expected savings**: 30-50% reduction in final image size

## Building Optimized Images

```bash
# Build Alpine image (recommended for smallest size)
npm run images:alpine

# Build Debian image (better compatibility)
npm run images:debian

# Check image sizes
docker images cnpmcore
```

## Verification

To verify the optimized images work correctly:

```bash
# Run the container
docker run -d -p 7001:7001 --name cnpmcore-test cnpmcore:alpine-latest

# Check logs
docker logs cnpmcore-test

# Test the service
curl http://localhost:7001

# Clean up
docker stop cnpmcore-test
docker rm cnpmcore-test
```

## Future Optimization Opportunities

1. **Distroless images**: Consider using distroless Node.js images for even smaller size
2. **Binary compilation**: Investigate node-prune or similar tools to remove unnecessary files from node_modules
3. **Compression**: Use tools like upx to compress binaries (trade-off with startup time)
4. **Alpine optimization**: Further reduce Alpine image by removing unnecessary packages
