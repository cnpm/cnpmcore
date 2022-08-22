import { Type, Static } from '@sinclair/typebox';
import { RegistryType } from '../common/enum/Registry';
import semver from 'semver';
import { HookType } from '../common/enum/Hook';

export const Name = Type.String({
  transform: [ 'trim' ],
});

export const Url = Type.String({
  transform: [ 'trim' ],
  minLength: 1,
  maxLength: 2048,
});

export const Secret = Type.String({
  transform: [ 'trim' ],
  minLength: 1,
  maxLength: 200,
});

export const HookName = Type.String({
  transform: [ 'trim' ],
  minLength: 1,
  maxLength: 428,
});

export const HookTypeType = Type.Enum(HookType);

export const Tag = Type.String({
  format: 'semver-tag',
  transform: [ 'trim' ],
  minLength: 1,
  maxLength: 214,
});
// min: 0.0.0
export const Version = Type.String({
  format: 'semver-version',
  transform: [ 'trim' ],
  minLength: 5,
  maxLength: 256,
});

export const Description = Type.String({ maxLength: 10240, transform: [ 'trim' ] });

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
    transform: [ 'trim' ],
    maxLength: 1024,
  }),
  skipDependencies: Type.Boolean(),
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
    transform: [ 'trim' ],
    maxLength: 10240,
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
export function patchAjv(ajv: any) {
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
}

export const QueryPageOptions = Type.Object({
  pageSize: Type.Optional(Type.Number({
    transform: [ 'trim' ],
    minimum: 1,
    maximum: 100,
  })),
  pageIndex: Type.Optional(Type.Number({
    transform: [ 'trim' ],
    minimum: 0,
  })),
});

export const RegistryCreateSyncOptions = Type.Object({
  since: Type.Optional(Type.String()),
});

export const RegistryCreateOptions = Type.Object({
  name: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
  host: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 4096,
  }),
  changeStream: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 4096,
  }),
  userPrefix: Type.Optional(Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  })),
  type: Type.Enum(RegistryType),
});

export const RegistryUpdateOptions = Type.Object({
  name: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
  host: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 4096,
  }),
  changeStream: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 4096,
  }),
  userPrefix: Type.Optional(Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  })),
  type: Type.Enum(RegistryType),
  registryId: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
});

export const ScopeCreateOptions = Type.Object({
  name: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
  registryId: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
});

export const ScopeUpdateOptions = Type.Object({
  name: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
  registryId: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
  scopeId: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
});
