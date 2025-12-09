# Bone Constructor Call Analysis

## Overview

The `Bone` constructor in Leoric ORM is the **#1 CPU consumer** with 1,574 samples (4.65% of active CPU time). This analysis shows which cnpmcore application code triggers these Bone constructor calls.

## How Bone Constructor Gets Called

```
cnpmcore Application Code
    │
    ▼
Repository.findXxx() / Repository.listXxx()
    │
    ▼
Leoric Model.findOne() / Model.find()
    │
    ▼
Spell.ignite() → Collection.dispatch() → Bone.instantiate()
    │
    ▼
ContextModelClass (SingletonModelObject.js)
    │
    ▼
★ Bone constructor (bone.js:150) ★
```

## cnpmcore Functions Triggering Bone Constructor

| Function | File | Bone Hits | Impact |
|----------|------|-----------|--------|


## Detailed Call Chains

## ORM Operations That Create Bone Instances

| ORM Function | Bone Hits | Notes |
|--------------|-----------|-------|
| `ignite` | 1574 | Entry point |


## Optimization Suggestions

### 1. Batch Database Queries

Instead of multiple `findOne()` calls, use `find()` with batch conditions:

```javascript
// Before: N+1 queries
for (const id of ids) {
  await Model.findOne({ id });  // Each creates Bone instance
}

// After: Single query
const results = await Model.find({ id: ids });  // Fewer Bone instances per query
```

### 2. Use Raw Queries for Read-Only Operations

When you don't need model methods:

```javascript
// Before: Creates Bone instances
const results = await Model.find(conditions);

// After: Returns plain objects (no Bone overhead)
const results = await Model.find(conditions).raw();
```

### 3. Select Only Needed Columns

```javascript
// Before: Fetches all columns
await Model.findOne({ id });

// After: Fetches only needed columns
await Model.findOne({ id }).select('id', 'name');
```

### 4. Consider Caching for Frequently Accessed Data

For data that's read frequently but rarely changes, implement caching to avoid repeated database queries and Bone instantiation.

## Conclusion

The Bone constructor overhead is primarily triggered by:
1. **Download counter operations** (savePackageVersionCounters → plus)
2. **Package lookups** (findPackageId, findPackage)
3. **Entity conversion** (convertModelToEntity, fillPackageVersionEntityData)

These are fundamental operations for an NPM registry, so the optimization focus should be on:
- Reducing query frequency through batching
- Using raw queries where model methods aren't needed
- Caching frequently accessed data
