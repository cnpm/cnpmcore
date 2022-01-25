import assert from 'assert';
import { join } from 'path';
import { EggAppConfig, PowerPartial } from 'egg';
import OSSClient from 'oss-cnpm';
import { patchAjv } from '../app/port/typebox';

export default (appInfo: EggAppConfig) => {
  const config = {} as PowerPartial<EggAppConfig>;

  config.cnpmcore = {
    name: 'cnpm',
    sourceRegistry: 'https://registry.npmjs.org',
    // upstream registry is base on `cnpmcore` or not
    // if your upstream is official npm registry, please turn it off
    sourceRegistryIsCNpm: false,
    // 3 mins
    sourceRegistrySyncTimeout: 180000,
    // sync mode
    //  - none: don't sync npm package, just redirect it to sourceRegistry
    //  - all: sync all npm packages
    syncMode: 'none',
    syncPackageWorkerMaxConcurrentTasks: 10,
    // stop syncing these packages in future
    syncPackageBlockList: [],
    // mirror binary, default is false
    enableSyncBinary: false,
    // old cnpm mirror: https://cnpmjs.org/mirrors/apis
    // new cnpmcore api: https://r.cnpmjs.org/-/binary
    syncBinaryFromAPISource: '',
    // enable sync downloads data from source registry https://github.com/cnpm/cnpmcore/issues/108
    // all three parameters must be configured at the same time to take effect
    enableSyncDownloadData: false,
    syncDownloadDataSourceRegistry: '',
    syncDownloadDataMaxDate: '', // should be YYYY-MM-DD format
    // https://github.com/npm/registry-follower-tutorial
    enableChangesStream: false,
    checkChangesStreamInterval: 500,
    changesStreamRegistry: 'https://replicate.npmjs.com',
    registry: 'http://localhost:7001',
    // https://docs.npmjs.com/cli/v6/using-npm/config#always-auth npm <= 6
    // if `alwaysAuth=true`, all api request required access token
    alwaysAuth: false,
    // white scope list
    allowScopes: [
      '@cnpm',
      '@cnpmcore',
      '@example',
    ],
    // allow publish non-scope package, disable by default
    allowPublishNonScopePackage: false,
    // Public registration is allowed, otherwise only admins can login
    allowPublicRegistration: true,
    // default system admins
    admins: {
      // name: email
      cnpmcore_admin: 'admin@cnpmjs.org',
    },
  };

  // override config from framework / plugin
  config.dataDir = join(appInfo.root, '.cnpmcore');

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

  config.redis = {
    client: {
      port: 6379,
      host: '127.0.0.1',
      password: '',
      db: 0,
    },
  };

  config.security = {
    csrf: {
      enable: false,
    },
  };

  config.cors = {
    // allow all domains
    origin: (ctx): string => {
      return ctx.get('Origin');
    },
    credentials: true,
  };

  config.nfs = {
    client: null,
    dir: join(config.dataDir, 'nfs'),
  };
  // enable oss nfs store by env values
  if (process.env.CNPMCORE_NFS_TYPE === 'oss') {
    assert(process.env.CNPMCORE_NFS_OSS_BUCKET, 'require env CNPMCORE_NFS_OSS_BUCKET');
    assert(process.env.CNPMCORE_NFS_OSS_ENDPOINT, 'require env CNPMCORE_NFS_OSS_ENDPOINT');
    assert(process.env.CNPMCORE_NFS_OSS_ID, 'require env CNPMCORE_NFS_OSS_ID');
    assert(process.env.CNPMCORE_NFS_OSS_SECRET, 'require env CNPMCORE_NFS_OSS_SECRET');
    config.nfs.client = new OSSClient({
      cdnBaseUrl: process.env.CNPMCORE_NFS_OSS_CDN,
      endpoint: process.env.CNPMCORE_NFS_OSS_ENDPOINT,
      bucket: process.env.CNPMCORE_NFS_OSS_BUCKET,
      accessKeyId: process.env.CNPMCORE_NFS_OSS_ID,
      accessKeySecret: process.env.CNPMCORE_NFS_OSS_SECRET,
      defaultHeaders: {
        'Cache-Control': 'max-age=0, s-maxage=60',
      },
    });
  }

  config.logger = {
    enablePerformanceTimer: true,
  };

  config.logrotator = {
    // only keep 3 days log files
    maxDays: 3,
  };

  config.bodyParser = {
    // saveTag will send version string in JSON format
    strict: false,
  };

  // https://github.com/xiekw2010/egg-typebox-validate#%E5%A6%82%E4%BD%95%E5%86%99%E8%87%AA%E5%AE%9A%E4%B9%89%E6%A0%A1%E9%AA%8C%E8%A7%84%E5%88%99
  config.typeboxValidate = { patchAjv };
  return config;
};
