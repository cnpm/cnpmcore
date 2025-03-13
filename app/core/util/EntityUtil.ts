import ObjectID from 'bson-objectid';
import { E400 } from 'egg-errors';

import type { EntityData } from '../entity/Entity.js';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EasyData<T extends EntityData, Id extends keyof T> = PartialBy<
  T,
  'createdAt' | 'updatedAt' | Id
>;

const MAX_PAGE_SIZE = 100 as const;
export interface PageOptions {
  pageSize?: number;
  pageIndex?: number;
}
export interface PageResult<T> {
  count: number;
  data: Array<T>;
}
export interface PageLimitOptions {
  offset: number;
  limit: number;
}

export class EntityUtil {
  static defaultData<T extends EntityData, Id extends keyof T>(
    data: EasyData<T, Id>,
    id: Id
  ): T {
    Reflect.set(data, id, EntityUtil.createId());
    data.createdAt = data.createdAt || new Date();
    data.updatedAt = data.updatedAt || new Date();
    return data as T;
  }

  static createId(): string {
    // @ts-expect-error ObjectID has no construct signatures
    return new ObjectID().toHexString();
  }

  static convertPageOptionsToLimitOption(page: PageOptions): PageLimitOptions {
    const { pageIndex = 0, pageSize = 20 } = page;
    if (pageSize > MAX_PAGE_SIZE) {
      throw new E400(`max page size is 100, current request is ${pageSize}`);
    }
    return {
      offset: pageIndex * pageSize,
      limit: pageSize,
    };
  }
}
