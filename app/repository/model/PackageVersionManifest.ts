import { Attribute, Model } from '@eggjs/tegg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class PackageVersionManifest extends Bone {
  @Attribute(DataTypes.BIGINT, {
    primary: true,
    autoIncrement: true,
  })
  id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  updatedAt: Date;

  @Attribute(DataTypes.STRING(24))
  packageId: string;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  packageVersionId: string;

  @Attribute(DataTypes.STRING(24), {
    unique: true,
  })
  packageVersionManifestId: string;

  @Attribute(DataTypes.JSONB)
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  manifest: any;
}
