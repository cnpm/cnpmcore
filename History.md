
2.4.0 / 2022-10-25
==================

**features**
  * [[`6aa302d`](http://github.com/cnpm/cnpmcore/commit/6aa302d074f2c84f39e2065fa20853b007f6fa3b)] - 📦 NEW: Use oss-cnpm v4 (#340) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`a217fd0`](http://github.com/cnpm/cnpmcore/commit/a217fd07ccad3fe5058881654a13e0c69c758717)] - 👌 IMPROVE: Reduce warning log (#326) (fengmk2 <<fengmk2@gmail.com>>)

**fixes**
  * [[`b19b0a0`](http://github.com/cnpm/cnpmcore/commit/b19b0a0496e35ac1c6b3de746b9221990ba9dc93)] - fix: Lazy set registryId when executeTask (#341) (elrrrrrrr <<elrrrrrrr@gmail.com>>)

**others**
  * [[`305175a`](http://github.com/cnpm/cnpmcore/commit/305175ab5fcdc3ad3b60055d45cfcacb23065a80)] - 🤖 TEST: Use enum define on unittest (#333) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`07f2eba`](http://github.com/cnpm/cnpmcore/commit/07f2eba137ba625b2d422677a465920617141b87)] - 🤖 TEST: Mock all binary http requests (#328) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`4b0c7dc`](http://github.com/cnpm/cnpmcore/commit/4b0c7dc6196960d34b2529bfde724e97f1af8444)] - 🤖 TEST: Mock all httpclient request (#327) (fengmk2 <<fengmk2@gmail.com>>)

2.3.1 / 2022-10-06
==================

**features**
  * [[`bbc08fd`](http://github.com/cnpm/cnpmcore/commit/bbc08fd26887d55b98b70d1ed210caf81f9d5c22)] - 👌 IMPROVE: syncPackageWorkerMaxConcurrentTasks up to 20 (#322) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`5852f22`](http://github.com/cnpm/cnpmcore/commit/5852f22023525d857ff1ceea205e4315c8079877)] - feat: support sync exist mode (#275) (zhangyuantao <<zhangyuantao@163.com>>)

**fixes**
  * [[`d79634e`](http://github.com/cnpm/cnpmcore/commit/d79634eea749fef1a420988a8599f156f28ee85a)] - 🐛 FIX: Should sync package when registry id is null (#324) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`24f920d`](http://github.com/cnpm/cnpmcore/commit/24f920d65b31f9eb83c1ecda36adf7f9e2c379c3)] - 🐛 FIX: Should run sync package on all worker (#323) (fengmk2 <<fengmk2@gmail.com>>)

2.3.0 / 2022-09-24
==================

**others**
  * [[`bd83a19`](http://github.com/cnpm/cnpmcore/commit/bd83a19eca761c96bcee04e6ae91e68eac3cb6bf)] - 👌 IMPROVE: use urllib3 instead (#302) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`35e7d3a`](http://github.com/cnpm/cnpmcore/commit/35e7d3ad3c78712b507d522a0b72b5a6a5a4ec1c)] - 👌 IMPROVE: Enable phpmyadmin and DEBUG_LOCAL_SQL by default (#320) (fengmk2 <<fengmk2@gmail.com>>)

2.2.0 / 2022-09-22
==================

**features**
  * [[`bca0fb3`](http://github.com/cnpm/cnpmcore/commit/bca0fb3c37b9f74f3c41ab181dd3113d9dab4c05)] - feat: only allow pkg sync from registry it belong (#317) (killa <<killa123@126.com>>)

**fixes**
  * [[`7e9beea`](http://github.com/cnpm/cnpmcore/commit/7e9beead576a41de3aa042b92b788bde5d55f44a)] - fix: only append / if path is not empty and not ends with / (#316) (killa <<killa123@126.com>>)
  * [[`4fe68cb`](http://github.com/cnpm/cnpmcore/commit/4fe68cbf38f303e797b80b88407f714ec76bfae0)] - fix: fix directory path (#313) (killa <<killa123@126.com>>)

**others**
  * [[`e72ce35`](http://github.com/cnpm/cnpmcore/commit/e72ce3576f9a3cda095e3feac59eeb1d8c1e8033)] - 🤖 TEST: Skip unstable tests (#318) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`171b11f`](http://github.com/cnpm/cnpmcore/commit/171b11f7bba534c993af4088b00f8545216734a9)] - Revert "fix: fix directory path (#313)" (fengmk2 <<fengmk2@gmail.com>>)

2.1.1 / 2022-09-08
==================

**fixes**
  * [[`8fb9dd8`](http://github.com/cnpm/cnpmcore/commit/8fb9dd8cf4800afe3f54aba9ee4c0ae05efb4f1d)] - fix: findExecuteTask only return waiting task (#312) (killa <<killa123@126.com>>)

2.1.0 / 2022-09-05
==================

**features**
  * [[`c5d2b49`](http://github.com/cnpm/cnpmcore/commit/c5d2b49ab3a0ce0d67f6e7cc19e0be867c92d04c)] - feat: auto get next valid task (#311) (elrrrrrrr <<elrrrrrrr@gmail.com>>)

2.0.0 / 2022-09-05
==================

**others**
  * [[`fc4baff`](http://github.com/cnpm/cnpmcore/commit/fc4baff226540e7cfee9adc069e17a59f4050a43)] - chore: refactor schedule with @Schedule (#309) (killa <<killa123@126.com>>)

1.11.6 / 2022-09-04
==================

**fixes**
  * [[`768f951`](http://github.com/cnpm/cnpmcore/commit/768f951b6f2509f14c30a70d86a6719107d963a4)] - fix: cnpmjsorg changesstream limit (#310) (elrrrrrrr <<elrrrrrrr@gmail.com>>)

1.11.5 / 2022-09-02
==================

**fixes**
  * [[`f673ab8`](http://github.com/cnpm/cnpmcore/commit/f673ab8ba1545909ff6b8e445364646511930891)] - fix: execute state check (#308) (elrrrrrrr <<elrrrrrrr@gmail.com>>)

**others**
  * [[`091420a`](http://github.com/cnpm/cnpmcore/commit/091420ae2677ecedd1a26a238921321c2a191675)] - 🤖 TEST: Add SQL Review Action (#307) (fengmk2 <<fengmk2@gmail.com>>)

1.11.4 / 2022-08-30
==================

**fixes**
  * [[`f9210ca`](http://github.com/cnpm/cnpmcore/commit/f9210ca7e180e19bce08da9ef33e46e990b86ef1)] - fix: changes stream empty (#306) (elrrrrrrr <<elrrrrrrr@gmail.com>>)

1.11.3 / 2022-08-29
==================

**fixes**
  * [[`48f228d`](http://github.com/cnpm/cnpmcore/commit/48f228da447d8cde62849fa52cf43bae7754e2e3)] - fix: changes stream updatedAt (#304) (elrrrrrrr <<elrrrrrrr@gmail.com>>)
  * [[`87045ba`](http://github.com/cnpm/cnpmcore/commit/87045ba8b0e14547c93689600eb7e2c1de2a611b)] - fix: task updatedAt save (#305) (elrrrrrrr <<elrrrrrrr@gmail.com>>)

1.11.2 / 2022-08-28
==================

**fixes**
  * [[`4e8700c`](http://github.com/cnpm/cnpmcore/commit/4e8700c4f7c6fb5c4f4d4a2b9a9546096c5d10e2)] - fix: only create createHookTask if hook enable (#299) (killa <<killa123@126.com>>)

**others**
  * [[`e06c841`](http://github.com/cnpm/cnpmcore/commit/e06c841537113fdb0c00beb22b0a55378c61ce80)] - 🐛 FIX: Should sync public package when registryName not exists (#303) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`f139444`](http://github.com/cnpm/cnpmcore/commit/f139444213403494ebe9bf073df62125413892d9)] - 📖 DOC: Update contributors (fengmk2 <<fengmk2@gmail.com>>)
  * [[`c4a9de5`](http://github.com/cnpm/cnpmcore/commit/c4a9de598dce9a1b82bbcdd91968a15bbc5a4b6b)] - Create SECURITY.md (fengmk2 <<fengmk2@gmail.com>>)
  * [[`709d65b`](http://github.com/cnpm/cnpmcore/commit/709d65bd0473856c9bfc4416ea2ca375136e354f)] - 🤖 TEST: Use diff bucket on OSS test (#301) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`9576699`](http://github.com/cnpm/cnpmcore/commit/95766990fa9c4c2c43d462f6b151557425b0c741)] - chore: use AsyncGenerator insteadof Transform stream (#300) (killa <<killa123@126.com>>)
  * [[`3ed5269`](http://github.com/cnpm/cnpmcore/commit/3ed5269f1d22ca3aaca89a90a4fff90f293e2464)] - 📦 NEW: Mirror better-sqlite3 binary (#296) (fengmk2 <<fengmk2@gmail.com>>)

1.11.1 / 2022-08-24
==================

**fixes**
  * [[`359a150`](http://github.com/cnpm/cnpmcore/commit/359a150eb450d69e6523b20efcc5c7cfe3efab4d)] - fix: changes stream (#297) (elrrrrrrr <<elrrrrrrr@gmail.com>>)

1.11.0 / 2022-08-23
==================

**features**
  * [[`a91c8ac`](http://github.com/cnpm/cnpmcore/commit/a91c8ac4d05dc903780fda516b09364a05a2b1e6)] - feat: sync package from spec regsitry (#293) (elrrrrrrr <<elrrrrrrr@gmail.com>>)
  * [[`de37008`](http://github.com/cnpm/cnpmcore/commit/de37008261b05845f392d66764cdfe14ae324756)] - feat: changesStream adapter & needSync() method (#292) (elrrrrrrr <<elrrrrrrr@gmail.com>>)
  * [[`4b506c8`](http://github.com/cnpm/cnpmcore/commit/4b506c8371697ddacdbe99a8ecb330bfc1911ec6)] - feat: init registry & scope (#286) (elrrrrrrr <<elrrrrrrr@gmail.com>>)
  * [[`41c6e24`](http://github.com/cnpm/cnpmcore/commit/41c6e24c84d546eb9d5515cc0940cc3e4274687b)] - feat: impl trigger Hooks (#289) (killa <<killa123@126.com>>)
  * [[`79cb826`](http://github.com/cnpm/cnpmcore/commit/79cb82615f04bdb3da3ccbe09bb6a861608b69c5)] - feat: impl migration sql (#290) (killa <<killa123@126.com>>)
  * [[`4cfa8ed`](http://github.com/cnpm/cnpmcore/commit/4cfa8ed9d687ce7d950d7d20c0ea28221763ba5f)] - feat: impl hooks api (#287) (killa <<killa123@126.com>>)
  * [[`47d53d2`](http://github.com/cnpm/cnpmcore/commit/47d53d22ad03c02ee9cb9035a38ae205a6d38381)] - feat: add bizId for task (#285) (killa <<killa123@126.com>>)
  * [[`3b1536b`](http://github.com/cnpm/cnpmcore/commit/3b1536b070b2f9062bc2cc377db96d2f4a160efc)] - feat: add node-webrtc mirror (#274) (Opportunity <<opportunity@live.in>>)

**others**
  * [[`7106807`](http://github.com/cnpm/cnpmcore/commit/710680742a078b2faf4cb18c3a39c0397308712e)] - 🐛 FIX: Should show queue size on logging (#280) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`3a41b21`](http://github.com/cnpm/cnpmcore/commit/3a41b2161cc99bb2f6f6dd7cbaa7abef25ff4393)] - 🐛 FIX: Handle binary configuration value (#278) (fengmk2 <<fengmk2@gmail.com>>)

1.10.0 / 2022-08-04
==================

**features**
  * [[`c2b7d5a`](http://github.com/cnpm/cnpmcore/commit/c2b7d5aa98b5ba8649ec246c616574a22e9a74b8)] - feat: use sort set to impl queue (#277) (killa <<killa123@126.com>>)

1.9.1 / 2022-07-29
==================

**fixes**
  * [[`c54aa21`](http://github.com/cnpm/cnpmcore/commit/c54aa2165c3938dcbb5a2b3b54e66a0d961cc813)] - fix: check executingCount after task is done (#276) (killa <<killa123@126.com>>)

**others**
  * [[`3268d03`](http://github.com/cnpm/cnpmcore/commit/3268d030b620825c8c2e6331e1745c1788066c61)] - 🤖 TEST: show package not use cache if isSync (#273) (fengmk2 <<fengmk2@gmail.com>>)

1.9.0 / 2022-07-25
==================

**features**
  * [[`af6a75a`](http://github.com/cnpm/cnpmcore/commit/af6a75af32ea04c90fda82be3a56c99ec77e5807)] - feat: add forceSyncHistory options (#271) (killa <<killa123@126.com>>)

1.8.0 / 2022-07-21
==================

**features**
  * [[`b49a38c`](http://github.com/cnpm/cnpmcore/commit/b49a38c77e044c978e6de32a9d3e257cc90ea7c1)] - feat: use Model with inject (#269) (killa <<killa123@126.com>>)

1.7.1 / 2022-07-20
==================

**fixes**
  * [[`52fca55`](http://github.com/cnpm/cnpmcore/commit/52fca55aa883865f0ae70bfc1ff274c313b8f76a)] - fix: show package not use cache if isSync (#268) (killa <<killa123@126.com>>)

1.7.0 / 2022-07-12
==================

**others**
  * [[`4f7ce8b`](http://github.com/cnpm/cnpmcore/commit/4f7ce8b4b2a5806a225ce67228388e14388b7059)] - deps: upgrade leoric to 2.x (#262) (killa <<killa123@126.com>>)

1.6.0 / 2022-07-11
==================

**features**
  * [[`1b9a9c7`](http://github.com/cnpm/cnpmcore/commit/1b9a9c70f66d8393e3b132f18713461a9243db73)] - feat: mirror nydus binaries (#261) (killa <<killa123@126.com>>)

**others**
  * [[`c1256bf`](http://github.com/cnpm/cnpmcore/commit/c1256bf3807bcc9a5c8be2ec5bf5ca8a5eef112e)] - 🐛 FIX: Ignore 403 status on s3 download fail (#260) (fengmk2 <<fengmk2@gmail.com>>)
  * [[`d685772`](http://github.com/cnpm/cnpmcore/commit/d6857724307fb0df0c4c118491784b30d19a9a15)] - 🐛 FIX: skia-canvas should use NodePreGypBinary (#259) (fengmk2 <<fengmk2@gmail.com>>)

1.5.0 / 2022-07-09
==================

**features**
  * [[`b15b10c`](http://github.com/cnpm/cnpmcore/commit/b15b10c5c6cfb32bcc2b1d94434cdd16871ae565)] - feat(mirror): add skia-canvas mirror (#258) (Beace <<beaceshimin@gmail.com>>)

**others**
  * [[`2bd6ed0`](http://github.com/cnpm/cnpmcore/commit/2bd6ed0e5dace1d8840c342ecf4c86e8973dc6b7)] - 👌 IMPROVE: use tegg@1.2.0 (fengmk2 <<fengmk2@gmail.com>>)

1.4.0 / 2022-06-28
==================

**features**
  * [[`57da0a3`](http://github.com/cnpm/cnpmcore/commit/57da0a3c7e56d6613b57391948949ffea24ec058)] - feat: add configuration enableNopmClientAndVersionCheck (laibao101 <<369632567@qq.com>>)

**others**
  * [[`bf62932`](http://github.com/cnpm/cnpmcore/commit/bf62932f2e5224de6e34b873bf690a6e887b94b0)] - 🤖 TEST: Fix unstable test cases on OSS env (#254) (fengmk2 <<fengmk2@gmail.com>>)

1.3.2 / 2022-06-27
==================

**fixes**
  * [[`c63159d`](http://github.com/cnpm/cnpmcore/commit/c63159d8df804fe711b664606fe42be42010eb38)] - fix: valid npm client with correct pattern (#252) (TZ | 天猪 <<atian25@qq.com>>)

**others**
  * [[`d578baf`](http://github.com/cnpm/cnpmcore/commit/d578bafff07a0f9d4dd75393492cffc7f5d2660b)] - 🐛 FIX: Ignore exists seq on changes worker (#253) (fengmk2 <<fengmk2@gmail.com>>)

1.3.1 / 2022-06-24
==================

**fixes**
  * [[`4ea0ef6`](http://github.com/cnpm/cnpmcore/commit/4ea0ef63b7af9fd4dcc247c2c2ac8e4d579f941a)] - fix: query changes with order by id asc (#251) (killa <<killa123@126.com>>)

1.3.0 / 2022-06-24
==================

**features**
  * [[`0948a71`](http://github.com/cnpm/cnpmcore/commit/0948a71a40ac4897d129ef56830665dc028f07c7)] - feat: read enableChangesStream when sync changes stream (#250) (killa <<killa123@126.com>>)

1.2.0 / 2022-06-20
==================

**others**
  * [[`c0d8b52`](http://github.com/cnpm/cnpmcore/commit/c0d8b52ea09736ac11b0ef780aec781d172fb94c)] - refactor: move CacheAdapter to ContextProto (#249) (killa <<killa123@126.com>>)

1.1.0 / 2022-06-20
==================

**features**
  * [[`66b411e`](http://github.com/cnpm/cnpmcore/commit/66b411ea5bf6192dc9509df408525078e7128a27)] - feat: add type for exports (#248) (killa <<killa123@126.com>>)

1.0.0 / 2022-06-17
==================

**others**
  * [[`5cadbf4`](http://github.com/cnpm/cnpmcore/commit/5cadbf4b22bee7d85cd14526f5d6c6e2cd3a2e4b)] - refactor: add infra module (#245) (killa <<killa123@126.com>>),fatal: No names found, cannot describe anything.

