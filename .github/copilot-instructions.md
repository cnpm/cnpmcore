# cnpmcore - Private NPM Registry for Enterprise

cnpmcore is a TypeScript-based private NPM registry implementation built with Egg.js framework. It provides enterprise-grade package management with support for MySQL/PostgreSQL databases, Redis caching, and optional Elasticsearch.

**ALWAYS reference these instructions first** and fallback to search or bash commands only when you encounter unexpected information that does not match the information here.

## Code Style and Conventions

### Linting and Formatting

- **Linter**: Oxlint (fast Rust-based linter) with type-aware checking
- **Formatter**: Oxfmt (sole formatter, no Prettier)
- **Pre-commit hooks**: Husky + lint-staged runs both `oxfmt` and `oxlint --fix`

**Code Style Rules:**

```javascript
// From .oxfmt.json
{
  "singleQuote": true,        // Use single quotes
  "trailingComma": "es5",     // ES5 trailing commas
  "tabWidth": 2,              // 2-space indentation
  "printWidth": 120,          // 120 character line width
  "arrowParens": "avoid"      // Avoid parens when possible
}

// From .oxlintrc.json
{
  "max-params": 6,            // Maximum 6 function parameters
  "no-console": "warn",       // Warn on console usage
  "import/no-anonymous-default-export": "error"
}
```

**Linting Commands:**

```bash
npm run lint         # Check for linting errors
npm run lint:fix     # Auto-fix linting issues
npm run typecheck    # TypeScript type checking without build
```

### TypeScript Conventions

- Use strict TypeScript with comprehensive type definitions
- Avoid `any` types - use proper typing or `unknown`
- Export types and interfaces for reusability
- Use ES modules (`import/export`) syntax throughout

### Testing Conventions

- Test files use `.test.ts` suffix
- Use `@eggjs/mock` for mocking and testing
- Tests organized to mirror source structure in `test/` directory
- Use `assert` from `node:assert/strict` for assertions
- Mock external dependencies using `mock()` from `@eggjs/mock`

**Test Infrastructure**:

- `test/.setup.ts` - Global beforeEach/afterEach hooks
- `test/TestUtil.ts` - Comprehensive test utilities
- `test/fixtures/` - Mock data and responses

**Key TestUtil Methods**:

- `TestUtil.createUser(options)` - Create test user with auth tokens
- `TestUtil.createPackage(options)` - Create full package in system
- `TestUtil.getFullPackage(options)` - Get mock package JSON
- `TestUtil.truncateDatabase()` - Clear all tables between tests
- `TestUtil.query(sql)` - Execute raw SQL (MySQL/PostgreSQL)

**Mocking Patterns**:

```typescript
// Config mocking
mock(app.config.cnpmcore, 'propertyName', newValue);

// HTTP mocking
app.mockHttpclient('https://example.com/path', 'GET', {
  data: await TestUtil.readFixturesFile('fixture.json'),
  persist: false,
});

// Log assertions
app.mockLog();
await someOperation();
app.expectLog(/pattern/);
```

**Getting DI Objects in Tests**:

```typescript
const service = await app.getEggObject(PackageManagerService);
```

**Scheduled Task Testing**:

```typescript
await app.runSchedule(SyncPackageWorkerPath);
```

**Test Naming Pattern:**

```typescript
describe('test/path/to/SourceFile.test.ts', () => {
  describe('[HTTP_METHOD /api/path] functionName()', () => {
    it('should handle expected behavior', async () => {
      // Test implementation
    });
  });
});
```

## Domain-Driven Design (DDD) Architecture

cnpmcore follows **Domain-Driven Design** principles with clear separation of concerns:

### Layer Architecture (Dependency Flow)

```
Controller (HTTP Interface Layer)
    ↓ depends on
Service (Business Logic Layer)
    ↓ depends on
Repository (Data Access Layer)
    ↓ depends on
Model (ORM/Database Layer)

Entity (Domain Models - no dependencies, pure business logic)
Common (Utilities and Adapters - available to all layers)
```

### Layer Responsibilities

**Controller Layer** (`app/port/controller/`):

- HTTP request/response handling
- Request validation using `@eggjs/typebox-validate`
- User authentication and authorization
- **NO business logic** - delegate to Services
- Inheritance: `YourController extends AbstractController extends MiddlewareController`
- Auto-applied middlewares: `AlwaysAuth`, `Tracing`, `ErrorHandler`

Key `AbstractController` methods:

- `ensurePublishAccess(ctx, fullname)` - Authorization check for package publish
- `getPackageEntity(scope, name)` - Fetch package with error handling
- `setCDNHeaders(ctx)` - Set cache control headers
- `getAllowSync(ctx)` - Check if sync should be triggered

**Service Layer** (`app/core/service/`):

- Core business logic implementation
- Orchestration of multiple repositories and entities
- Transaction management
- Publish domain events via `EventBus`
- Use `@SingletonProto({ accessLevel: AccessLevel.PUBLIC })` scope
- Define command interfaces (e.g., `PublishPackageCmd`) for complex operations
- NO HTTP concerns, NO direct database access

**Repository Layer** (`app/repository/`):

- Data access and persistence
- CRUD operations on Models
- Query building and optimization
- NO business logic

**Entity Layer** (`app/core/entity/`):

- Domain models with business behavior
- Pure business logic (no infrastructure dependencies)
- Factory pattern: `static create(data)` method on each entity
- Use `EntityUtil.defaultData(data, 'idField')` for ID/timestamp defaults
- Type guards for union types (e.g., `isGranularToken()`)
- `EasyData<T, Id>` type helper for optional create-time fields

**Model Layer** (`app/repository/model/`):

- ORM definitions using Leoric
- Database schema mapping
- Table and column definitions
- NO business logic

**Model-Entity Bridge** (`app/repository/util/`):

- `ModelConvertor.convertEntityToModel(entity, ModelClass)` - Persist entity
- `ModelConvertor.convertModelToEntity(model, EntityClass)` - Load entity
- Uses `@EntityProperty()` decorator for complex nested property mapping
- `ModelMetadataUtil` for reflection-based property discovery

### Key Decorators & Annotations

**HTTP Layer** (from `@eggjs/tegg`):

- `@HTTPController()` - Marks class as HTTP controller
- `@HTTPMethod({ path, method })` - Route definition
- `@HTTPBody()` / `@HTTPQuery()` / `@HTTPParam()` - Request data injection with typebox validation
- `@HTTPContext() ctx: Context` - Inject Egg.js context
- `@Middleware(MiddlewareClass)` - Apply middleware to controller

**Dependency Injection**:

- `@Inject()` - Field-level dependency injection
- `@SingletonProto({ accessLevel: AccessLevel.PUBLIC })` - Singleton service scope
- `@ContextProto()` - Request-scoped service (e.g., `UserRoleManager`)

**ORM Layer** (from `leoric`):

- `@Model()` - Marks class as ORM model
- `@Attribute(DataTypes.TYPE, options)` - Column definition
- `@EntityProperty('nested.path')` - Maps model field to entity property

**Lifecycle**:

- `@LifecycleInit()` - Post-construction initialization hook

### Repository Method Naming Convention

**ALWAYS follow these naming patterns:**

- `findSomething` - Query a single model/entity
- `saveSomething` - Save (create or update) a model
- `removeSomething` - Delete a model
- `listSomethings` - Query multiple models (use plural)

### Request Validation Trilogy

**ALWAYS validate requests in this exact order:**

1. **Request Parameter Validation** - First line of defense

   ```typescript
   // Use @eggjs/typebox-validate for type-safe validation
   // See app/port/typebox.ts for examples
   ```

2. **User Authentication & Token Permissions**

   ```typescript
   // Token roles: 'read' | 'publish' | 'setting'
   const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'publish');
   ```

3. **Resource Authorization** - Prevent horizontal privilege escalation
   ```typescript
   // Example: Ensure user is package maintainer
   await this.userRoleManager.requiredPackageMaintainer(pkg, authorizedUser);
   // Or use convenience method
   const { pkg } = await this.ensurePublishAccess(ctx, fullname);
   ```

### Modifying Database Models

When changing a Model, update **all 3 locations**:

1. SQL migration files: `sql/mysql/*.sql` AND `sql/postgresql/*.sql`
2. ORM Model: `app/repository/model/*.ts`
3. Domain Entity: `app/core/entity/*.ts`

**NEVER auto-generate SQL migrations** - manual review is required for safety.

## Prerequisites and Environment Setup

- **Node.js**: ^20.18.0 or ^22.18.0 or ^24.11.0
- **Database**: MySQL 5.7+ or PostgreSQL 17+ (SQLite support in progress)
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

**Testing Philosophy:**

- **Write tests for all new features** - No feature is complete without tests
- **Test at the right layer** - Controller tests for HTTP, Service tests for business logic
- **Mock external dependencies** - Use `mock()` from `@eggjs/mock`
- **Use realistic test data** - Create through `TestUtil` helper methods
- **Clean up after tests** - Database is reset between test files
- **Test both success and failure cases** - Error paths are equally important

**Common Test Patterns:**

```typescript
import { app, mock } from '@eggjs/mock/bootstrap';
import { TestUtil } from '../../../test/TestUtil';

describe('test/path/to/YourController.test.ts', () => {
  describe('[GET /api/endpoint] methodName()', () => {
    it('should return expected result', async () => {
      // Setup
      const { authorization } = await TestUtil.createUser();

      // Execute
      const res = await app.httpRequest().get('/api/endpoint').set('authorization', authorization).expect(200);

      // Assert
      assert.equal(res.body.someField, expectedValue);
    });

    it('should handle unauthorized access', async () => {
      const res = await app.httpRequest().get('/api/endpoint').expect(401);

      assert.equal(res.body.error, '[UNAUTHORIZED] Login first');
    });
  });
});
```

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

### Infrastructure Adapters (`app/infra/`)

Enterprise customization layer for PaaS integration. cnpmcore provides default implementations, but enterprises should implement their own based on their infrastructure:

- **NFSClientAdapter**: File storage abstraction (local/S3/OSS)
- **QueueAdapter**: Message queue integration
- **AuthAdapter**: Authentication system integration
- **BinaryAdapter**: Binary package storage adapter
- **SearchAdapter**: Elasticsearch integration
- **CacheAdapter**: Redis caching with distributed locking

These adapters allow cnpmcore to integrate with different cloud providers and enterprise systems without modifying core business logic.

Use `@LifecycleInit()` decorator for adapter initialization hooks.

### Configuration Files

- `config/config.default.ts`: Main application configuration
- `config/database.ts`: Database connection settings
- `config/binaries.ts`: Binary package mirror configurations
- `.env`: Environment-specific variables
- `tsconfig.json`: TypeScript compilation settings
- `tsconfig.prod.json`: Production build settings

## Common Development Tasks

### Adding New Features

**ALWAYS follow this workflow:**

1. **Plan the change** - Identify which layers need modification
2. **Run linter** - `npm run lint:fix` to establish clean baseline
3. **Bottom-up implementation** - Build from data layer up to controller:

   a. **Model Layer** (if new data structure needed):
   - Add SQL migrations: `sql/mysql/*.sql` AND `sql/postgresql/*.sql`
   - Create Model: `app/repository/model/YourModel.ts`
   - Run database migration scripts

   b. **Entity Layer** (domain models):
   - Create Entity: `app/core/entity/YourEntity.ts`
   - Implement business logic and behavior
   - Keep entities pure (no infrastructure dependencies)

   c. **Repository Layer** (data access):
   - Create Repository: `app/repository/YourRepository.ts`
   - Follow naming: `findX`, `saveX`, `removeX`, `listXs`
   - Inject dependencies using `@Inject()`

   d. **Service Layer** (business logic):
   - Create Service: `app/core/service/YourService.ts`
   - Orchestrate repositories and entities
   - Use `@SingletonProto()` for service lifecycle

   e. **Controller Layer** (HTTP endpoints):
   - Create Controller: `app/port/controller/YourController.ts`
   - Extend `AbstractController`
   - Add HTTP method decorators: `@HTTPMethod()`, `@HTTPBody()`, etc.
   - Implement 3-step validation (params → auth → authorization)

4. **Add tests** - Create test file: `test/path/matching/source/YourFile.test.ts`
5. **Lint and test** - `npm run lint:fix && npm run test:local test/your/test.test.ts`
6. **Type check** - `npm run typecheck`
7. **Commit** - Use semantic commit messages (feat/fix/chore/docs/test)

**Example Controller Implementation:**

```typescript
import { AbstractController } from './AbstractController';
import { HTTPController, HTTPMethod, HTTPQuery, Inject } from 'egg';

@HTTPController()
export class YourController extends AbstractController {
  @Inject()
  private readonly yourService: YourService;

  @HTTPMethod({ path: '/api/path', method: 'GET' })
  async yourMethod(@HTTPQuery() params: YourQueryType) {
    // 1. Validate params (done by @HTTPQuery with typebox)
    // 2. Authenticate user
    const user = await this.userRoleManager.requiredAuthorizedUser(this.ctx, 'read');
    // 3. Authorize resource access (if needed)
    // 4. Delegate to service
    return await this.yourService.doSomething(params);
  }
}
```

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

Command execution times (for timeout planning):

- **Startup Time**: ~20 seconds for development server
- **Build Time**: ~6 seconds for TypeScript compilation
- **Test Time**: 4-15 minutes for full suite (database dependent)
- **Individual Test**: ~12 seconds for single test file
- **Package Installation**: ~2 minutes for npm install
- **Database Init**: <2 seconds for either MySQL or PostgreSQL
- **Linting**: <1 second (oxlint is very fast)

Always account for these timings when setting timeouts for automated processes.

## Semantic Commit Messages

Use conventional commit format for all commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring
- `perf:` - Performance improvements

Examples:

```bash
feat: add support for GitHub binary mirroring
fix: resolve authentication token expiration issue
docs: update API documentation for sync endpoints
test: add tests for package publication workflow
```
