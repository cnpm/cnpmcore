# Application → Leoric Bone Call Relationship Diagram

## Summary

The Leoric `Bone` constructor (15.38% of CPU) is called through these application layer entry points:

| Rank | Application Entry Point          | Hits | File                           |
| ---- | -------------------------------- | ---- | ------------------------------ |
| 1    | `convertEntityToModel`           | 141  | ModelConvertor.js:8            |
| 2    | `saveEntityToModel`              | 24   | ModelConvertor.js:50           |
| 3    | `syncPackage`                    | 9    | PackageSearchService.js:16     |
| 4    | `(anonymous)` in findAllVersions | 8    | PackageVersionRepository.js:57 |
| 5    | `convertModelToEntity`           | 7    | ModelConvertor.js:74           |
| 6    | `findBinary`                     | 4    | BinaryRepository.js:27         |

**Note**: 1,743 hits (most of the Bone calls) come from paths without direct application code - triggered by async operations and internal leoric queries.

## Call Flow Diagram

```mermaid
flowchart TD
    subgraph App["Application Layer (2.18% CPU)"]
        A1["convertEntityToModel<br/>ModelConvertor.js:8<br/>141 hits"]
        A2["saveEntityToModel<br/>ModelConvertor.js:50<br/>24 hits"]
        A3["syncPackage<br/>PackageSearchService.js<br/>9 hits"]
        A4["convertModelToEntity<br/>ModelConvertor.js:74<br/>7 hits"]
        A5["findBinary<br/>BinaryRepository.js<br/>4 hits"]
    end

    subgraph Repo["Repository Layer"]
        R1["BinaryRepository.saveBinary"]
        R2["TaskRepository.saveTask"]
        R3["PackageVersionRepository.findAllVersions"]
        R4["BinaryRepository.listBinaries"]
    end

    subgraph Leoric["Leoric ORM (24% CPU)"]
        L1["Bone.create()"]
        L2["Bone.save()"]
        L3["Bone.findOne()"]
        L4["Bone.find()"]
        L5["instantiate()"]
        L6["dispatch()"]
        BONE["🔥 Bone Constructor<br/>bone.js:150<br/>1553 hits (15.38%)"]
    end

    A1 --> R1
    R1 --> L1
    L1 --> BONE

    A2 --> R2
    R2 --> L2
    L2 --> BONE

    A3 --> L3
    L3 --> L5
    L5 --> L6
    L6 --> BONE

    A4 --> R4
    R4 --> L4
    L4 --> L5

    A5 --> L3

    style BONE fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px,color:#fff
    style App fill:#d3f9d8,stroke:#2b8a3e
    style Leoric fill:#ffe3e3,stroke:#c92a2a
```

## Detailed Call Paths

### Path 1: Entity Creation (141 hits - Highest)

```
BinarySyncerService.saveBinaryItem()
    └── BinaryRepository.saveBinary()
        └── ModelConvertor.convertEntityToModel()
            └── Bone.create()
                └── ContextModelClass()
                    └── 🔥 Bone() constructor [132 hits]
```

**This is the hottest path.** Every time a new entity is saved to the database, the `Bone` constructor is called.

### Path 2: Entity Update (24 hits)

```
ChangesStreamService / TaskService
    └── TaskRepository.saveTask()
        └── ModelConvertor.saveEntityToModel()
            └── Bone.save()
                └── Bone._save()
                    └── Bone.update()
                        └── Bone._update() [7 hits]
                    └── Bone.changes()
                        └── deep-equal checks [expensive]
```

### Path 3: Database Query Results (1553+ hits - Main Hotspot)

```
Any Repository.find*() method
    └── Leoric Spell.then()
        └── ignite()
            └── dispatch()
                └── instantiate()
                    └── ContextModelClass()
                        └── 🔥 Bone() constructor [1553 hits]
```

**This is where most CPU time is spent.** Every row returned from the database triggers a `Bone` constructor call to instantiate the ORM model.

## Root Cause Analysis

The `Bone` constructor is expensive because it:

1. **Initializes all attribute accessors** - Creates getters/setters for each column
2. **Sets up change tracking** - Prepares for dirty checking
3. **Validates attributes** - Runs type checking on initialization
4. **Uses deep-equal** - Expensive comparison for change detection

## Optimization Recommendations

### 1. Batch Operations

When inserting many records, use bulk insert instead of individual creates:

```typescript
// Instead of:
for (const entity of entities) {
  await Model.create(entity); // Each calls Bone constructor
}

// Use:
await Model.bulkCreate(entities); // Single operation
```

### 2. Raw Queries for Read-Heavy Operations

For read operations that don't need full ORM features:

```typescript
// Instead of:
const records = await Model.find({ where: {...} });  // Creates Bone instances

// Consider:
const records = await Model.query('SELECT * FROM ...', { raw: true });  // Plain objects
```

### 3. Select Only Needed Columns

```typescript
// Instead of:
await Model.findOne({ where: {...} });  // Loads all columns

// Use:
await Model.findOne({ where: {...}, select: ['id', 'name'] });  // Fewer attributes to initialize
```

### 4. Consider Leoric Configuration

Check if leoric has options to:

- Disable change tracking for read-only queries
- Use lazy attribute initialization
- Skip validation on trusted data

## Files to Review

1. `app/repository/util/ModelConvertor.ts` - Main entity/model conversion
2. `app/repository/BinaryRepository.ts` - Heavy on creates
3. `app/core/service/BinarySyncerService.ts` - Triggers many entity creations
4. Any repository with high query volume
