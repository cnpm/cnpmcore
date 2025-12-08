====================================================================================================
Performance Hotspots (filtered by: leoric)
====================================================================================================

Total Active CPU Time: 42437 samples


--- Hotspot #1 ---
Function: Bone
Self Time: 3017 samples (7.11%)
Location: leoric@2.13.9@leoric/lib/bone.js:150
Call Stack (bottom-up):
  1. ContextModelClass [@eggjs_orm-plugin@4.0.0-beta.34@@eggjs/orm-plugin:17]
  2. instantiate [leoric@2.13.9@leoric:1282]
  3. dispatch [leoric@2.13.9@leoric:81]
  4. init [leoric@2.13.9@leoric:13]
  5. ignite [leoric@2.13.9@leoric:441]

--- Hotspot #2 ---
Function: dispatch
Self Time: 564 samples (1.33%)
Location: leoric@2.13.9@leoric/lib/collection.js:81
Call Stack (bottom-up):
  1. init [leoric@2.13.9@leoric:13]
  2. ignite [leoric@2.13.9@leoric:441]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #3 ---
Function: instantiate
Self Time: 381 samples (0.90%)
Location: leoric@2.13.9@leoric/lib/bone.js:1282
Call Stack (bottom-up):
  1. dispatch [leoric@2.13.9@leoric:81]
  2. init [leoric@2.13.9@leoric:13]
  3. ignite [leoric@2.13.9@leoric:441]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #4 ---
Function: _setRaw
Self Time: 215 samples (0.51%)
Location: leoric@2.13.9@leoric/lib/bone.js:300
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #5 ---
Function: _setRawSaved
Self Time: 173 samples (0.41%)
Location: leoric@2.13.9@leoric/lib/bone.js:314
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #6 ---
Function: query
Self Time: 138 samples (0.33%)
Location: leoric@2.13.9@leoric/lib/drivers/mysql/index.js:70
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #7 ---
Function: (anonymous)
Self Time: 134 samples (0.32%)
Location: leoric@2.13.9@leoric/lib/collection.js:98
Call Stack (bottom-up):
  1. dispatch [leoric@2.13.9@leoric:81]
  2. init [leoric@2.13.9@leoric:13]
  3. ignite [leoric@2.13.9@leoric:441]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #8 ---
Function: ignite
Self Time: 114 samples (0.27%)
Location: leoric@2.13.9@leoric/lib/spell.js:441
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #9 ---
Function: isLogicalCondition
Self Time: 112 samples (0.26%)
Location: leoric@2.13.9@leoric/lib/query_object.js:102
Call Stack (bottom-up):
  1. parseObject [leoric@2.13.9@leoric:178]
  2. parseConditions [leoric@2.13.9@leoric:45]
  3. $where [leoric@2.13.9@leoric:589]
  4. _find [leoric@2.13.9@leoric:1341]
  5. findOne [leoric@2.13.9@leoric:1377]

--- Hotspot #10 ---
Function: attribute
Self Time: 101 samples (0.24%)
Location: leoric@2.13.9@leoric/lib/bone.js:198
Call Stack (bottom-up):
  1. get [leoric@2.13.9@leoric:1167]
  2. convertModelToEntity [util/ModelConvertor.js:74]
  3. (anonymous) [repository/BinaryRepository.js:47]
  4. listBinaries [repository/BinaryRepository.js:33]
  5. runMicrotasks [(native)]

--- Hotspot #11 ---
Function: cloneValue
Self Time: 79 samples (0.19%)
Location: leoric@2.13.9@leoric/lib/bone.js:112
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #12 ---
Function: get
Self Time: 67 samples (0.16%)
Location: leoric@2.13.9@leoric/lib/bone.js:1167
Call Stack (bottom-up):
  1. convertModelToEntity [util/ModelConvertor.js:74]
  2. (anonymous) [repository/BinaryRepository.js:47]
  3. listBinaries [repository/BinaryRepository.js:33]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #13 ---
Function: isLogicalCondition
Self Time: 60 samples (0.14%)
Location: leoric@2.13.9@leoric/lib/query_object.js:102
Call Stack (bottom-up):
  1. parseObject [leoric@2.13.9@leoric:178]
  2. parseConditions [leoric@2.13.9@leoric:45]
  3. $where [leoric@2.13.9@leoric:589]
  4. _find [leoric@2.13.9@leoric:1341]
  5. findOne [leoric@2.13.9@leoric:1377]

--- Hotspot #14 ---
Function: Spell
Self Time: 50 samples (0.12%)
Location: leoric@2.13.9@leoric/lib/spell.js:325
Call Stack (bottom-up):
  1. _find [leoric@2.13.9@leoric:1341]
  2. findOne [leoric@2.13.9@leoric:1377]
  3. plus [repository/PackageVersionDownloadRepository.js:13]
  4. savePackageVersionCounters [service/PackageManagerService.js:428]
  5. runMicrotasks [(native)]

--- Hotspot #15 ---
Function: token
Self Time: 48 samples (0.11%)
Location: leoric@2.13.9@leoric/lib/expr.js:266
Call Stack (bottom-up):
  1. expr [leoric@2.13.9@leoric:368]
  2. parseExprList [leoric@2.13.9@leoric:137]
  3. parseExpr [leoric@2.13.9@leoric:442]
  4. Spell [leoric@2.13.9@leoric:325]
  5. _find [leoric@2.13.9@leoric:1341]

--- Hotspot #16 ---
Function: formatSelectWithoutJoin
Self Time: 47 samples (0.11%)
Location: leoric@2.13.9@leoric/lib/drivers/abstract/spellbook.js:184
Call Stack (bottom-up):
  1. formatSelect [leoric@2.13.9@leoric:418]
  2. format [leoric@2.13.9@leoric:61]
  3. format [leoric@2.13.9@leoric:60]
  4. cast [leoric@2.13.9@leoric:31]
  5. ignite [leoric@2.13.9@leoric:441]

--- Hotspot #17 ---
Function: Spell
Self Time: 41 samples (0.10%)
Location: leoric@2.13.9@leoric/lib/spell.js:325
Call Stack (bottom-up):
  1. _find [leoric@2.13.9@leoric:1341]
  2. findOne [leoric@2.13.9@leoric:1377]
  3. findPackageId [repository/PackageRepository.js:41]
  4. savePackageVersionCounters [service/PackageManagerService.js:428]
  5. runMicrotasks [(native)]

--- Hotspot #18 ---
Function: Spell
Self Time: 41 samples (0.10%)
Location: leoric@2.13.9@leoric/lib/spell.js:325
Call Stack (bottom-up):
  1. _find [leoric@2.13.9@leoric:1341]
  2. value [leoric@2.13.9@leoric:1719]
  3. plus [repository/PackageVersionDownloadRepository.js:13]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #19 ---
Function: token
Self Time: 39 samples (0.09%)
Location: leoric@2.13.9@leoric/lib/expr.js:266
Call Stack (bottom-up):
  1. expr [leoric@2.13.9@leoric:368]
  2. parseExprList [leoric@2.13.9@leoric:137]
  3. parseExpr [leoric@2.13.9@leoric:442]
  4. Spell [leoric@2.13.9@leoric:325]
  5. _find [leoric@2.13.9@leoric:1341]

--- Hotspot #20 ---
Function: formatUpdate
Self Time: 36 samples (0.08%)
Location: leoric@2.13.9@leoric/lib/drivers/abstract/spellbook.js:326
Call Stack (bottom-up):
  1. formatUpdate [leoric@2.13.9@leoric:59]
  2. format [leoric@2.13.9@leoric:61]
  3. format [leoric@2.13.9@leoric:60]
  4. cast [leoric@2.13.9@leoric:31]
  5. ignite [leoric@2.13.9@leoric:441]

--- Hotspot #21 ---
Function: cast
Self Time: 36 samples (0.08%)
Location: leoric@2.13.9@leoric/lib/drivers/abstract/attribute.js:153
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #22 ---
Function: $increment
Self Time: 36 samples (0.08%)
Location: leoric@2.13.9@leoric/lib/spell.js:531
Call Stack (bottom-up):
  1. Spell_dup [leoric@2.13.9@leoric:963]
  2. plus [repository/PackageVersionDownloadRepository.js:13]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #23 ---
Function: token
Self Time: 35 samples (0.08%)
Location: leoric@2.13.9@leoric/lib/expr.js:266
Call Stack (bottom-up):
  1. expr [leoric@2.13.9@leoric:368]
  2. parseExprList [leoric@2.13.9@leoric:137]
  3. parseExpr [leoric@2.13.9@leoric:442]
  4. parseObject [leoric@2.13.9@leoric:178]
  5. parseConditions [leoric@2.13.9@leoric:45]

--- Hotspot #24 ---
Function: checkCond
Self Time: 29 samples (0.07%)
Location: leoric@2.13.9@leoric/lib/spell.js:21
Call Stack (bottom-up):
  1. checkCond [leoric@2.13.9@leoric:21]
  2. parseConditions [leoric@2.13.9@leoric:45]
  3. $where [leoric@2.13.9@leoric:589]
  4. _find [leoric@2.13.9@leoric:1341]
  5. findOne [leoric@2.13.9@leoric:1377]

--- Hotspot #25 ---
Function: cast
Self Time: 28 samples (0.07%)
Location: leoric@2.13.9@leoric/lib/data_types.js:293
Call Stack (bottom-up):
  1. cast [leoric@2.13.9@leoric:153]
  2. instantiate [leoric@2.13.9@leoric:1282]
  3. dispatch [leoric@2.13.9@leoric:81]
  4. init [leoric@2.13.9@leoric:13]
  5. ignite [leoric@2.13.9@leoric:441]

--- Hotspot #26 ---
Function: getConnection
Self Time: 26 samples (0.06%)
Location: leoric@2.13.9@leoric/lib/drivers/mysql/index.js:58
Call Stack (bottom-up):
  1. query [leoric@2.13.9@leoric:70]
  2. cast [leoric@2.13.9@leoric:31]
  3. ignite [leoric@2.13.9@leoric:441]
  4. then [leoric@2.13.9@leoric:458]
  5. runMicrotasks [(native)]

--- Hotspot #27 ---
Function: init
Self Time: 26 samples (0.06%)
Location: leoric@2.13.9@leoric/lib/collection.js:13
Call Stack (bottom-up):
  1. ignite [leoric@2.13.9@leoric:441]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #28 ---
Function: (anonymous)
Self Time: 26 samples (0.06%)
Location: leoric@2.13.9@leoric/lib/drivers/mysql/index.js:60
Call Stack (bottom-up):
  1. (anonymous) [mysql2@3.15.3@mysql2:43]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #29 ---
Function: Spell
Self Time: 25 samples (0.06%)
Location: leoric@2.13.9@leoric/lib/spell.js:325
Call Stack (bottom-up):
  1. get dup [leoric@2.13.9@leoric:402]
  2. Spell_dup [leoric@2.13.9@leoric:963]
  3. plus [repository/PackageVersionDownloadRepository.js:13]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #30 ---
Function: toObject
Self Time: 23 samples (0.05%)
Location: leoric@2.13.9@leoric/lib/bone.js:519
Call Stack (bottom-up):
  1. (anonymous) [leoric@2.13.9@leoric:35]
  2. toObject [leoric@2.13.9@leoric:34]
  3. query [repository/ChangeRepository.js:17]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

====================================================================================================
