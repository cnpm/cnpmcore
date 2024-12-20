import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { EggAppConfig, PowerPartial } from 'egg';
import OSSClient from 'oss-cnpm';
import { patchAjv } from '../app/port/typebox';
import { ChangesStreamMode, NOT_IMPLEMENTED_PATH, SyncDeleteMode, SyncMode } from '../app/common/constants';
import type { CnpmcoreConfig } from '../app/port/config';
import { database } from './database';

export const cnpmcoreConfig: CnpmcoreConfig = {
  name: 'cnpm',
  hookEnable: false,
  hooksLimit: 20,
  sourceRegistry: 'https://registry.npmjs.org',
  sourceRegistryIsCNpm: false,
  syncUpstreamFirst: false,
  sourceRegistrySyncTimeout: 180000,
  taskQueueHighWaterSize: 100,
  syncMode: SyncMode.none,
  syncDeleteMode: SyncDeleteMode.delete,
  syncPackageWorkerMaxConcurrentTasks: 10,
  triggerHookWorkerMaxConcurrentTasks: 10,
  createTriggerHookWorkerMaxConcurrentTasks: 10,
  syncPackageBlockList: [],
  enableCheckRecentlyUpdated: true,
  enableSyncBinary: false,
  syncBinaryFromAPISource: '',
  enableSyncDownloadData: false,
  syncDownloadDataSourceRegistry: '',
  syncDownloadDataMaxDate: '',
  enableChangesStream: false,
  checkChangesStreamInterval: 500,
  changesStreamRegistry: 'https://replicate.npmjs.com',
  changesStreamRegistryMode: ChangesStreamMode.streaming,
  registry: process.env.CNPMCORE_CONFIG_REGISTRY || 'http://localhost:7001',
  alwaysAuth: false,
  allowScopes: [
    '@cnpm',
    '@cnpmcore',
    '@example',
  ],
  allowPublishNonScopePackage: false,
  allowPublicRegistration: true,
  admins: {
    cnpmcore_admin: 'admin@cnpmjs.org',
  },
  enableWebAuthn: !!process.env.CNPMCORE_CONFIG_ENABLE_WEB_AUTHN,
  enableCDN: false,
  cdnCacheControlHeader: 'public, max-age=300',
  cdnVaryHeader: 'Accept, Accept-Encoding',
  enableStoreFullPackageVersionManifestsToDatabase: false,
  enableNpmClientAndVersionCheck: true,
  syncNotFound: false,
  redirectNotFound: true,
  enableUnpkg: true,
  enableSyncUnpkgFiles: true,
  enableSyncUnpkgFilesWhiteList: false,
  strictSyncSpecivicVersion: false,
  enableElasticsearch: !!process.env.CNPMCORE_CONFIG_ENABLE_ES,
  elasticsearchIndex: 'cnpmcore_packages',
  strictValidateTarballPkg: false,
  strictValidatePackageDeps: false,
  database: {
    type: database.type,
  },
};

export default (appInfo: EggAppConfig) => {
  const config = {} as PowerPartial<EggAppConfig>;

  config.keys = process.env.CNPMCORE_EGG_KEYS || randomUUID();
  config.cnpmcore = cnpmcoreConfig;

  // override config from framework / plugin
  config.dataDir = process.env.CNPMCORE_DATA_DIR || join(appInfo.root, '.cnpmcore');
  config.orm = {
    ...database,
    database: database.name ?? 'cnpmcore',
    charset: 'utf8mb4',
    logger: {
      // https://github.com/cyjake/leoric/blob/master/docs/zh/logging.md#logqueryerror
      // ignore query error
      logQueryError() {},
      // logQueryError(...args: any[]) {
      //   console.log(args);
      // },
    },
  };

  config.redis = {
    client: {
      port: Number(process.env.CNPMCORE_REDIS_PORT || 6379),
      host: process.env.CNPMCORE_REDIS_HOST || '127.0.0.1',
      password: process.env.CNPMCORE_REDIS_PASSWORD || '',
      db: Number(process.env.CNPMCORE_REDIS_DB || 0),
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
    // https://github.com/koajs/cors/blob/master/index.js#L10C57-L10C64
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
  };

  config.nfs = {
    client: null,
    dir: process.env.CNPMCORE_NFS_DIR || join(config.dataDir, 'nfs'),
  };
  /* c8 ignore next 17 */
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
  } else if (process.env.CNPMCORE_NFS_TYPE === 's3') {
    assert(process.env.CNPMCORE_NFS_S3_CLIENT_ENDPOINT, 'require env CNPMCORE_NFS_S3_CLIENT_ENDPOINT');
    assert(process.env.CNPMCORE_NFS_S3_CLIENT_ID, 'require env CNPMCORE_NFS_S3_CLIENT_ID');
    assert(process.env.CNPMCORE_NFS_S3_CLIENT_SECRET, 'require env CNPMCORE_NFS_S3_CLIENT_SECRET');
    assert(process.env.CNPMCORE_NFS_S3_CLIENT_BUCKET, 'require env CNPMCORE_NFS_S3_CLIENT_BUCKET');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const S3Client = require('s3-cnpmcore');
    config.nfs.client = new S3Client({
      region: process.env.CNPMCORE_NFS_S3_CLIENT_REGION || 'default',
      endpoint: process.env.CNPMCORE_NFS_S3_CLIENT_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CNPMCORE_NFS_S3_CLIENT_ID,
        secretAccessKey: process.env.CNPMCORE_NFS_S3_CLIENT_SECRET,
      },
      bucket: process.env.CNPMCORE_NFS_S3_CLIENT_BUCKET,
      forcePathStyle: !!process.env.CNPMCORE_NFS_S3_CLIENT_FORCE_PATH_STYLE,
      disableURL: !!process.env.CNPMCORE_NFS_S3_CLIENT_DISABLE_URL,
    });
  }

  config.logger = {
    enablePerformanceTimer: true,
    enableFastContextLogger: true,
    appLogName: process.env.CNPMCORE_APP_LOG_NAME || `${appInfo.name}-web.log`,
    coreLogName: process.env.CNPMCORE_CORE_LOG_NAME || 'egg-web.log',
    agentLogName: process.env.CNPMCORE_AGENT_LOG_NAME || 'egg-agent.log',
    errorLogName: process.env.CNPMCORE_ERROR_LOG_NAME || 'common-error.log',
    outputJSON: Boolean(process.env.CNPMCORE_LOG_JSON_OUTPUT || false),
  };
  if (process.env.CNPMCORE_LOG_DIR) {
    config.logger.dir = process.env.CNPMCORE_LOG_DIR;
  }
  if (process.env.CNPMCORE_LOG_JSON_OUTPUT) {
    config.logger.outputJSON = Boolean(process.env.CNPMCORE_LOG_JSON_OUTPUT);
  }

  config.logrotator = {
    // only keep 1 days log files
    maxDays: 1,
  };

  config.bodyParser = {
    // saveTag will send version string in JSON format
    strict: false,
    // set default limit to 10mb, see https://github.com/npm/npm/issues/12750
    jsonLimit: '10mb',
    // https://github.com/cnpm/cnpmcore/issues/551
    ignore: NOT_IMPLEMENTED_PATH,
  };

  // https://github.com/xiekw2010/egg-typebox-validate#%E5%A6%82%E4%BD%95%E5%86%99%E8%87%AA%E5%AE%9A%E4%B9%89%E6%A0%A1%E9%AA%8C%E8%A7%84%E5%88%99
  config.typeboxValidate = { patchAjv };

  config.httpclient = {
    useHttpClientNext: true,
    allowH2: true,
  };

  config.view = {
    root: join(appInfo.baseDir, 'app/port'),
    defaultViewEngine: 'nunjucks',
  };

  config.customLogger = {
    sqlLogger: {
      file: 'sql.log',
    },
  };

  // more options: https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html
  if (config.cnpmcore.enableElasticsearch) {
    config.elasticsearch = {
      client: {
        node: process.env.CNPMCORE_CONFIG_ES_CLIENT_NODE,
        auth: {
          username: process.env.CNPMCORE_CONFIG_ES_CLIENT_AUTH_USERNAME as string,
          password: process.env.CNPMCORE_CONFIG_ES_CLIENT_AUTH_PASSWORD as string,
        },
      },
    };
  }

  return config;
};
