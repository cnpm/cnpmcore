# Docker Images for cnpmcore

This directory contains optimized Dockerfiles for building cnpmcore container images.

## Available Images

### Alpine (Recommended)
- **Base**: `node:22-alpine`
- **Size**: Smallest footprint
- **Build**: `npm run images:alpine`
- **Tag**: `cnpmcore:alpine-latest`

### Debian
- **Base**: `node:22-bookworm-slim`
- **Size**: Larger but better compatibility
- **Build**: `npm run images:debian`
- **Tag**: `cnpmcore:latest`

## Optimization Features

Both Dockerfiles use multi-stage builds with the following optimizations:

1. **Separate Build and Runtime Stages**
   - Builder stage: All dependencies + TypeScript compilation
   - Production stage: Only runtime dependencies + compiled code

2. **Layer Caching**
   - Package files copied first for better cache utilization
   - Dependencies only reinstalled when package.json changes

3. **Production Dependencies Only**
   - `npm ci --only=production` in production stage
   - Removes all devDependencies from final image

4. **Clean Artifacts**
   - npm cache cleaned after installation
   - Temporary files removed in same RUN command

5. **Signal Handling**
   - dumb-init for proper SIGTERM handling
   - Graceful container shutdown

## Building Images

### Build both variants
```bash
npm run images
```

### Build Alpine only
```bash
npm run images:alpine
```

### Build Debian only
```bash
npm run images:debian
```

## Testing Images

### Check image size
```bash
docker images cnpmcore
```

### Test Alpine image
```bash
docker run -d -p 7001:7001 \
  -e CNPMCORE_DATABASE_TYPE=MySQL \
  -e CNPMCORE_DATABASE_HOST=host.docker.internal \
  -e CNPMCORE_DATABASE_NAME=cnpmcore \
  --name cnpmcore-test \
  cnpmcore:alpine-latest

# Check logs
docker logs -f cnpmcore-test

# Test endpoint
curl http://localhost:7001

# Cleanup
docker stop cnpmcore-test
docker rm cnpmcore-test
```

### Test Debian image
```bash
docker run -d -p 7001:7001 \
  -e CNPMCORE_DATABASE_TYPE=MySQL \
  -e CNPMCORE_DATABASE_HOST=host.docker.internal \
  -e CNPMCORE_DATABASE_NAME=cnpmcore \
  --name cnpmcore-test \
  cnpmcore:latest

# Check logs
docker logs -f cnpmcore-test

# Test endpoint
curl http://localhost:7001

# Cleanup
docker stop cnpmcore-test
docker rm cnpmcore-test
```

## Image Contents

The final production images contain:

```
/usr/src/app/
├── dist/                 # Compiled JavaScript from TypeScript
├── config/               # Configuration files
├── sql/                  # Database migration scripts
├── app/port/*.html       # HTML templates
├── app.ts                # Application entry point
├── index.d.ts            # Type definitions
├── module.d.ts           # Module definitions
├── package.json          # Package metadata
├── package-lock.json     # Dependency lock file
└── node_modules/         # Production dependencies only
```

## Excluded from Final Image

The multi-stage build excludes:

- TypeScript source files (app/**/*.ts)
- Test files (test/**)
- Development dependencies (devDependencies in package.json)
- Build tools (TypeScript compiler, linters, etc.)
- Documentation (*.md files)
- Git history (.git/)
- IDE configurations (.vscode/, .idea/)
- CI/CD files (.github/, .husky/)

## Size Comparison

Expected size reduction compared to single-stage build:

| Component | Size Saved |
|-----------|------------|
| DevDependencies | ~50-100MB |
| TypeScript source | ~10-20MB |
| Build artifacts | ~5-10MB |
| **Total** | **30-50%** |

## Troubleshooting

### Build fails with network timeout
The build requires internet access to download npm packages. If behind a proxy, configure Docker to use it:

```bash
docker build --build-arg HTTP_PROXY=http://proxy:port \
  --build-arg HTTPS_PROXY=http://proxy:port \
  -f .docker/alpine/Dockerfile .
```

### Container exits immediately
Check that all required environment variables are set. At minimum:
- `CNPMCORE_DATABASE_TYPE`
- `CNPMCORE_DATABASE_HOST`
- `CNPMCORE_DATABASE_NAME`

### Permission errors
Ensure the database and Redis are accessible from the container. Use `host.docker.internal` for localhost services on Docker Desktop.

## See Also

- [DOCKER_OPTIMIZATION.md](../DOCKER_OPTIMIZATION.md) - Detailed optimization documentation
- [docs/deploy-in-docker.md](../docs/deploy-in-docker.md) - Full deployment guide
