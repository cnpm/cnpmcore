export interface EntityData {
  id?: bigint;
  gmtModified: Date;
  gmtCreate: Date;
}

export class Entity {
  id?: bigint;
  gmtModified: Date;

  readonly gmtCreate: Date;

  constructor(data: EntityData) {
    this.id = data.id;
    this.gmtCreate = data.gmtCreate;
    this.gmtModified = data.gmtModified;
  }
}
