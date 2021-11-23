import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config = {} as PowerPartial<EggAppConfig>;

  config.orm = {
    database: process.env.MYSQL_DATABASE || 'cnpmcore_unittest',
  };
  return config;
};
