import { join } from 'node:path';
import type { EggAppConfig, PowerPartial } from 'egg';
import Mock from '@elastic/elasticsearch-mock';

import { database } from './database.js';

// @ts-expect-error has no construct signatures
export const mockES = new Mock();

export default function startConfig(appInfo: EggAppConfig) {
  const config = {} as PowerPartial<EggAppConfig>;
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
