import { join } from 'path';
import { EggAppConfig, PowerPartial } from 'egg';

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
  return config;
};
