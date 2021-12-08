import { Type } from '@sinclair/typebox';

const Tag = Type.String({ transform: [ 'trim' ], minLength: 1, maxLength: 214 });
// min: 0.0.0
const Version = Type.String({ transform: [ 'trim' ], minLength: 5, maxLength: 256 });

export const TagRule = Type.Object({
  tag: Tag,
});
export const TagWithVersionRule = Type.Object({
  tag: Tag,
  version: Version,
});
