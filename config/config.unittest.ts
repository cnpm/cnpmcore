import { join } from 'node:path';

import Mock from '@elastic/elasticsearch-mock';
import type { PartialEggConfig, EggAppInfo } from 'egg';

import { database, DATABASE_TYPE } from './database.ts';

// @ts-expect-error has no construct signatures
export const mockES = new Mock();

export default function startConfig(appInfo: EggAppInfo): PartialEggConfig {
  const config = {} as PartialEggConfig;
  config.dataDir = join(appInfo.root, '.cnpmcore_unittest');

  const dbName = database.name ?? 'cnpmcore_unittest';
  config.orm = {
    // For SQLite, database is a file path; for others, it's a database name
    database:
      database.type === DATABASE_TYPE.SQLite ? (database.storage ?? join(config.dataDir, `${dbName}.sqlite`)) : dbName,
  };

  config.nfs = {
    dir: join(config.dataDir, 'nfs'),
  };

  config.cnpmcore = {
    checkChangesStreamInterval: 10,
  };

  config.elasticsearch = {
    client: {
      node: 'http://localhost:9200',
      Connection: mockES.getConnection(),
    },
  };

  return config;
}
