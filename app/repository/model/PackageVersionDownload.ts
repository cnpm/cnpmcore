import { Attribute, Model } from '@eggjs/tegg/orm';

import { Bone, DataTypes } from '../util/leoric.js';

@Model()
export class PackageVersionDownload extends Bone {
  @Attribute(DataTypes.BIGINT(20).UNSIGNED, {
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

  @Attribute(DataTypes.STRING(256))
  version: string;

  // should be YYYYMM format in number type, e.g.: 202112, 202212, 204510
  @Attribute(DataTypes.INTEGER)
  yearMonth: number;

  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd01' })
  d01: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd02' })
  d02: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd03' })
  d03: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd04' })
  d04: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd05' })
  d05: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd06' })
  d06: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd07' })
  d07: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd08' })
  d08: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd09' })
  d09: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd10' })
  d10: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd11' })
  d11: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd12' })
  d12: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd13' })
  d13: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd14' })
  d14: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd15' })
  d15: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd16' })
  d16: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd17' })
  d17: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd18' })
  d18: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd19' })
  d19: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd20' })
  d20: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd21' })
  d21: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd22' })
  d22: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd23' })
  d23: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd24' })
  d24: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd25' })
  d25: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd26' })
  d26: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd27' })
  d27: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd28' })
  d28: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd29' })
  d29: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd30' })
  d30: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd31' })
  d31: number;
}
