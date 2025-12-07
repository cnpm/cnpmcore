Loading heapdump file...
Parsing JSON...
Parsing nodes...
Parsing edges...
Loaded 882434 nodes, 4312802 edges
# Heapdump Analysis Report

Generated: 2025-12-07T13:32:06.312Z

## Summary

| Metric | Value |
|--------|-------|
| File | registry.npmmirror.com-08-x-heapdump-1116215-20250709-0 |
| Node Count | 882,434 |
| Edge Count | 4,312,802 |
| Total Self Size | 136.68 MB |

## Memory by Object Type

| Type | Count | Self Size (MB) |
|------|-------|----------------|
| array | 79,607 | 50.56 |
| string | 148,839 | 30.26 |
| code | 215,679 | 28.21 |
| object | 205,818 | 10.74 |
| object shape | 75,747 | 6.53 |
| hidden | 44,821 | 3.05 |
| native | 10,713 | 2.92 |
| closure | 52,055 | 2.89 |
| concatenated string | 35,032 | 1.07 |
| sliced string | 8,626 | 0.26 |
| regexp | 1,969 | 0.11 |
| symbol | 1,439 | 0.03 |
| number | 2,022 | 0.03 |
| synthetic | 53 | 0.01 |
| bigint | 14 | 0.00 |

## cnpmcore-Specific Memory Patterns

| Category | Count | Size (MB) |
|----------|-------|----------|
| Bone instances | 182 | 0.01 |
| Package entities | 13,063 | 6.42 |
| HTTP contexts | 21,652 | 6.12 |
| Promises | 3,774 | 0.17 |
| Maps | 4,692 | 0.14 |
| Sets | 223 | 0.01 |
| Buffers | 2,800 | 4.93 |
| Closures | 52,055 | 2.89 |

## Top 30 Constructors by Memory

| # | Constructor | Count | Self Size (MB) | Avg Size |
|---|-------------|-------|----------------|----------|
| 1 | (anonymous) | 32,610 | 35.78 | 1151 |
| 2 | (object elements) | 38,658 | 9.16 | 249 |
| 3 | (object properties) | 17,637 | 6.17 | 367 |
| 4 | Mapping | 65,298 | 4.48 | 72 |
| 5 | Object | 52,574 | 2.13 | 43 |
| 6 | Array | 44,866 | 1.37 | 32 |
| 7 | system / Context | 13,084 | 0.73 | 58 |
| 8 | native_bind | 8,684 | 0.40 | 48 |
| 9 | Module | 2,493 | 0.29 | 123 |
| 10 | get | 4,739 | 0.27 | 60 |
| 11 | Generator | 3,014 | 0.26 | 92 |
| 12 | Promise | 3,771 | 0.17 | 48 |
| 13 | ModuleJob | 1,634 | 0.15 | 96 |
| 14 | Map | 4,689 | 0.14 | 32 |
| 15 | TstNode | 1,880 | 0.11 | 64 |
| 16 | ModuleWrap | 1,635 | 0.11 | 72 |
| 17 | SemVer | 922 | 0.09 | 104 |
| 18 | _TstNode | 940 | 0.06 | 64 |
| 19 | Comparator | 925 | 0.06 | 64 |
| 20 | <instance_members_initializer> | 663 | 0.04 | 56 |
| 21 | set | 514 | 0.03 | 57 |
| 22 | MysqlAttribute | 240 | 0.03 | 120 |
| 23 | BuiltinModule | 336 | 0.03 | 80 |
| 24 | EggCompatibleProtoImpl | 279 | 0.02 | 88 |
| 25 | ClassProtoDescriptor | 157 | 0.02 | 143 |
| 26 | toString | 388 | 0.02 | 56 |
| 27 | func | 317 | 0.02 | 64 |
| 28 | validate | 355 | 0.02 | 56 |
| 29 | NodeError | 301 | 0.02 | 64 |
| 30 | AttributeMeta | 240 | 0.02 | 80 |

## String Memory Analysis

- **Total Strings**: 192,497
- **Total Size**: 31.60 MB

| Length Bucket | Count | Size (MB) |
|---------------|-------|----------|
| <100 | 187,344 | 8.35 |
| 100-1K | 3,188 | 2.37 |
| 1K-10K | 1,751 | 9.91 |
| 10K-100K | 208 | 9.11 |
| >100K | 6 | 1.86 |

## Array Memory Analysis

- **Total Arrays**: 79,607
- **Total Size**: 50.56 MB

### Top 10 Arrays by Size

| Name | Size (MB) | ID |
|------|-----------|----|
| (anonymous) | 8.00 | 1211245 |
| (anonymous) | 8.00 | 1211247 |
| (anonymous) | 8.00 | 1211249 |
| (anonymous) | 8.00 | 1211251 |
| (object properties) | 0.38 | 1530521 |
| (object properties) | 0.38 | 1679319 |
| (anonymous) | 0.25 | 1663 |
| (anonymous) | 0.22 | 1141161 |
| (object properties) | 0.19 | 1172863 |
| (object elements) | 0.12 | 403113 |

## Potentially Leaked Objects (Detached)

| Type | Name | Size |
|------|------|------|
| native | Node / TLSWrap | 464 |
| native | Node / Http2State | 424 |
| native | Node / BindingData | 296 |
| native | Node / BindingData | 216 |
| native | Node / ChannelWrap | 144 |
| synthetic | Node / SecureContext | 136 |
| native | Node / ConnectionsList | 128 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |
| native | Node / ModuleWrap | 112 |

