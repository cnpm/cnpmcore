import {
  AccessLevel,
  EggObjectLifecycle,
  Inject,
  SingletonProto,
} from '@eggjs/tegg';
import { LeoricRegister } from '@eggjs/tegg-orm-plugin/lib/LeoricRegister';
import { EggAppConfig } from 'egg';
import Realm, { Bone } from 'leoric';

@SingletonProto({
  name: 'rawQueryUtil',
  accessLevel: AccessLevel.PUBLIC,
})
export class RawQueryUtil implements EggObjectLifecycle {
  @Inject()
  private leoricRegister: LeoricRegister;

  @Inject()
  private config: EggAppConfig;

  private client: Realm;

  async init() {
    this.client = await this.leoricRegister.getOrCreateRealm(undefined);
  }

  public async getCount(model: typeof Bone): Promise<number> {
    const { database } = this.config.orm;
    const sql = `
      SELECT
          table_rows
        FROM
          information_schema.tables
        WHERE
          table_schema = '${database}'
          AND table_name = '${model.table}'
    `;
    const queryRes = await this.client.query(sql);
    return queryRes.rows?.[0]?.TABLE_ROWS as number || 0;
  }

}
