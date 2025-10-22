import crypto from 'node:crypto';

import { Entity, type EntityData } from './Entity.ts';
import { EntityUtil, type EasyData } from '../util/EntityUtil.ts';
import type { HookType } from '../../common/enum/Hook.ts';

export type CreateHookData = Omit<
  EasyData<HookData, 'hookId'>,
  'enable' | 'latestTaskId'
>;

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
    const hookData: EasyData<HookData, 'hookId'> = {
      ...data,
      enable: true,
      latestTaskId: undefined,
    };
    const newData = EntityUtil.defaultData(hookData, 'hookId');
    return new Hook(newData);
  }

  // payload 可能会特别大，如果做多次 stringify 浪费太多 cpu
  signPayload(payload: object) {
    const payloadStr = JSON.stringify(payload);
    const digest = crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return {
      digest,
      payloadStr,
    };
  }
}
