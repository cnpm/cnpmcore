import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import { HookType } from '../../common/enum/Hook';
export type CreateHookData = Omit<EasyData<HookData, 'hookId'>, 'enable' | 'latestTaskId'>;

export interface HookData extends EntityData {
  hookId: string;
  type: HookType;
  ownerId: string;
  name: string;
  endpoint: string;
  secret: string;
  latestTaskId?: string;
  enable: boolean;
}

export class Hook extends Entity {
  readonly hookId: string;
  readonly type: HookType;
  readonly ownerId: string;
  readonly name: string;
  endpoint: string;
  secret: string;
  enable: boolean;
  latestTaskId?: string;

  constructor(data: HookData) {
    super(data);
    this.hookId = data.hookId;
    this.type = data.type;
    this.ownerId = data.ownerId;
    this.name = data.name;
    this.endpoint = data.endpoint;
    this.secret = data.secret;
    this.latestTaskId = data.latestTaskId;
    this.enable = data.enable;
  }

  static create(data: CreateHookData): Hook {
    const hookData: EasyData<HookData, 'hookId'> = Object.assign({}, data, {
      enable: true,
      latestTaskId: undefined,
    });
    const newData = EntityUtil.defaultData(hookData, 'hookId');
    return new Hook(newData);
  }
}
