import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';


export enum TokenType {
  granular = 'granular',
  classic = 'classic',
}
interface ClassicTokenData extends EntityData {
  tokenId: string;
  tokenMark: string;
  tokenKey: string;
  cidrWhitelist?: string[];
  userId: string;
  isReadonly?: boolean;
  isAutomation?: boolean;
  type?: TokenType;
}

interface GranularTokenData extends ClassicTokenData {
  name: string;
  description?: string;
  allowedScopes?: string[];
  allowedPackages?: string[];
  expires: number;
}

type TokenData = ClassicTokenData | GranularTokenData;

function isGranularToken (data: ClassicTokenData): data is GranularTokenData {
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
  readonly allowedPackages?: string[];
  readonly expires?: number;
  token?: string;

  constructor(data: TokenData) {
    super(data);
    this.userId = data.userId;
    this.tokenId = data.tokenId;
    this.tokenMark = data.tokenMark;
    this.tokenKey = data.tokenKey;
    this.cidrWhitelist = data.cidrWhitelist || [];
    this.isReadonly = data.isReadonly || false;
    this.isAutomation = data.isAutomation || false;
    this.type = data.type || TokenType.classic;

    if (isGranularToken(data)) {
      this.name = data.name;
      this.description = data.description;
      this.allowedScopes = data.allowedScopes;
      this.allowedPackages = data.allowedPackages;
      this.expires = data.expires;
    }
  }

  static create(data: EasyData<TokenData, 'tokenId'>): Token {
    const newData = EntityUtil.defaultData(data, 'tokenId');
    return new Token(newData);
  }
}
