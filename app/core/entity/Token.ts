import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

interface TokenData extends EntityData {
  tokenId: string;
  tokenMark: string;
  tokenKey: string;
  cidrWhitelist: string[];
  userId: string;
  isReadonly: boolean;
  isAutomation: boolean;
}

export class Token extends Entity {
  readonly tokenId: string;
  readonly tokenMark: string;
  readonly tokenKey: string;
  readonly cidrWhitelist: string[];
  readonly userId: string;
  readonly isReadonly: boolean;
  readonly isAutomation: boolean;
  token?: string;

  constructor(data: TokenData) {
    super(data);
    this.userId = data.userId;
    this.tokenId = data.tokenId;
    this.tokenMark = data.tokenMark;
    this.tokenKey = data.tokenKey;
    this.cidrWhitelist = data.cidrWhitelist;
    this.isReadonly = data.isReadonly;
    this.isAutomation = data.isAutomation;
  }

  static create(data: EasyData<TokenData, 'tokenId'>): Token {
    const newData = EntityUtil.defaultData(data, 'tokenId');
    return new Token(newData);
  }
}
