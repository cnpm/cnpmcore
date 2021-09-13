import { EggAppConfig, PowerPartial } from 'egg';

export default (appInfo: EggAppConfig) => {
  const config = {} as PowerPartial<EggAppConfig>;

  // override config from framework / plugin
  config.keys = appInfo.name + '123456';

  config.orm = {
    client: 'mysql',
    database: 'cnpmcore',
    host: 'localhost',
    port: 3306,
    user: 'root',
  };

  return config;
};
