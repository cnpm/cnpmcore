import { join } from 'path';
import { tmpdir } from 'os';
import { EggAppConfig, PowerPartial } from 'egg';

export default (/* appInfo: EggAppConfig */) => {
  const config = {} as PowerPartial<EggAppConfig>;

  config.cnpmcore = {
    name: 'cnpm',
    sourceRegistry: 'https://registry.npmjs.com',
    registry: 'http://localhost:7001',
    // https://docs.npmjs.com/cli/v6/using-npm/config#always-auth npm <= 6
    // if `alwaysAuth=true`, all api request required access token
    alwaysAuth: false,
    // white scope list
    allowScopes: [
      '@cnpm',
      '@example',
    ],
    // allow publish non-scope package, disable by default
    allowPublishNonScopePackage: false,
  };

  // override config from framework / plugin
  config.dataDir = join(process.env.HOME || tmpdir(), '.cnpmcore');

  config.orm = {
    client: 'mysql',
    database: process.env.MYSQL_DATABASE || 'cnpmcore',
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD,
    charset: 'utf8mb4',
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

  config.bodyParser = {
    // saveTag will send version string in JSON format
    strict: false,
  };

  return config;
};
