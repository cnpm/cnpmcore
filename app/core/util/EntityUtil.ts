import { EntityData } from '../entity/Entity';
import ObjectID from 'bson-objectid';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EasyData<T extends EntityData, Id extends keyof T> = PartialBy<T, 'createdAt' | 'updatedAt' | Id>;


export class EntityUtil {
  static defaultData<T extends EntityData, Id extends keyof T>(data: EasyData<T, Id>, id: Id): T {
    Reflect.set(data, id, EntityUtil.createId());
    data.createdAt = data.createdAt || new Date();
    data.updatedAt = data.updatedAt || new Date();
    return data as T;
  }

  static createId(): string {
    return new ObjectID().toHexString();
  }
}
