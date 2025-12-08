====================================================================================================
Performance Hotspots (filtered by: application)
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
Function: match
Self Time: 595 samples (1.40%)
Location: @eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Layer.js:72
Call Stack (bottom-up):
  1. match [@eggjs_router@4.0.0-beta.34@@eggjs/router:424]
  2. dispatch [@eggjs_router@4.0.0-beta.34@@eggjs/router:122]
  3. dispatch [koa-compose@4.1.0@koa-compose:35]
  4. ctxLifecycleMiddleware [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:3]
  5. runMicrotasks [(native)]

--- Hotspot #3 ---
Function: dispatch
Self Time: 564 samples (1.33%)
Location: leoric@2.13.9@leoric/lib/collection.js:81
Call Stack (bottom-up):
  1. init [leoric@2.13.9@leoric:13]
  2. ignite [leoric@2.13.9@leoric:441]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #4 ---
Function: (anonymous)
Self Time: 477 samples (1.12%)
Location: @eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Router.js:137
Call Stack (bottom-up):
  1. dispatch [@eggjs_router@4.0.0-beta.34@@eggjs/router:122]
  2. dispatch [koa-compose@4.1.0@koa-compose:35]
  3. ctxLifecycleMiddleware [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:3]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #5 ---
Function: instantiate
Self Time: 381 samples (0.90%)
Location: leoric@2.13.9@leoric/lib/bone.js:1282
Call Stack (bottom-up):
  1. dispatch [leoric@2.13.9@leoric:81]
  2. init [leoric@2.13.9@leoric:13]
  3. ignite [leoric@2.13.9@leoric:441]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #6 ---
Function: get
Self Time: 381 samples (0.90%)
Location: mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263
Call Stack (bottom-up):
  1. keyFromFields [mysql2@3.15.3@mysql2:9]
  2. getParser [mysql2@3.15.3@mysql2:42]
  3. getTextParser [mysql2@3.15.3@mysql2:210]
  4. readField [mysql2@3.15.3@mysql2:191]
  5. execute [mysql2@3.15.3@mysql2:23]

--- Hotspot #7 ---
Function: injectProperty
Self Time: 368 samples (0.87%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:165
Call Stack (bottom-up):
  1. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #8 ---
Function: readDistBytesToJSON
Self Time: 346 samples (0.82%)
Location: app/repository/DistRepository.js:31
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #9 ---
Function: start
Self Time: 334 samples (0.79%)
Location: mysql2@3.15.3@mysql2/lib/commands/query.js:48
Call Stack (bottom-up):
  1. execute [mysql2@3.15.3@mysql2:23]
  2. handlePacket [mysql2@3.15.3@mysql2:419]
  3. addCommand [mysql2@3.15.3@mysql2:492]
  4. query [mysql2@3.15.3@mysql2:560]
  5. (anonymous) [leoric@2.13.9@leoric:73]

--- Hotspot #10 ---
Function: (anonymous)
Self Time: 321 samples (0.76%)
Location: @eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js:160
Call Stack (bottom-up):
  1. getRootProto [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:10]
  2. teggRootProto [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:3]
  3. dispatch [koa-compose@4.1.0@koa-compose:35]
  4. dispatch [koa-compose@4.1.0@koa-compose:35]
  5. dta [@eggjs_security@5.0.0-beta.34@@eggjs/security:4]

--- Hotspot #11 ---
Function: initWithInjectProperty
Self Time: 300 samples (0.71%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:20
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #12 ---
Function: init
Self Time: 274 samples (0.65%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/ContextInitiator.js:13
Call Stack (bottom-up):
  1. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #13 ---
Function: _setRaw
Self Time: 215 samples (0.51%)
Location: leoric@2.13.9@leoric/lib/bone.js:300
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #14 ---
Function: createCallContext
Self Time: 202 samples (0.48%)
Location: @eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime/dist/AspectExecutor.js:20
Call Stack (bottom-up):
  1. beforeCall [@eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime:53]
  2. execute [@eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime:37]
  3. download [package/DownloadPackageVersionTar.js:26]
  4. (anonymous) [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:36]
  5. runMicrotasks [(native)]

--- Hotspot #15 ---
Function: (anonymous)
Self Time: 198 samples (0.47%)
Location: @eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js:36
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #16 ---
Function: convertModelToEntity
Self Time: 195 samples (0.46%)
Location: repository/util/ModelConvertor.js:74
Call Stack (bottom-up):
  1. (anonymous) [repository/BinaryRepository.js:47]
  2. listBinaries [repository/BinaryRepository.js:33]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #17 ---
Function: show
Self Time: 191 samples (0.45%)
Location: controller/package/ShowPackageController.js:20
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #18 ---
Function: getOrCreateEggObject
Self Time: 188 samples (0.44%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #19 ---
Function: _setRawSaved
Self Time: 173 samples (0.41%)
Location: leoric@2.13.9@leoric/lib/bone.js:314
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #20 ---
Function: keyFromFields
Self Time: 167 samples (0.39%)
Location: mysql2@3.15.3@mysql2/lib/parsers/parser_cache.js:9
Call Stack (bottom-up):
  1. getParser [mysql2@3.15.3@mysql2:42]
  2. getTextParser [mysql2@3.15.3@mysql2:210]
  3. readField [mysql2@3.15.3@mysql2:191]
  4. execute [mysql2@3.15.3@mysql2:23]
  5. handlePacket [mysql2@3.15.3@mysql2:419]

--- Hotspot #21 ---
Function: query
Self Time: 138 samples (0.33%)
Location: leoric@2.13.9@leoric/lib/drivers/mysql/index.js:70
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #22 ---
Function: dispatch
Self Time: 137 samples (0.32%)
Location: @eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Router.js:122
Call Stack (bottom-up):
  1. dispatch [koa-compose@4.1.0@koa-compose:35]
  2. ctxLifecycleMiddleware [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:3]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #23 ---
Function: (anonymous)
Self Time: 134 samples (0.32%)
Location: leoric@2.13.9@leoric/lib/collection.js:98
Call Stack (bottom-up):
  1. dispatch [leoric@2.13.9@leoric:81]
  2. init [leoric@2.13.9@leoric:13]
  3. ignite [leoric@2.13.9@leoric:441]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #24 ---
Function: _listPackageFullOrAbbreviatedManifests
Self Time: 129 samples (0.30%)
Location: core/service/PackageManagerService.js:806
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #25 ---
Function: plusPackageVersionCounter
Self Time: 116 samples (0.27%)
Location: core/service/PackageManagerService.js:407
Call Stack (bottom-up):
  1. download [package/DownloadPackageVersionTar.js:26]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #26 ---
Function: ignite
Self Time: 114 samples (0.27%)
Location: leoric@2.13.9@leoric/lib/spell.js:441
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #27 ---
Function: parseDateTime
Self Time: 114 samples (0.27%)
Location: mysql2@3.15.3@mysql2/lib/packets/packet.js:649
Call Stack (bottom-up):
  1. next [(native)]
  2. row [mysql2@3.15.3@mysql2:239]
  3. execute [mysql2@3.15.3@mysql2:23]
  4. handlePacket [mysql2@3.15.3@mysql2:419]
  5. (anonymous) [mysql2@3.15.3@mysql2:92]

--- Hotspot #28 ---
Function: isLogicalCondition
Self Time: 112 samples (0.26%)
Location: leoric@2.13.9@leoric/lib/query_object.js:102
Call Stack (bottom-up):
  1. parseObject [leoric@2.13.9@leoric:178]
  2. parseConditions [leoric@2.13.9@leoric:45]
  3. $where [leoric@2.13.9@leoric:589]
  4. _find [leoric@2.13.9@leoric:1341]
  5. findOne [leoric@2.13.9@leoric:1377]

--- Hotspot #29 ---
Function: attribute
Self Time: 101 samples (0.24%)
Location: leoric@2.13.9@leoric/lib/bone.js:198
Call Stack (bottom-up):
  1. get [leoric@2.13.9@leoric:1167]
  2. convertModelToEntity [util/ModelConvertor.js:74]
  3. (anonymous) [repository/BinaryRepository.js:47]
  4. listBinaries [repository/BinaryRepository.js:33]
  5. runMicrotasks [(native)]

--- Hotspot #30 ---
Function: get
Self Time: 100 samples (0.24%)
Location: mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263
Call Stack (bottom-up):
  1. keyFromFields [mysql2@3.15.3@mysql2:9]
  2. getParser [mysql2@3.15.3@mysql2:42]
  3. getTextParser [mysql2@3.15.3@mysql2:210]
  4. readField [mysql2@3.15.3@mysql2:191]
  5. execute [mysql2@3.15.3@mysql2:23]

====================================================================================================
