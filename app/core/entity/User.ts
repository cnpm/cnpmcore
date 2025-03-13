import type { EntityData } from './Entity.js';
import { Entity } from './Entity.js';
import type { EasyData } from '../util/EntityUtil.js';
import { EntityUtil } from '../util/EntityUtil.js';
import { cleanUserPrefix } from '../../common/PackageUtil.js';

interface UserData extends EntityData {
  userId: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordIntegrity: string;
  ip: string;
  isPrivate: boolean;
  scopes?: string[];
}

export class User extends Entity {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  passwordSalt: string;
  passwordIntegrity: string;
  ip: string;
  isPrivate: boolean;
  scopes?: string[];

  constructor(data: UserData) {
    super(data);
    this.userId = data.userId;
    this.name = data.name;
    this.displayName = cleanUserPrefix(this.name);
    this.email = data.email;
    this.passwordSalt = data.passwordSalt;
    this.passwordIntegrity = data.passwordIntegrity;
    this.ip = data.ip;
    this.isPrivate = data.isPrivate;
    this.scopes = data.scopes;
  }

  static create(data: EasyData<UserData, 'userId'>): User {
    const newData = EntityUtil.defaultData(data, 'userId');
    return new User(newData);
  }
}
