export interface EntityData {
  id?: bigint;
  updatedAt: Date;
  createdAt: Date;
}

export class Entity {
  id?: bigint;
  updatedAt: Date;
  readonly createdAt: Date;

  constructor(data: EntityData) {
    this.id = data.id;
    this.updatedAt = data.updatedAt;
    this.createdAt = data.createdAt;
  }
}
