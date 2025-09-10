# cnpmcore - Private NPM Registry for Enterprise

cnpmcore is a TypeScript-based private NPM registry implementation built with Egg.js framework. It provides enterprise-grade package management with support for MySQL/PostgreSQL databases, Redis caching, and optional Elasticsearch.

**ALWAYS reference these instructions first** and fallback to search or bash commands only when you encounter unexpected information that does not match the information here.

## Prerequisites and Environment Setup

- **Node.js**: Version 20.18.0 or higher (required by engines field in package.json)
- **Database**: MySQL 5.7+ or PostgreSQL 17+
- **Cache**: Redis 6+
- **Optional**: Elasticsearch 8.x for enhanced search capabilities

## Working Effectively

### Bootstrap and Build
```bash
# Install dependencies (takes ~2 minutes)
npm install

# Copy environment configuration
cp .env.example .env

# Lint code (very fast, <1 second)
npm run lint

# Fix linting issues
npm run lint:fix

# Build TypeScript (takes ~6 seconds)
npm run tsc

# Production build (takes ~6 seconds)
npm run tsc:prod
```

### Database Setup - MySQL (Recommended for Development)
```bash
# Start MySQL + Redis services via Docker (takes ~1 minute to pull images initially)
docker compose -f docker-compose.yml up -d

# Verify services are running
docker compose ps

# Initialize database (takes <2 seconds)
CNPMCORE_DATABASE_NAME=cnpmcore bash ./prepare-database-mysql.sh

# For tests, create test database
mysql -h 127.0.0.1 -P 3306 -u root -e "CREATE DATABASE cnpmcore_unittest;"
```

### Database Setup - PostgreSQL (Alternative)
```bash
# Start PostgreSQL + Redis services via Docker
docker compose -f docker-compose-postgres.yml up -d

# Initialize database (takes <1 second)
CNPMCORE_DATABASE_NAME=cnpmcore bash ./prepare-database-postgresql.sh
```

### Development Server
```bash
# MySQL development server (starts in ~20 seconds)
npm run dev
# Server runs on http://127.0.0.1:7001

# PostgreSQL development server
npm run dev:postgresql
# Server runs on http://127.0.0.1:7001
```

### Testing
```bash
# Run full test suite with MySQL - NEVER CANCEL: Takes 4+ minutes. Set timeout to 10+ minutes.
npm run test

# Run full test suite with PostgreSQL - NEVER CANCEL: Takes 4+ minutes. Set timeout to 10+ minutes.
npm run test:postgresql

# Run single test file (for faster iteration, takes ~12 seconds)
npm run test:local test/common/CryptoUtil.test.ts

# Test coverage with MySQL - NEVER CANCEL: Takes 5+ minutes. Set timeout to 15+ minutes.
npm run cov

# Test coverage with PostgreSQL - NEVER CANCEL: Takes 5+ minutes. Set timeout to 15+ minutes.
npm run cov:postgresql
```

**CRITICAL TESTING NOTES:**
- **NEVER CANCEL** build or test commands - they may take 4-15 minutes to complete
- Individual test files run much faster (~12 seconds) for development iteration
- Full test suite processes 100+ test files and requires database initialization
- Test failures may occur in CI environment; use individual test files for validation

### Production Commands
```bash
# CI pipeline commands - NEVER CANCEL: Takes 5+ minutes. Set timeout to 15+ minutes.
npm run ci          # MySQL CI (includes lint, test, coverage, build)
npm run ci:postgresql  # PostgreSQL CI

# Production start/stop
npm run start       # Start as daemon
npm run stop        # Stop daemon
npm run start:foreground  # Start in foreground for debugging
```

## Validation Scenarios

**ALWAYS manually validate changes** by running through these scenarios:

### Basic API Validation
```bash
# Start development server
npm run dev

# Test registry root endpoint
curl http://127.0.0.1:7001
# Should return JSON with app metadata and stats

# Test authentication endpoint
curl http://127.0.0.1:7001/-/whoami
# Should return authentication error (expected when not logged in)

# Test package listing (initially empty)
curl http://127.0.0.1:7001/-/all
```

### Admin User Setup and Package Publishing
```bash
# Register admin user (cnpmcore_admin) - requires allowPublicRegistration=true in config
npm login --registry=http://127.0.0.1:7001

# Verify login
npm whoami --registry=http://127.0.0.1:7001

# Test package publishing
npm publish --registry=http://127.0.0.1:7001
```

## Architecture and Navigation

### Project Structure
```
app/
├── common/          # Global utilities and adapters
│   ├── adapter/     # External service adapters (NpmRegistry, Binary, etc.)
│   └── enum/        # Shared enumerations
├── core/            # Business logic layer
│   ├── entity/      # Core domain models
│   ├── event/       # Event handlers and async processing
│   ├── service/     # Core business services
│   └── util/        # Internal utilities
├── port/            # Interface layer
│   ├── controller/  # HTTP controllers
│   ├── middleware/  # Express middleware
│   ├── schedule/    # Background job schedulers
│   └── webauth/     # WebAuth integration
├── repository/      # Data access layer
│   ├── model/       # ORM models
│   └── util/        # Repository utilities
└── infra/           # Infrastructure adapters
```

### Key Services and Controllers
- **PackageController**: Main package CRUD operations
- **PackageManagerService**: Core package management business logic
- **BinarySyncerService**: Binary package synchronization
- **ChangesStreamService**: NPM registry change stream processing
- **UserController**: User authentication and profile management

### Configuration Files
- `config/config.default.ts`: Main application configuration
- `config/database.ts`: Database connection settings
- `.env`: Environment-specific variables
- `tsconfig.json`: TypeScript compilation settings

## Common Development Tasks

### Adding New Features
1. **ALWAYS run** `npm run lint:fix` before making changes
2. Add entity classes in `app/core/entity/` for new domain models
3. Add services in `app/core/service/` for business logic
4. Add controllers in `app/port/controller/` for HTTP endpoints
5. Add repositories in `app/repository/` for data access
6. **ALWAYS run** tests and linting before committing

### Database Migrations
- SQL files are in `sql/mysql/` and `sql/postgresql/`
- Migration scripts automatically run during database preparation
- **NEVER** modify existing migration files - only add new ones

### Background Jobs
- Schedulers are in `app/port/schedule/`
- Include sync workers, cleanup tasks, and stream processors
- Jobs run automatically when development server starts

## Troubleshooting

### Database Connection Issues
```bash
# Check if services are running
docker compose ps

# Reset MySQL environment
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d
CNPMCORE_DATABASE_NAME=cnpmcore bash ./prepare-database-mysql.sh

# Reset PostgreSQL environment
docker compose -f docker-compose-postgres.yml down
docker compose -f docker-compose-postgres.yml up -d
CNPMCORE_DATABASE_NAME=cnpmcore bash ./prepare-database-postgresql.sh
```

### Build Issues
```bash
# Clean and rebuild
npm run clean
npm run tsc

# Check TypeScript configuration
npx tsc --noEmit
```

### Test Issues
```bash
# Create missing test database
mysql -h 127.0.0.1 -P 3306 -u root -e "CREATE DATABASE cnpmcore_unittest;"

# Run single test for debugging
npm run test:local test/common/CryptoUtil.test.ts
```

## CI/CD Integration

The project uses GitHub Actions with workflows in `.github/workflows/`:
- `nodejs.yml`: Main CI pipeline with MySQL, PostgreSQL, and Elasticsearch testing
- Multiple Node.js versions tested: 20, 22, 24
- **CRITICAL**: CI jobs include long-running tests that can take 15+ minutes per database type

### Pre-commit Validation
**ALWAYS run before committing:**
```bash
npm run lint:fix    # Fix linting issues
npm run tsc        # Verify TypeScript compilation
npm run test:local test/path/to/relevant.test.ts  # Run relevant tests
```

## Docker Support

### Development Environments
- `docker-compose.yml`: MySQL + Redis + phpMyAdmin
- `docker-compose-postgres.yml`: PostgreSQL + Redis + pgAdmin  
- `docker-compose-es.yml`: Elasticsearch integration

### Production Images
```bash
# Build Alpine image
npm run images:alpine

# Build Debian image  
npm run images:debian
```

## External Dependencies

- **Database**: MySQL 9.x or PostgreSQL 17+
- **Cache**: Redis 6+ 
- **Search**: Elasticsearch 8.x (optional)
- **Storage**: Local filesystem or S3-compatible storage
- **Framework**: Egg.js with extensive TypeScript integration

## Performance Notes

- **Startup Time**: ~20 seconds for development server
- **Build Time**: ~6 seconds for TypeScript compilation  
- **Test Time**: 4-15 minutes for full suite (database dependent)
- **Package Installation**: ~2 minutes for npm install
- **Database Init**: <2 seconds for either MySQL or PostgreSQL

Always account for these timings when setting timeouts for automated processes.