import { join } from 'path';
import { tmpdir } from 'os';
import { EggAppConfig, PowerPartial } from 'egg';

export default (appInfo: EggAppConfig) => {
  const config = {} as PowerPartial<EggAppConfig>;

  config.cnpmcore = {
    name: 'cnpm',
    sourceRegistry: 'https://registry.npmjs.com',
    registry: 'http://localhost:7001',
  };

  // override config from framework / plugin
  config.keys = appInfo.name + '123456';
  config.dataDir = join(process.env.HOME || tmpdir(), '.cnpmcore');

  config.orm = {
    client: 'mysql',
    database: process.env.MYSQL_DATABASE || 'cnpmcore',
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
  };
  if (process.env.DEBUG_LOCAL_SQL) {
    config.orm.logger = {
      // TODO: try to save SQL log into ctx logger or app logger
      logQuery(sql: string, duration: number) {
        console.log('[%sms] %s', duration, sql);
      },
    };
  }

  config.security = {
    csrf: {
      enable: false,
    },
  };

  config.nfs = {
    client: null,
    dir: join(config.dataDir, 'nfs'),
  };

  config.logger = {
    enablePerformanceTimer: true,
  };

  return config;
};
