import { join } from 'node:path';

import Mock from '@elastic/elasticsearch-mock';
import type { PartialEggConfig, EggAppInfo } from 'egg';

import { database } from './database.ts';

// @ts-expect-error has no construct signatures
export const mockES = new Mock();

export default function startConfig(appInfo: EggAppInfo): PartialEggConfig {
  const config = {} as PartialEggConfig;
  config.dataDir = join(appInfo.root, '.cnpmcore_unittest');

  config.orm = {
    database: database.name ?? 'cnpmcore_unittest',
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
