# Changelog

## [3.2.1](https://github.com/cnpm/npmcore/compare/v3.2.0...v3.2.1) (2023-01-29)


### Bug Fixes

* api binary host config ([#383](https://github.com/cnpm/npmcore/issues/383)) ([8a2415f](https://github.com/cnpm/npmcore/commit/8a2415f5a7e3e6ac5fb8df48ae2c2bd51ebf460e))

## [3.2.0](https://github.com/cnpm/npmcore/compare/v3.1.2...v3.2.0) (2023-01-28)


### Features

* update index json ([#379](https://github.com/cnpm/npmcore/issues/379)) ([bce6e79](https://github.com/cnpm/npmcore/commit/bce6e7971f21a9a3bad9a70d85214ce04462f0c4))

## [3.1.2](https://github.com/cnpm/npmcore/compare/v3.1.1...v3.1.2) (2023-01-28)


### Bug Fixes

* binary path ([#381](https://github.com/cnpm/npmcore/issues/381)) ([790621b](https://github.com/cnpm/npmcore/commit/790621b4b941f06ac075423c139c365bd440fb9e))

## [3.1.1](https://github.com/cnpm/npmcore/compare/v3.1.0...v3.1.1) (2023-01-18)


### Bug Fixes

* not exists binary should return 404 ([#377](https://github.com/cnpm/npmcore/issues/377)) ([0cc348d](https://github.com/cnpm/npmcore/commit/0cc348dd6e92ef8666d98991e8a6135a267ac2a6))

## [3.1.0](https://github.com/cnpm/npmcore/compare/v3.0.1...v3.1.0) (2023-01-18)


### Features

* support auto sync when package not found ([#337](https://github.com/cnpm/npmcore/issues/337)) ([8734413](https://github.com/cnpm/npmcore/commit/873441374fa67c2ec827ad7b9157d6f2f5dec217)), closes [#335](https://github.com/cnpm/npmcore/issues/335) [/github.com/cnpm/cnpmcore/pull/50/files#diff-97cbafa75ed0bae6a1f0a2df0676c00f56b9cf8944b04ddb82d6dd0ab141961](https://github.com/cnpm//github.com/cnpm/cnpmcore/pull/50/files/issues/diff-97cbafa75ed0bae6a1f0a2df0676c00f56b9cf8944b04ddb82d6dd0ab141961)

## [3.0.1](https://github.com/cnpm/npmcore/compare/v3.0.0...v3.0.1) (2023-01-18)


### Bug Fixes

* try to show latest version on sync log ([#375](https://github.com/cnpm/npmcore/issues/375)) ([1c64a57](https://github.com/cnpm/npmcore/commit/1c64a57dbe65f062751b11df7e5aa698e8fb1c77))

## [3.0.0](https://github.com/cnpm/npmcore/compare/v2.10.1...v3.0.0) (2023-01-17)


### ⚠ BREAKING CHANGES

* use SingletonProto instead of ContextProto

Co-authored-by: killagu <killa123@126.com>

### Code Refactoring

* use tegg v3 ([#370](https://github.com/cnpm/npmcore/issues/370)) ([8e3acae](https://github.com/cnpm/npmcore/commit/8e3acaead9d0b9d54f0d62444d51d8a34e0842ef))

## [2.10.1](https://github.com/cnpm/npmcore/compare/v2.10.0...v2.10.1) (2023-01-08)


### Bug Fixes

* export _cnpmcore_publish_time on abbreviated manifests ([#374](https://github.com/cnpm/npmcore/issues/374)) ([4bceac5](https://github.com/cnpm/npmcore/commit/4bceac5a4c94f8e8624ae1113ad1c5e69a5a2ae1))

## [2.10.0](https://github.com/cnpm/npmcore/compare/v2.9.1...v2.10.0) (2023-01-05)


### Features

* unpublish pkg when upstream block ([#372](https://github.com/cnpm/npmcore/issues/372)) ([7e419c1](https://github.com/cnpm/npmcore/commit/7e419c1fb4fe297adea86cb5d9eae4c8e77e2aec))

## [2.9.1](https://github.com/cnpm/npmcore/compare/v2.9.0...v2.9.1) (2022-12-17)


### Bug Fixes

* Auto enable npm publish on github action ([3d366dd](https://github.com/cnpm/npmcore/commit/3d366dd996161f8f08ae43bde29b7768f5a5241c))
* fix tsc:prod ([ca78d00](https://github.com/cnpm/npmcore/commit/ca78d00f28930180a9374c01d2a9b3b47d6e9db3))
