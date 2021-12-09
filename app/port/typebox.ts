import { Type } from '@sinclair/typebox';
import semver from 'semver';

export const Name = Type.String({
  transform: [ 'trim' ],
});

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
