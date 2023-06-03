import dayjs from 'dayjs';
import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

export enum TokenType {
  granular = 'granular',
  classic = 'classic',
}
interface BaseTokenData extends EntityData {
  tokenId: string;
  tokenMark: string;
  tokenKey: string;
  cidrWhitelist?: string[];
  userId: string;
  isReadonly?: boolean;
  type?: TokenType | string;
  lastUsedAt?: Date;
}

interface ClassicTokenData extends BaseTokenData{
  isAutomation?: boolean;
}
interface GranularTokenData extends BaseTokenData {
  name: string;
  description?: string;
  allowedScopes?: string[];
  allowedPackages?: string[];
  expires: number;
  expiredAt: Date;
}

type TokenData = ClassicTokenData | GranularTokenData;

export function isGranularToken(data: TokenData | Token): data is GranularTokenData {
  return data.type === TokenType.granular;
}

export class Token extends Entity {
  readonly tokenId: string;
  readonly tokenMark: string;
  readonly tokenKey: string;
  readonly cidrWhitelist: string[];
  readonly userId: string;
  readonly isReadonly: boolean;
  readonly isAutomation: boolean;
  readonly type?: TokenType;
  readonly name?: string;
  readonly description?: string;
  readonly allowedScopes?: string[];
  readonly expiredAt?: Date;
  readonly expires?: number;
  lastUsedAt: Date | null;
  allowedPackages?: string[];
  token?: string;

  constructor(data: TokenData) {
    super(data);
    this.userId = data.userId;
    this.tokenId = data.tokenId;
    this.tokenMark = data.tokenMark;
    this.tokenKey = data.tokenKey;
    this.cidrWhitelist = data.cidrWhitelist || [];
    this.isReadonly = data.isReadonly || false;
    this.type = (data.type as TokenType) || TokenType.classic;
    this.lastUsedAt = data.lastUsedAt || null;

    if (isGranularToken(data)) {
      this.name = data.name;
      this.description = data.description;
      this.allowedScopes = data.allowedScopes;
      this.expiredAt = data.expiredAt;
      this.allowedPackages = data.allowedPackages;
      this.isAutomation = false;
    } else {
      this.isAutomation = data.isAutomation || false;
    }
  }

  static create(data: EasyData<TokenData, 'tokenId'>): Token {
    const newData = EntityUtil.defaultData(data, 'tokenId');
    if (isGranularToken(newData) && !newData.expiredAt) {
      newData.expiredAt = dayjs(newData.createdAt).add(newData.expires, 'days').toDate();
    }
    return new Token(newData);
  }

}
