import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import { getScopeAndName } from '../../common/PackageUtil';
import { ForbiddenError, UnauthorizedError } from 'egg-errors';

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
  type?: TokenType;
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
}

type TokenData = ClassicTokenData | GranularTokenData;

export function isGranularToken(data: TokenData): data is GranularTokenData {
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
    this.type = data.type || TokenType.classic;

    if (isGranularToken(data)) {
      this.name = data.name;
      this.description = data.description;
      this.allowedScopes = data.allowedScopes;
      this.allowedPackages = data.allowedPackages;
      this.expires = data.expires;
    } else {
      this.isAutomation = data.isAutomation || false;
    }
  }

  static create(data: EasyData<TokenData, 'tokenId'>): Token {
    const newData = EntityUtil.defaultData(data, 'tokenId');
    return new Token(newData);
  }

  static checkGranularTokenAccess(token: Token, fullname: string) {
    // skip classic token
    if (!isGranularToken(token)) {
      return true;
    }

    // check for expires
    if (token.createdAt.getTime() + token.expires! * 1000 * 60 * 60 * 24 < Date.now()) {
      throw new UnauthorizedError('Token expired');
    }

    // check for scope & packages access
    if (!token.allowedPackages && !token.allowedScopes) {
      return true;
    }

    // check for packages whitelist
    const existPkgConfig = token.allowedPackages?.find(pkg => pkg === fullname);
    if (existPkgConfig) {
      return true;
    }

    // check for scope whitelist
    const [ scope ] = getScopeAndName(fullname);
    const existScopeConfig = token.allowedScopes?.find(s => s === scope);
    if (existScopeConfig) {
      return true;
    }

    throw new ForbiddenError(`can't access package "${fullname}"`);

  }
}
