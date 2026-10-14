import { join } from 'node:path';

import Mock from '@elastic/elasticsearch-mock';
import type { PartialEggConfig, EggAppInfo } from 'egg';

import { database } from './database.ts';

// @ts-expect-error has no construct signatures
export const mockES = new Mock();

export default function startConfig(appInfo: EggAppInfo): PartialEggConfig {
  const config = {} as PartialEggConfig;

  // database.name already includes per-worker pool ID suffix from database.ts
  const dbName = database.name ?? 'cnpmcore_unittest';

  config.dataDir = join(appInfo.root, `.${dbName}`);

  config.orm = {
    database: dbName,
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
