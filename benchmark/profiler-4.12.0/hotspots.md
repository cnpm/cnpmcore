====================================================================================================
Performance Hotspots 
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
Function: runMicrotasks
Self Time: 1561 samples (3.68%)
Location: (native):0
Call Stack (bottom-up):
  1. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #3 ---
Function: structuredClone
Self Time: 1081 samples (2.55%)
Location: (native):0
Call Stack (bottom-up):
  1. structuredClone [node:internal/worker/js_transferable:112]
  2. cloneValue [leoric@2.13.9@leoric:112]
  3. instantiate [leoric@2.13.9@leoric:1282]
  4. dispatch [leoric@2.13.9@leoric:81]
  5. init [leoric@2.13.9@leoric:13]

--- Hotspot #4 ---
Function: writev
Self Time: 762 samples (1.80%)
Location: (native):0
Call Stack (bottom-up):
  1. writevGeneric [node:internal/stream_base_commons:121]
  2. Socket._writeGeneric [node:net:935]
  3. Socket._writev [node:net:972]
  4. doWrite [node:internal/streams/writable:587]
  5. clearBuffer [node:internal/streams/writable:744]

--- Hotspot #5 ---
Function: structuredClone
Self Time: 617 samples (1.45%)
Location: node:internal/worker/js_transferable:112
Call Stack (bottom-up):
  1. cloneValue [leoric@2.13.9@leoric:112]
  2. instantiate [leoric@2.13.9@leoric:1282]
  3. dispatch [leoric@2.13.9@leoric:81]
  4. init [leoric@2.13.9@leoric:13]
  5. ignite [leoric@2.13.9@leoric:441]

--- Hotspot #6 ---
Function: match
Self Time: 595 samples (1.40%)
Location: @eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Layer.js:72
Call Stack (bottom-up):
  1. match [@eggjs_router@4.0.0-beta.34@@eggjs/router:424]
  2. dispatch [@eggjs_router@4.0.0-beta.34@@eggjs/router:122]
  3. dispatch [koa-compose@4.1.0@koa-compose:35]
  4. ctxLifecycleMiddleware [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:3]
  5. runMicrotasks [(native)]

--- Hotspot #7 ---
Function: dispatch
Self Time: 564 samples (1.33%)
Location: leoric@2.13.9@leoric/lib/collection.js:81
Call Stack (bottom-up):
  1. init [leoric@2.13.9@leoric:13]
  2. ignite [leoric@2.13.9@leoric:441]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #8 ---
Function: _addHeaderLine
Self Time: 556 samples (1.31%)
Location: node:_http_incoming:382
Call Stack (bottom-up):
  1. get [node:_http_incoming:109]
  2. ServerResponse [node:_http_server:197]
  3. parserOnIncoming [node:_http_server:1073]
  4. parserOnHeadersComplete [node:_http_common:74]

--- Hotspot #9 ---
Function: (anonymous)
Self Time: 477 samples (1.12%)
Location: @eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Router.js:137
Call Stack (bottom-up):
  1. dispatch [@eggjs_router@4.0.0-beta.34@@eggjs/router:122]
  2. dispatch [koa-compose@4.1.0@koa-compose:35]
  3. ctxLifecycleMiddleware [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:3]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #10 ---
Function: instantiate
Self Time: 381 samples (0.90%)
Location: leoric@2.13.9@leoric/lib/bone.js:1282
Call Stack (bottom-up):
  1. dispatch [leoric@2.13.9@leoric:81]
  2. init [leoric@2.13.9@leoric:13]
  3. ignite [leoric@2.13.9@leoric:441]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #11 ---
Function: get
Self Time: 381 samples (0.90%)
Location: mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263
Call Stack (bottom-up):
  1. keyFromFields [mysql2@3.15.3@mysql2:9]
  2. getParser [mysql2@3.15.3@mysql2:42]
  3. getTextParser [mysql2@3.15.3@mysql2:210]
  4. readField [mysql2@3.15.3@mysql2:191]
  5. execute [mysql2@3.15.3@mysql2:23]

--- Hotspot #12 ---
Function: injectProperty
Self Time: 368 samples (0.87%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:165
Call Stack (bottom-up):
  1. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #13 ---
Function: readDistBytesToJSON
Self Time: 346 samples (0.82%)
Location: app/repository/DistRepository.js:31
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #14 ---
Function: start
Self Time: 334 samples (0.79%)
Location: mysql2@3.15.3@mysql2/lib/commands/query.js:48
Call Stack (bottom-up):
  1. execute [mysql2@3.15.3@mysql2:23]
  2. handlePacket [mysql2@3.15.3@mysql2:419]
  3. addCommand [mysql2@3.15.3@mysql2:492]
  4. query [mysql2@3.15.3@mysql2:560]
  5. (anonymous) [leoric@2.13.9@leoric:73]

--- Hotspot #15 ---
Function: (anonymous)
Self Time: 321 samples (0.76%)
Location: @eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js:160
Call Stack (bottom-up):
  1. getRootProto [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:10]
  2. teggRootProto [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:3]
  3. dispatch [koa-compose@4.1.0@koa-compose:35]
  4. dispatch [koa-compose@4.1.0@koa-compose:35]
  5. dta [@eggjs_security@5.0.0-beta.34@@eggjs/security:4]

--- Hotspot #16 ---
Function: initWithInjectProperty
Self Time: 300 samples (0.71%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:20
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #17 ---
Function: writeBuffer
Self Time: 288 samples (0.68%)
Location: (native):0
Call Stack (bottom-up):
  1. handleWriteReq [node:internal/stream_base_commons:46]
  2. writeGeneric [node:internal/stream_base_commons:146]
  3. Socket._writeGeneric [node:net:935]
  4. Socket._write [node:net:977]
  5. writeOrBuffer [node:internal/streams/writable:548]

--- Hotspot #18 ---
Function: init
Self Time: 274 samples (0.65%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/ContextInitiator.js:13
Call Stack (bottom-up):
  1. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #19 ---
Function: parseChannelMessages
Self Time: 259 samples (0.61%)
Location: node:internal/child_process/serialization:142
Call Stack (bottom-up):
  1. channel.onread [node:internal/child_process:613]
  2. callbackTrampoline [node:internal/async_hooks:118]

--- Hotspot #20 ---
Function: writeUtf8String
Self Time: 257 samples (0.61%)
Location: (native):0
Call Stack (bottom-up):
  1. writeChannelMessage [node:internal/child_process/serialization:163]
  2. target._send [node:internal/child_process:762]
  3. (anonymous) [node:internal/child_process:652]
  4. emit [node:events:466]
  5. process.emit [source-map-support@0.5.21@source-map-support:506]

--- Hotspot #21 ---
Function: close
Self Time: 249 samples (0.59%)
Location: (native):0
Call Stack (bottom-up):
  1. closeSocketHandle [node:net:342]
  2. Socket._destroy [node:net:808]
  3. _destroy [node:internal/streams/destroy:90]
  4. destroy [node:internal/streams/destroy:49]
  5. Writable.destroy [node:internal/streams/writable:1114]

--- Hotspot #22 ---
Function: processTicksAndRejections
Self Time: 226 samples (0.53%)
Location: node:internal/process/task_queues:72

--- Hotspot #23 ---
Function: _setRaw
Self Time: 215 samples (0.51%)
Location: leoric@2.13.9@leoric/lib/bone.js:300
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #24 ---
Function: createCallContext
Self Time: 202 samples (0.48%)
Location: @eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime/dist/AspectExecutor.js:20
Call Stack (bottom-up):
  1. beforeCall [@eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime:53]
  2. execute [@eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime:37]
  3. download [package/DownloadPackageVersionTar.js:26]
  4. (anonymous) [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:36]
  5. runMicrotasks [(native)]

--- Hotspot #25 ---
Function: (anonymous)
Self Time: 198 samples (0.47%)
Location: @eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js:36
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #26 ---
Function: convertModelToEntity
Self Time: 195 samples (0.46%)
Location: repository/util/ModelConvertor.js:74
Call Stack (bottom-up):
  1. (anonymous) [repository/BinaryRepository.js:47]
  2. listBinaries [repository/BinaryRepository.js:33]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #27 ---
Function: show
Self Time: 191 samples (0.45%)
Location: controller/package/ShowPackageController.js:20
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #28 ---
Function: getOrCreateEggObject
Self Time: 188 samples (0.44%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #29 ---
Function: _setRawSaved
Self Time: 173 samples (0.41%)
Location: leoric@2.13.9@leoric/lib/bone.js:314
Call Stack (bottom-up):
  1. instantiate [leoric@2.13.9@leoric:1282]
  2. dispatch [leoric@2.13.9@leoric:81]
  3. init [leoric@2.13.9@leoric:13]
  4. ignite [leoric@2.13.9@leoric:441]
  5. runMicrotasks [(native)]

--- Hotspot #30 ---
Function: promiseAfterHook
Self Time: 168 samples (0.40%)
Location: node:internal/async_hooks:353
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

====================================================================================================
