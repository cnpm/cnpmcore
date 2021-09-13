import { EntityData } from '../entity/Entity';
import ObjectID from 'bson-objectid';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type EasyData<T extends EntityData, Id extends keyof T> = PartialBy<T, 'gmtCreate' | 'gmtModified' | Id>;


export class EntityUtil {
  static defaultData<T extends EntityData, Id extends keyof T>(data: EasyData<T, Id>, id: Id): T {
    Reflect.set(data, id, EntityUtil.createId());
    data.gmtCreate = data.gmtCreate || new Date();
    data.gmtModified = data.gmtModified || new Date();
    return data as T;
  }

  static createId(): string {
    return new ObjectID().toHexString();
  }
}
