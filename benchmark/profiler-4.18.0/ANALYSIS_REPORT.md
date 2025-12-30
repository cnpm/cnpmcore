# cnpmcore 4.18.0 CPU Profile Analysis Report

Generated: 2025-12-30T08:28:28.729Z

## Overview

| Profile                                     | Nodes | Samples | Duration |
| ------------------------------------------- | ----- | ------- | -------- |
| registry.npmmirror.com-05-x-cpuprofile-2... | 5705  | 149382  | 180.05s  |
| registry.npmmirror.com-08-x-cpuprofile-2... | 4476  | 156772  | 180.02s  |

## CPU Time Distribution by Category

| Category                                            | Self Time % | Samples |
| --------------------------------------------------- | ----------- | ------- |
| unknown                                             | 60.20%      | 184290  |
| node-internal                                       | 10.71%      | 32790   |
| npm:leoric                                          | 5.40%       | 16538   |
| npm:\_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs      | 4.16%       | 12728   |
| npm:\_@eggjs_router@4.0.0-beta.35@@eggjs            | 2.39%       | 7329    |
| npm:\_@eggjs_lifecycle@4.0.0-beta.35@@eggjs         | 1.88%       | 5754    |
| cnpmcore                                            | 1.61%       | 4939    |
| npm:mysql2                                          | 1.54%       | 4710    |
| npm:\_@eggjs_koa@3.1.0-beta.35@@eggjs               | 1.32%       | 4043    |
| npm:egg-logger                                      | 1.26%       | 3856    |
| npm:\_@eggjs_controller-plugin@4.0.0-beta.35@@eggjs | 1.19%       | 3629    |
| npm:\_@eggjs_aop-runtime@4.0.0-beta.35@@eggjs       | 1.04%       | 3189    |
| npm:reflect-metadata                                | 0.88%       | 2693    |
| npm:\_@eggjs_tegg-plugin@4.0.0-beta.35@@eggjs       | 0.60%       | 1837    |
| npm:egg                                             | 0.60%       | 1823    |
| npm:koa-compose                                     | 0.56%       | 1719    |
| npm:\_@eggjs_security@5.0.0-beta.35@@eggjs          | 0.46%       | 1411    |
| npm:utility                                         | 0.40%       | 1220    |
| npm:negotiator                                      | 0.39%       | 1184    |
| npm:\_@eggjs_metadata@4.0.0-beta.35@@eggjs          | 0.26%       | 786     |
| npm:on-finished                                     | 0.18%       | 564     |
| npm:xprofiler                                       | 0.18%       | 538     |
| npm:semver                                          | 0.17%       | 531     |
| npm:sqlstring                                       | 0.15%       | 468     |
| npm:\_@eggjs_tegg-common-util@4.0.0-beta.35@@eggjs  | 0.15%       | 462     |
| npm:oss-client                                      | 0.15%       | 451     |
| npm:tslib                                           | 0.15%       | 446     |
| npm:encodeurl                                       | 0.15%       | 444     |
| npm:vary                                            | 0.14%       | 428     |
| npm:\_@eggjs_tracer@4.0.0-beta.35@@eggjs            | 0.12%       | 381     |
| npm:\_@koa_cors@5.0.0@@koa                          | 0.12%       | 357     |
| npm:ioredis                                         | 0.12%       | 354     |
| npm:oss-cnpm                                        | 0.11%       | 346     |
| npm:koa-bodyparser                                  | 0.10%       | 313     |
| npm:accepts                                         | 0.10%       | 297     |
| npm:ee-first                                        | 0.09%       | 262     |
| npm:urllib                                          | 0.07%       | 207     |
| npm:\_@eggjs_background-task@4.0.0-beta.35@@eggjs   | 0.06%       | 183     |
| npm:undici                                          | 0.06%       | 171     |
| npm:\_@eggjs_koa-static-cache@7.0.0-beta.35@@eggjs  | 0.05%       | 160     |
| npm:koa-session                                     | 0.05%       | 153     |
| npm:lodash-es                                       | 0.04%       | 133     |
| npm:egg-status                                      | 0.04%       | 131     |
| npm:\_@eggjs_static@4.0.0-beta.35@@eggjs            | 0.04%       | 130     |
| npm:\_@eggjs_path-matching@3.0.0-beta.35@@eggjs     | 0.04%       | 126     |
| npm:lru.min                                         | 0.04%       | 118     |
| npm:\_@eggjs_core@7.0.0-beta.35@@eggjs              | 0.04%       | 108     |
| npm:mime-types                                      | 0.03%       | 96      |
| npm:\_@eggjs_errors@3.0.0-beta.35@@eggjs            | 0.03%       | 90      |
| npm:type-is                                         | 0.03%       | 80      |
| npm:parseurl                                        | 0.02%       | 76      |
| npm:escape-html                                     | 0.02%       | 72      |
| npm:is-string                                       | 0.02%       | 71      |
| npm:secure-json-parse                               | 0.02%       | 70      |
| npm:is-number-object                                | 0.02%       | 61      |
| npm:ylru                                            | 0.02%       | 52      |
| npm:is-bigint                                       | 0.01%       | 45      |
| npm:koa-override                                    | 0.01%       | 42      |
| npm:is-array-buffer                                 | 0.01%       | 41      |
| npm:ajv                                             | 0.01%       | 40      |
| npm:is-boolean-object                               | 0.01%       | 37      |
| npm:is-weakset                                      | 0.01%       | 36      |
| npm:redis-parser                                    | 0.01%       | 33      |
| npm:is-set                                          | 0.01%       | 33      |
| npm:is-map                                          | 0.01%       | 32      |
| npm:is-weakmap                                      | 0.01%       | 32      |
| npm:is-date-object                                  | 0.01%       | 29      |
| npm:validate-npm-package-name                       | 0.01%       | 27      |
| npm:is-shared-array-buffer                          | 0.01%       | 27      |
| npm:dayjs                                           | 0.01%       | 24      |
| other                                               | 0.01%       | 24      |
| npm:hosted-git-info                                 | 0.01%       | 22      |
| npm:\_@eggjs_orm-plugin@4.0.0-beta.35@@eggjs        | 0.01%       | 21      |
| npm:denque                                          | 0.01%       | 17      |
| npm:sendmessage                                     | 0.01%       | 16      |
| npm:tar                                             | 0.00%       | 15      |
| npm:iconv-lite                                      | 0.00%       | 15      |
| npm:ajv-keywords                                    | 0.00%       | 13      |
| npm:\_@eggjs_schedule@6.0.0-beta.35@@eggjs          | 0.00%       | 11      |
| npm:npm-package-arg                                 | 0.00%       | 11      |
| npm:\_@eggjs_aop-plugin@4.0.0-beta.35@@eggjs        | 0.00%       | 9       |
| npm:deep-equal                                      | 0.00%       | 9       |
| npm:is-callable                                     | 0.00%       | 8       |
| npm:ssri                                            | 0.00%       | 7       |
| npm:\_@eggjs_core-decorator@4.0.0-beta.35@@eggjs    | 0.00%       | 7       |
| npm:http-errors                                     | 0.00%       | 6       |
| npm:source-map-support                              | 0.00%       | 5       |
| npm:debug                                           | 0.00%       | 5       |
| npm:\_@elastic_transport@8.10.1@@elastic            | 0.00%       | 4       |
| npm:\_@cnpmjs_packument@1.6.0@@cnpmjs               | 0.00%       | 4       |
| npm:httpx                                           | 0.00%       | 4       |
| npm:\_@eggjs_schedule-plugin@4.0.0-beta.35@@eggjs   | 0.00%       | 4       |
| npm:xml2js                                          | 0.00%       | 4       |
| npm:is-symbol                                       | 0.00%       | 4       |
| npm:lru-cache                                       | 0.00%       | 3       |
| npm:side-channel                                    | 0.00%       | 3       |
| npm:sax                                             | 0.00%       | 3       |
| npm:minipass                                        | 0.00%       | 3       |
| npm:\_@eggjs_typebox-validate@4.0.0-beta.35@@eggjs  | 0.00%       | 3       |
| npm:which-boxed-primitive                           | 0.00%       | 2       |
| npm:side-channel-weakmap                            | 0.00%       | 2       |
| npm:\_@aliyunmq_mq-http-sdk@1.0.4@@aliyunmq         | 0.00%       | 2       |
| npm:mime                                            | 0.00%       | 2       |
| npm:which-collection                                | 0.00%       | 2       |
| npm:\_@alicloud_openapi-util@0.3.2@@alicloud        | 0.00%       | 1       |
| npm:\_@alicloud_tea-typescript@1.8.0@@alicloud      | 0.00%       | 1       |
| npm:cluster-client                                  | 0.00%       | 1       |
| npm:\_@isaacs_fs-minipass@4.0.1@@isaacs             | 0.00%       | 1       |
| npm:minizlib                                        | 0.00%       | 1       |
| npm:\_@alicloud_openapi-client@0.4.15@@alicloud     | 0.00%       | 1       |
| npm:get-ready                                       | 0.00%       | 1       |
| npm:destroy                                         | 0.00%       | 1       |
| npm:\_@eggjs_rds@1.5.0@@eggjs                       | 0.00%       | 0       |
| npm:\_@eggjs_eventbus-plugin@4.0.0-beta.35@@eggjs   | 0.00%       | 0       |
| npm:\_@elastic_elasticsearch@8.19.1@@elastic        | 0.00%       | 0       |
| npm:\_@opentelemetry_api@1.9.0@@opentelemetry       | 0.00%       | 0       |
| npm:cache-content-type                              | 0.00%       | 0       |
| npm:\_@eggjs_orm-decorator@4.0.0-beta.35@@eggjs     | 0.00%       | 0       |
| npm:\_@eggjs_view@4.0.0-beta.35@@eggjs              | 0.00%       | 0       |
| npm:egg-view-nunjucks                               | 0.00%       | 0       |
| npm:nunjucks                                        | 0.00%       | 0       |
| npm:asap                                            | 0.00%       | 0       |
| npm:\_@eggjs_eventbus-runtime@4.0.0-beta.35@@eggjs  | 0.00%       | 0       |
| npm:tcp-base                                        | 0.00%       | 0       |
| npm:graceful-fs                                     | 0.00%       | 0       |
| npm:koa-onerror                                     | 0.00%       | 0       |
| npm:co-body                                         | 0.00%       | 0       |
| npm:raw-body                                        | 0.00%       | 0       |
| npm:which-typed-array                               | 0.00%       | 0       |
| npm:for-each                                        | 0.00%       | 0       |
| npm:performance-ms                                  | 0.00%       | 0       |

## Top 30 Overall Hotspots (by Self Time)

| #   | Function                     | Category                                            | Self % | Location                  |
| --- | ---------------------------- | --------------------------------------------------- | ------ | ------------------------- |
| 1   | `(idle)`                     | unknown                                             | 49.61% | native                    |
| 2   | `Bone`                       | npm:leoric                                          | 2.49%  | bone.js:151               |
| 3   | `(program)`                  | unknown                                             | 2.02%  | native                    |
| 4   | `runMicrotasks`              | unknown                                             | 1.81%  | native                    |
| 5   | `writev`                     | unknown                                             | 1.48%  | native                    |
| 6   | `(garbage collector)`        | unknown                                             | 1.11%  | native                    |
| 7   | `_addHeaderLine`             | node-internal                                       | 1.04%  | node:\_http_incoming:382  |
| 8   | `match`                      | npm:\_@eggjs_router@4.0.0-beta.35@@eggjs            | 1.00%  | Layer.js:72               |
| 9   | `writeUtf8String`            | unknown                                             | 0.98%  | native                    |
| 10  | `(anonymous)`                | npm:\_@eggjs_router@4.0.0-beta.35@@eggjs            | 0.74%  | Router.js:137             |
| 11  | `injectProperty`             | npm:\_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs      | 0.59%  | EggObjectImpl.js:165      |
| 12  | `(anonymous)`                | npm:\_@eggjs_controller-plugin@4.0.0-beta.35@@eggjs | 0.55%  | HTTPMethodRegister.js:160 |
| 13  | `parseChannelMessages`       | node-internal                                       | 0.53%  | serialization:142         |
| 14  | `init`                       | npm:\_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs      | 0.48%  | ContextInitiator.js:13    |
| 15  | `initWithInjectProperty`     | npm:\_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs      | 0.44%  | EggObjectImpl.js:20       |
| 16  | `getLifecycleHook`           | npm:\_@eggjs_lifecycle@4.0.0-beta.35@@eggjs         | 0.43%  | LifycycleUtil.js:72       |
| 17  | `close`                      | unknown                                             | 0.42%  | native                    |
| 18  | `createCallContext`          | npm:\_@eggjs_aop-runtime@4.0.0-beta.35@@eggjs       | 0.38%  | AspectExecutor.js:20      |
| 19  | `processTicksAndRejections`  | node-internal                                       | 0.36%  | task_queues:71            |
| 20  | `get`                        | npm:mysql2                                          | 0.35%  | column_definition.js:263  |
| 21  | `instantiate`                | npm:leoric                                          | 0.31%  | bone.js:1283              |
| 22  | `(anonymous)`                | npm:\_@eggjs_controller-plugin@4.0.0-beta.35@@eggjs | 0.31%  | HTTPMethodRegister.js:36  |
| 23  | `dispatch`                   | npm:leoric                                          | 0.31%  | collection.js:81          |
| 24  | `match`                      | npm:\_@eggjs_router@4.0.0-beta.35@@eggjs            | 0.29%  | Router.js:424             |
| 25  | `getOrCreateEggObject`       | npm:\_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs      | 0.29%  | EggContainerFactory.js:28 |
| 26  | `Socket`                     | node-internal                                       | 0.27%  | node:net:362              |
| 27  | `showPackageDownloads`       | cnpmcore                                            | 0.26%  | DownloadController.js:20  |
| 28  | `teggRootProto`              | npm:\_@eggjs_controller-plugin@4.0.0-beta.35@@eggjs | 0.24%  | tegg_root_proto.js:3      |
| 29  | `writeBuffer`                | unknown                                             | 0.22%  | native                    |
| 30  | `connectionListenerInternal` | node-internal                                       | 0.20%  | node:\_http_server:702    |

## cnpmcore Code Hotspots

These are the hottest functions within the cnpmcore codebase itself:

| #   | Function                    | Self % | File:Line                                                                                                                  |
| --- | --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Bone`                      | 2.49%  | node_modules/_leoric@2.14.0@leoric/lib/bone.js:151                                                                         |
| 2   | `match`                     | 1.00%  | node*modules/*@eggjs_router@4.0.0-beta.35@@eggjs/router/dist/Layer.js:72                                                   |
| 3   | `(anonymous)`               | 0.74%  | node*modules/*@eggjs_router@4.0.0-beta.35@@eggjs/router/dist/Router.js:137                                                 |
| 4   | `injectProperty`            | 0.59%  | node*modules/*@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:165                         |
| 5   | `(anonymous)`               | 0.55%  | node*modules/*@eggjs_controller-plugin@4.0.0-beta.35@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js:160 |
| 6   | `init`                      | 0.48%  | node*modules/*@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs/tegg-runtime/dist/impl/ContextInitiator.js:13                       |
| 7   | `initWithInjectProperty`    | 0.44%  | node*modules/*@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:20                          |
| 8   | `getLifecycleHook`          | 0.43%  | node*modules/*@eggjs_lifecycle@4.0.0-beta.35@@eggjs/lifecycle/dist/LifycycleUtil.js:72                                     |
| 9   | `createCallContext`         | 0.38%  | node*modules/*@eggjs_aop-runtime@4.0.0-beta.35@@eggjs/aop-runtime/dist/AspectExecutor.js:20                                |
| 10  | `get`                       | 0.35%  | node_modules/_mysql2@3.16.0@mysql2/lib/packets/column_definition.js:263                                                    |
| 11  | `instantiate`               | 0.31%  | node_modules/_leoric@2.14.0@leoric/lib/bone.js:1283                                                                        |
| 12  | `(anonymous)`               | 0.31%  | node*modules/*@eggjs_controller-plugin@4.0.0-beta.35@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js:36  |
| 13  | `dispatch`                  | 0.31%  | node_modules/_leoric@2.14.0@leoric/lib/collection.js:81                                                                    |
| 14  | `match`                     | 0.29%  | node*modules/*@eggjs_router@4.0.0-beta.35@@eggjs/router/dist/Router.js:424                                                 |
| 15  | `getOrCreateEggObject`      | 0.29%  | node*modules/*@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28                 |
| 16  | `showPackageDownloads`      | 0.26%  | app/port/controller/DownloadController.js:20                                                                               |
| 17  | `teggRootProto`             | 0.24%  | node*modules/*@eggjs_controller-plugin@4.0.0-beta.35@@eggjs/controller-plugin/dist/app/middleware/tegg_root_proto.js:3     |
| 18  | `start`                     | 0.20%  | node_modules/_mysql2@3.16.0@mysql2/lib/commands/query.js:48                                                                |
| 19  | `plusPackageVersionCounter` | 0.19%  | app/core/service/PackageManagerService.js:414                                                                              |
| 20  | `_setRaw`                   | 0.19%  | node_modules/_leoric@2.14.0@leoric/lib/bone.js:301                                                                         |

## NPM Dependency CPU Usage

CPU time spent in npm dependencies:

| Package                                         | Self Time % |
| ----------------------------------------------- | ----------- |
| leoric                                          | 5.40%       |
| \_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs      | 4.16%       |
| \_@eggjs_router@4.0.0-beta.35@@eggjs            | 2.39%       |
| \_@eggjs_lifecycle@4.0.0-beta.35@@eggjs         | 1.88%       |
| mysql2                                          | 1.54%       |
| \_@eggjs_koa@3.1.0-beta.35@@eggjs               | 1.32%       |
| egg-logger                                      | 1.26%       |
| \_@eggjs_controller-plugin@4.0.0-beta.35@@eggjs | 1.19%       |
| \_@eggjs_aop-runtime@4.0.0-beta.35@@eggjs       | 1.04%       |
| reflect-metadata                                | 0.88%       |
| \_@eggjs_tegg-plugin@4.0.0-beta.35@@eggjs       | 0.60%       |
| egg                                             | 0.60%       |
| koa-compose                                     | 0.56%       |
| \_@eggjs_security@5.0.0-beta.35@@eggjs          | 0.46%       |
| utility                                         | 0.40%       |

## Call Relationship Diagram

Top cnpmcore hotspot functions and their call relationships:

```mermaid
graph TD
    N0["Bone<br/>3.74%"]
    N1["match<br/>1.08%"]
    N2["(anonymous)<br/>0.86%"]
    N3["injectProperty<br/>0.63%"]
    N2["(anonymous)<br/>0.65%"]
    N2 --> N4["get path"]
    N5["init<br/>0.52%"]
    N5 --> N6["getContextProto"]
    N5 --> N7[""]
    N8["initWithInjectProperty<br/>0.51%"]
    N8 --> N9["getLifecycleHook"]
    N8 --> N10["objectPostCreate"]
    N8 --> N7[""]
    N9["getLifecycleHook<br/>0.49%"]
    N9 --> N11["getMetaData"]
    N12["createCallContext<br/>0.44%"]
    N13["get<br/>0.60%"]
    N13 --> N14["exports.decode"]
    N15["instantiate<br/>0.44%"]
    N15 --> N16["_setRaw"]
    N15 --> N17["_setRawSaved"]
    N15 --> N18["cast"]
    N2["(anonymous)<br/>0.37%"]
    N2 --> N19["download"]
    N2 --> N20["show"]
    N2 --> N21["deprecatedDownload"]
    N22["dispatch<br/>0.48%"]
    N22 --> N15["instantiate"]
    N22 --> N7[""]
    N22 --> N23["get primaryColumn"]
    N1["match<br/>0.39%"]
    N1 --> N1["match"]
    N1 --> N24["logger"]
    N25["getOrCreateEggObject<br/>0.32%"]
    N25 --> N5["init"]
    N25 --> N26["createContextInitiator"]
```

## Optimization Recommendations

Based on the profile analysis:

2. **leoric (5.4%)**: Review usage of this dependency

## Files for Further Investigation

- `node_modules/_leoric@2.14.0@leoric/lib/bone.js` (2.99%)
- `node_modules/_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js` (1.03%)
- `node_modules/_@eggjs_router@4.0.0-beta.35@@eggjs/router/dist/Router.js` (1.03%)
- `node_modules/_@eggjs_router@4.0.0-beta.35@@eggjs/router/dist/Layer.js` (1.00%)
- `node_modules/_@eggjs_controller-plugin@4.0.0-beta.35@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js` (0.86%)
- `node_modules/_@eggjs_tegg-runtime@4.0.0-beta.35@@eggjs/tegg-runtime/dist/impl/ContextInitiator.js` (0.48%)
- `node_modules/_@eggjs_lifecycle@4.0.0-beta.35@@eggjs/lifecycle/dist/LifycycleUtil.js` (0.43%)
- `node_modules/_@eggjs_aop-runtime@4.0.0-beta.35@@eggjs/aop-runtime/dist/AspectExecutor.js` (0.38%)
- `node_modules/_mysql2@3.16.0@mysql2/lib/packets/column_definition.js` (0.35%)
- `node_modules/_leoric@2.14.0@leoric/lib/collection.js` (0.31%)
