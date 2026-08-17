import { Attribute, Model } from 'egg/orm';

import { Bone, DataTypes } from '../util/leoric.ts';

@Model()
export class PackageVersionDownload extends Bone {
  @Attribute(DataTypes.BIGINT(20).UNSIGNED, {
    primary: true,
    autoIncrement: true,
  })
  declare id: bigint;

  @Attribute(DataTypes.DATE, { name: 'gmt_create' })
  declare createdAt: Date;

  @Attribute(DataTypes.DATE, { name: 'gmt_modified' })
  declare updatedAt: Date;

  @Attribute(DataTypes.STRING(24))
  declare packageId: string;

  @Attribute(DataTypes.STRING(256))
  declare version: string;

  // should be YYYYMM format in number type, e.g.: 202112, 202212, 204510
  @Attribute(DataTypes.INTEGER)
  declare yearMonth: number;

  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd01' })
  declare d01: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd02' })
  declare d02: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd03' })
  declare d03: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd04' })
  declare d04: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd05' })
  declare d05: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd06' })
  declare d06: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd07' })
  declare d07: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd08' })
  declare d08: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd09' })
  declare d09: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd10' })
  declare d10: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd11' })
  declare d11: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd12' })
  declare d12: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd13' })
  declare d13: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd14' })
  declare d14: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd15' })
  declare d15: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd16' })
  declare d16: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd17' })
  declare d17: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd18' })
  declare d18: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd19' })
  declare d19: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd20' })
  declare d20: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd21' })
  declare d21: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd22' })
  declare d22: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd23' })
  declare d23: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd24' })
  declare d24: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd25' })
  declare d25: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd26' })
  declare d26: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd27' })
  declare d27: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd28' })
  declare d28: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd29' })
  declare d29: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd30' })
  declare d30: number;
  @Attribute(DataTypes.INTEGER(11).UNSIGNED, { name: 'd31' })
  declare d31: number;
}
