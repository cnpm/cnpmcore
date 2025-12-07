# CPU Profile Comparison Report

Generated: 2025-12-07T13:22:48.818Z

## Summary

| Metric | Profile 1 | Profile 2 |
|--------|-----------|----------|
| File | 01-x-cpuprofile-3591251-20251207-0.cpuprofile | 02-x-cpuprofile-3070674-20251207-0.cpuprofile |
| Total Hits | 168248 | 168658 |
| Nodes | 3489 | 2401 |

## Module Comparison

| Module | P1 Hits | P1 % | P2 Hits | P2 % | Diff |
|--------|---------|------|---------|------|------|
| (native/gc) | 164608 | 97.84% | 166108 | 98.49% | +0.65% |
| leoric@leoric | 1183 | 0.70% | 747 | 0.44% | -0.26% |
| node:internal | 445 | 0.26% | 372 | 0.22% | -0.04% |
| mysql2@mysql2 | 227 | 0.13% | 187 | 0.11% | -0.02% |
| cnpmcore (app) | 203 | 0.12% | 75 | 0.04% | -0.08% |
| urllib@urllib | 102 | 0.06% | 137 | 0.08% | +0.02% |
| @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs | 117 | 0.07% | 101 | 0.06% | -0.01% |
| @eggjs_koa@3.1.0-beta.34@@eggjs | 70 | 0.04% | 66 | 0.04% | 0.00% |
| node:buffer | 84 | 0.05% | 51 | 0.03% | -0.02% |
| node:net | 64 | 0.04% | 63 | 0.04% | 0.00% |
| @eggjs_lifecycle@4.0.0-beta.34@@eggjs | 66 | 0.04% | 50 | 0.03% | -0.01% |
| reflect-metadata@reflect-metadata | 53 | 0.03% | 40 | 0.02% | -0.01% |
| @eggjs_router@4.0.0-beta.34@@eggjs | 44 | 0.03% | 46 | 0.03% | 0.00% |
| node:events | 52 | 0.03% | 36 | 0.02% | -0.01% |
| node:_http_server | 50 | 0.03% | 37 | 0.02% | -0.01% |
| node:_http_incoming | 49 | 0.03% | 37 | 0.02% | -0.01% |
| @fengmk2_tar@@fengmk2 | 67 | 0.04% | 0 | 0.00% | -0.04% |
| egg@4.1.0-beta.34@egg | 33 | 0.02% | 28 | 0.02% | 0.00% |
| egg-logger@egg-logger | 28 | 0.02% | 32 | 0.02% | 0.00% |
| @eggjs_controller-plugin@4.0.0-beta.34@@eggjs | 33 | 0.02% | 27 | 0.02% | 0.00% |

## Top Functions by Total Hits

| Function | Location | P1 Hits | P1 % | P2 Hits | P2 % | Diff |
|----------|----------|---------|------|---------|------|------|
| (idle) | (native):0 | 162444 | 96.550% | 164808 | 97.717% | +1.167% |
| Bone | bone.js:150 | 658 | 0.391% | 407 | 0.241% | -0.150% |
| (program) | (native):0 | 420 | 0.250% | 444 | 0.263% | +0.013% |
| (garbage collector) | (native):0 | 481 | 0.286% | 345 | 0.205% | -0.081% |
| custom_gc | (native):0 | 350 | 0.208% | 0 | 0.000% | -0.208% |
| writeSync | (native):0 | 132 | 0.078% | 72 | 0.043% | -0.035% |
| parseJSON | utils.js:25 | 80 | 0.048% | 117 | 0.069% | +0.021% |
| runMicrotasks | (native):0 | 108 | 0.064% | 62 | 0.037% | -0.027% |
| (anonymous) | (native):0 | 92 | 0.055% | 66 | 0.039% | -0.016% |
| structuredClone | (native):0 | 91 | 0.054% | 53 | 0.031% | -0.023% |
| writev | (native):0 | 86 | 0.051% | 52 | 0.031% | -0.020% |
| instantiate | bone.js:1282 | 86 | 0.051% | 36 | 0.021% | -0.030% |
| dispatch | collection.js:81 | 71 | 0.042% | 47 | 0.028% | -0.014% |
| writeBuffer | (native):0 | 64 | 0.038% | 41 | 0.024% | -0.014% |
| toString | node:buffer:845 | 48 | 0.029% | 38 | 0.023% | -0.006% |
| get | column_definition.js:263 | 47 | 0.028% | 36 | 0.021% | -0.007% |
| writeUtf8String | (native):0 | 47 | 0.028% | 34 | 0.020% | -0.008% |
| structuredClone | js_transferable:112 | 49 | 0.029% | 24 | 0.014% | -0.015% |
| start | query.js:48 | 35 | 0.021% | 31 | 0.018% | -0.003% |
| _addHeaderLine | node:_http_incoming:382 | 32 | 0.019% | 31 | 0.018% | -0.001% |
| isLogicalCondition | query_object.js:102 | 32 | 0.019% | 25 | 0.015% | -0.004% |
| update | (native):0 | 53 | 0.032% | 3 | 0.002% | -0.030% |
| nextTick | task_queues:111 | 8 | 0.005% | 47 | 0.028% | +0.023% |
| tryStringObject | index.js:9 | 39 | 0.023% | 16 | 0.009% | -0.014% |
| syncPackageWithPackument | PackageSyncerService.js:926 | 50 | 0.030% | 0 | 0.000% | -0.030% |
| _respond | application.js:218 | 28 | 0.017% | 21 | 0.012% | -0.005% |
| __classPrivateFieldGet | tslib.js:336 | 28 | 0.017% | 17 | 0.010% | -0.007% |
| token | expr.js:266 | 29 | 0.017% | 14 | 0.008% | -0.009% |
| parseChannelMessages | serialization:142 | 22 | 0.013% | 20 | 0.012% | -0.001% |
| getPeerCertificate | (native):0 | 20 | 0.012% | 21 | 0.012% | 0.000% |

## Significant Changes (>0.05% difference)

| Function | Location | P1 % | P2 % | Diff |
|----------|----------|------|------|------|
| (idle) | (native):0 | 96.550% | 97.717% | +1.167% |
| custom_gc | (native):0 | 0.208% | 0.000% | -0.208% |
| Bone | bone.js:150 | 0.391% | 0.241% | -0.150% |
| (garbage collector) | (native):0 | 0.286% | 0.205% | -0.081% |

