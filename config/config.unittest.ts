import { join } from 'path';
import { tmpdir } from 'os';
import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config = {} as PowerPartial<EggAppConfig>;
  config.dataDir = join(process.env.HOME || tmpdir(), '.cnpmcore_unittest');

  config.orm = {
    database: process.env.MYSQL_DATABASE || 'cnpmcore_unittest',
  };
  return config;
};
