import { Type, type Static } from 'egg-typebox-validate/typebox';
import semver from 'semver';
import npa from 'npm-package-arg';
import { uniq } from 'lodash-es';
import type { Ajv } from 'egg-typebox-validate';

import { RegistryType } from '../common/enum/Registry.js';
import { HookType } from '../common/enum/Hook.js';
import binaryConfig, { type BinaryName } from '../../config/binaries.js';

export const Name = Type.String({
  transform: ['trim'],
});

export const Url = Type.String({
  transform: ['trim'],
  minLength: 1,
  maxLength: 2048,
});

export const Secret = Type.String({
  transform: ['trim'],
  minLength: 1,
  maxLength: 200,
});

export const HookName = Type.String({
  transform: ['trim'],
  minLength: 1,
  maxLength: 428,
});

export const HookTypeType = Type.Enum(HookType);

export const BinaryNameRule = Type.String({
  format: 'binary-name',
  transform: ['trim'],
  minLength: 1,
  maxLength: 220,
});

// `[ -~]` matches all printable ASCII characters
// https://catonmat.net/my-favorite-regex
export const BinarySubpathRule = Type.RegEx(/^[ -~]{1,1024}$/);

export const Tag = Type.String({
  format: 'semver-tag',
  transform: ['trim'],
  minLength: 1,
  maxLength: 214,
});
// min: 0.0.0
export const Version = Type.String({
  format: 'semver-version',
  transform: ['trim'],
  minLength: 5,
  maxLength: 256,
});

export const VersionStringArray = Type.String({
  format: 'unique-semver-version-array',
  transform: ['trim'],
});

export const Spec = Type.String({
  format: 'semver-spec',
  minLength: 1,
});

export const Description = Type.String({
  maxLength: 10_240,
  transform: ['trim'],
});

export const TagRule = Type.Object({
  tag: Tag,
});
export const VersionRule = Type.Object({
  version: Version,
});
export const TagWithVersionRule = Type.Object({
  tag: Tag,
  version: Version,
});

export const SyncPackageTaskRule = Type.Object({
  fullname: Name,
  tips: Type.String({
    transform: ['trim'],
    maxLength: 1024,
  }),
  skipDependencies: Type.Boolean(),
  specificVersions: Type.Optional(VersionStringArray),
  syncDownloadData: Type.Boolean(),
  // force sync immediately, only allow by admin
  force: Type.Boolean(),
  // sync history version
  forceSyncHistory: Type.Boolean(),
  // source registry
  registryName: Type.Optional(Type.String()),
});
export type SyncPackageTaskType = Static<typeof SyncPackageTaskRule>;

export const BlockPackageRule = Type.Object({
  fullname: Name,
  reason: Type.String({
    transform: ['trim'],
    maxLength: 10_240,
  }),
});
export type BlockPackageType = Static<typeof BlockPackageRule>;

export const UpdateHookRequestRule = Type.Object({
  endpoint: Url,
  secret: Secret,
});

export const CreateHookRequestRule = Type.Object({
  endpoint: Url,
  secret: Secret,
  name: HookName,
  type: HookTypeType,
});

// https://github.com/xiekw2010/egg-typebox-validate#%E5%A6%82%E4%BD%95%E5%86%99%E8%87%AA%E5%AE%9A%E4%B9%89%E6%A0%A1%E9%AA%8C%E8%A7%84%E5%88%99
// add custom validate to ajv
export function patchAjv(ajv: Ajv) {
  ajv.addFormat('semver-version', {
    type: 'string',
    validate: (version: string) => {
      return !!semver.valid(version);
    },
  });
  ajv.addFormat('semver-tag', {
    type: 'string',
    validate: (tag: string) => {
      return !semver.validRange(tag);
    },
  });
  ajv.addFormat('semver-spec', {
    type: 'string',
    validate: (spec: string) => {
      try {
        // do not support alias
        // exp: https://unpkg.com/good@npm:cnpmcore@3.17.1/dist/app.js
        return ['tag', 'version', 'range'].includes(npa(spec).type);
      } catch {
        return false;
      }
    },
  });
  ajv.addFormat('binary-name', {
    type: 'string',
    validate: (binaryName: string) => {
      return !!binaryConfig[binaryName as BinaryName];
    },
  });
  ajv.addFormat('unique-semver-version-array', {
    type: 'string',
    validate: (versionStringList: string) => {
      let versionList: string[];
      try {
        versionList = JSON.parse(versionStringList);
      } catch {
        return false;
      }
      if (Array.isArray(versionList)) {
        const isSemver = versionList.every(version => !!semver.valid(version));
        const isUnique = uniq(versionList).length === versionList.length;
        return isSemver && isUnique;
      }
      return false;
    },
  });
}

export const QueryPageOptions = Type.Object({
  pageSize: Type.Optional(
    Type.Number({
      transform: ['trim'],
      minimum: 1,
      maximum: 100,
    })
  ),
  pageIndex: Type.Optional(
    Type.Number({
      transform: ['trim'],
      minimum: 0,
    })
  ),
});

export const RegistryCreateSyncOptions = Type.Object({
  since: Type.Optional(Type.String()),
});

export const RegistryCreateOptions = Type.Object({
  name: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 256,
  }),
  host: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 4096,
  }),
  changeStream: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 4096,
  }),
  userPrefix: Type.Optional(
    Type.String({
      transform: ['trim'],
      minLength: 1,
      maxLength: 256,
    })
  ),
  type: Type.Enum(RegistryType),
  authToken: Type.Optional(
    Type.String({
      transform: ['trim'],
      maxLength: 256,
    })
  ),
});

export const RegistryUpdateOptions = Type.Object({
  name: Type.Optional(
    Type.String({
      transform: ['trim'],
      minLength: 1,
      maxLength: 256,
    })
  ),
  host: Type.Optional(
    Type.String({
      transform: ['trim'],
      minLength: 1,
      maxLength: 4096,
    })
  ),
  changeStream: Type.Optional(
    Type.String({
      transform: ['trim'],
      minLength: 1,
      maxLength: 4096,
    })
  ),
  type: Type.Optional(Type.Enum(RegistryType)),
  authToken: Type.Optional(
    Type.String({
      transform: ['trim'],
      minLength: 1,
      maxLength: 256,
    })
  ),
});

export const ScopeCreateOptions = Type.Object({
  name: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 256,
  }),
  registryId: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 256,
  }),
});

export const ScopeUpdateOptions = Type.Object({
  name: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 256,
  }),
  registryId: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 256,
  }),
  scopeId: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 256,
  }),
});

export const SearchQueryOptions = Type.Object({
  from: Type.Number({
    transform: ['trim'],
    minimum: 0,
    default: 0,
  }),
  size: Type.Number({
    transform: ['trim'],
    minimum: 1,
    default: 20,
  }),
  text: Type.String({
    transform: ['trim'],
    minLength: 1,
    maxLength: 256,
  }),
});
