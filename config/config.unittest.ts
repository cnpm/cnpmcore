import { join } from 'path';
import { EggAppConfig, PowerPartial } from 'egg';
import Mock from '@elastic/elasticsearch-mock';

export const mockES = new Mock();

export default (appInfo: EggAppConfig) => {
  const config = {} as PowerPartial<EggAppConfig>;
  config.dataDir = join(appInfo.root, '.cnpmcore_unittest');

  config.orm = {
    database: process.env.MYSQL_DATABASE || 'cnpmcore_unittest',
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
};
