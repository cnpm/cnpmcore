# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cnpmcore is a TypeScript-based private NPM registry implementation for enterprise use. It's built on the Egg.js framework using Domain-Driven Design (DDD) architecture principles and supports both MySQL and PostgreSQL databases.

## Essential Commands

### Development

```bash
# Start development server (MySQL)
npm run dev

# Start development server (PostgreSQL)
npm run dev:postgresql

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# TypeScript type checking
npm run typecheck
```

### Testing

```bash
# Run all tests with MySQL (takes 4+ minutes)
npm run test

# Run all tests with PostgreSQL (takes 4+ minutes)
npm run test:postgresql

# Run single test file (faster iteration, ~12 seconds)
npm run test:local test/path/to/file.test.ts

# Generate coverage report
npm run cov
```

### Database Setup

```bash
# MySQL setup
docker compose -f docker-compose.yml up -d
CNPMCORE_DATABASE_NAME=cnpmcore bash ./prepare-database-mysql.sh

# PostgreSQL setup
docker compose -f docker-compose-postgres.yml up -d
CNPMCORE_DATABASE_NAME=cnpmcore bash ./prepare-database-postgresql.sh
```

### Build

```bash
# Clean build artifacts
npm run clean

# Development build
npm run tsc

# Production build
npm run tsc:prod
```

## Architecture - Domain-Driven Design (DDD)

The codebase follows strict DDD layering with clear separation of concerns:

```
Controller (app/port/controller/)     ← HTTP interface, validation, auth
    ↓ depends on
Service (app/core/service/)           ← Business logic orchestration
    ↓ depends on
Repository (app/repository/)          ← Data access layer
    ↓ depends on
Model (app/repository/model/)         ← ORM/Database mapping

Entity (app/core/entity/)             ← Pure domain models (no dependencies)
Common (app/common/)                  ← Utilities and adapters (all layers)
```

### Layer Responsibilities

**Controller Layer** (`app/port/controller/`):

- Handle HTTP requests/responses
- Validate inputs using `@eggjs/typebox-validate`
- Authenticate users and verify authorization
- Delegate business logic to Services
- All controllers extend `AbstractController`

**Service Layer** (`app/core/service/`):

- Implement core business logic
- Orchestrate multiple repositories
- Publish domain events
- Manage transactions

**Repository Layer** (`app/repository/`):

- CRUD operations on Models
- Data access and persistence
- Query building and optimization
- Methods named: `findX`, `saveX`, `removeX`, `listXs`

**Entity Layer** (`app/core/entity/`):

- Pure domain models with business behavior
- No infrastructure dependencies
- Immutable data structures preferred

**Model Layer** (`app/repository/model/`):

- ORM definitions using Leoric
- Database schema mapping
- No business logic

### Infrastructure Adapters (`app/infra/`)

Enterprise customization layer for PaaS integration:

- **NFSClientAdapter**: File storage (local/S3/OSS)
- **QueueAdapter**: Message queue integration
- **AuthAdapter**: Authentication system
- **BinaryAdapter**: Binary package storage

## Key Development Patterns

### Request Validation Trilogy

Always validate requests in this exact order:

1. **Parameter Validation** - Use `@eggjs/typebox-validate` for type-safe validation
2. **Authentication** - Get authorized user with token role verification
3. **Authorization** - Check resource-level permissions to prevent privilege escalation

```typescript
// Example controller method
async someMethod(@HTTPQuery() params: QueryType) {
  // 1. Params already validated by @HTTPQuery with typebox
  // 2. Authenticate
  const user = await this.userRoleManager.requiredAuthorizedUser(this.ctx, 'publish');
  // 3. Authorize (if needed)
  const { pkg } = await this.ensurePublishAccess(this.ctx, fullname);
  // 4. Execute business logic
  return await this.service.doSomething(params);
}
```

### Repository Method Naming

- `findSomething` - Query single entity
- `saveSomething` - Create or update entity
- `removeSomething` - Delete entity
- `listSomethings` - Query multiple entities (plural)

### Modifying Database Models

When changing a Model, update all 3 locations:

1. SQL migrations: `sql/mysql/*.sql` AND `sql/postgresql/*.sql`
2. ORM Model: `app/repository/model/*.ts`
3. Domain Entity: `app/core/entity/*.ts`

## Code Style

### Linting

- **Linter**: Oxlint (Rust-based, very fast)
- **Formatter**: Oxfmt
- **Pre-commit**: Husky + lint-staged (auto-format on commit)

Style rules:

- Single quotes (`'`)
- 2-space indentation
- 120 character line width
- ES5 trailing commas
- Max 6 function parameters
- No console statements (use logger)

### TypeScript

- Strict TypeScript enabled
- Avoid `any` types - use proper typing or `unknown`
- ES modules (`import/export`) throughout
- Comprehensive type definitions in all files

### Testing

- Test files use `.test.ts` suffix
- Tests mirror source structure in `test/` directory
- Use `@eggjs/mock` for mocking
- Use `assert` from `node:assert/strict`
- Test both success and error cases

Pattern:

```typescript
describe('test/path/to/SourceFile.test.ts', () => {
  describe('[HTTP_METHOD /api/path] functionName()', () => {
    it('should handle expected behavior', async () => {
      // Test implementation
    });
  });
});
```

## Project Structure

```
app/
├── common/          # Global utilities and adapters
│   ├── adapter/     # External service adapters
│   └── enum/        # Shared enumerations
├── core/            # Business logic layer
│   ├── entity/      # Domain models
│   ├── event/       # Event handlers
│   ├── service/     # Business services
│   └── util/        # Internal utilities
├── port/            # Interface layer
│   ├── controller/  # HTTP controllers
│   ├── middleware/  # Middleware
│   └── schedule/    # Background jobs
├── repository/      # Data access layer
│   └── model/       # ORM models
└── infra/           # Infrastructure adapters

config/              # Configuration files
sql/                 # Database migrations
  ├── mysql/         # MySQL migrations
  └── postgresql/    # PostgreSQL migrations
test/                # Test files (mirrors app/ structure)
```

## Important Configuration

- `config/config.default.ts` - Main application configuration
- `config/database.ts` - Database connection settings
- `config/binaries.ts` - Binary package mirror configurations
- `.env` - Environment-specific variables (copy from `.env.example`)
- `tsconfig.json` - TypeScript settings (target: ES2021 for Leoric compatibility)

## Development Workflow

1. **Setup**: Copy `.env.example` to `.env`, start Docker services, initialize database
2. **Feature Development**: Follow bottom-up approach (Model → Entity → Repository → Service → Controller)
3. **Testing**: Write tests at appropriate layer, run individual tests for fast iteration
4. **Validation**: Run linter, typecheck, relevant tests before committing
5. **Commit**: Use semantic commit messages (feat/fix/docs/test/chore)

## Integration as NPM Package

cnpmcore can be integrated into Egg.js/Tegg applications as an NPM package, allowing enterprises to:

- Customize infrastructure adapters (storage, auth, queue)
- Override default behavior while receiving updates
- Integrate with existing enterprise systems

See INTEGRATE.md for detailed integration guide.

## Performance Notes

Typical command execution times:

- Development server startup: ~20 seconds
- TypeScript build: ~6 seconds
- Full test suite: 4-15 minutes
- Single test file: ~12 seconds
- Linting: <1 second
- Database initialization: <2 seconds

## Prerequisites

- Node.js: 20.18.0+ or 22.18.0+
- Database: MySQL 5.7+ or PostgreSQL 17+
- Cache: Redis 6+
- Optional: Elasticsearch 8.x

## Key Services & Controllers

Core components to understand:

- **PackageController**: Package CRUD operations
- **PackageManagerService**: Core package management logic
- **BinarySyncerService**: Binary package synchronization
- **ChangesStreamService**: NPM registry change stream processing
- **UserController**: User authentication and profiles
