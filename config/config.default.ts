import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Context, EggAppConfig, PowerPartial } from 'egg';
import OSSClient from 'oss-cnpm';
import S3Client from 's3-cnpmcore';
import { env } from 'read-env-value';

import { patchAjv } from '../app/port/typebox.js';
import {
  ChangesStreamMode,
  NOT_IMPLEMENTED_PATH,
  SyncDeleteMode,
  SyncMode,
} from '../app/common/constants.js';
import type { CnpmcoreConfig } from '../app/port/config.js';
import { database } from './database.js';

export const cnpmcoreConfig: CnpmcoreConfig = {
  name: 'cnpm',
  hookEnable: false,
  hooksLimit: 20,
  sourceRegistry: env(
    'CNPMCORE_CONFIG_SOURCE_REGISTRY',
    'string',
    'https://registry.npmjs.org'
  ),
  sourceRegistryIsCNpm: env(
    'CNPMCORE_CONFIG_SOURCE_REGISTRY_IS_CNPM',
    'boolean',
    false
  ),
  syncUpstreamFirst: false,
  sourceRegistrySyncTimeout: 180_000,
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
  changesStreamRegistry: 'https://replicate.npmjs.com/registry',
  changesStreamRegistryMode: ChangesStreamMode.streaming,
  registry: env('CNPMCORE_CONFIG_REGISTRY', 'string', 'http://localhost:7001'),
  alwaysAuth: false,
  allowScopes: ['@cnpm', '@cnpmcore', '@example'],
  allowPublishNonScopePackage: false,
  allowPublicRegistration: false,
  admins: {
    cnpmcore_admin: 'admin@cnpmjs.org',
  },
  enableWebAuthn: env('CNPMCORE_CONFIG_ENABLE_WEB_AUTHN', 'boolean', false),
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
  enableElasticsearch: env('CNPMCORE_CONFIG_ENABLE_ES', 'boolean', false),
  elasticsearchIndex: 'cnpmcore_packages',
  strictValidateTarballPkg: false,
  strictValidatePackageDeps: false,
  database: {
    type: database.type,
  },
};

export interface NFSConfig {
  client: unknown;
  dir: string;
  removeBeforeUpload: boolean;
}

export type Config = PowerPartial<EggAppConfig> & { nfs: NFSConfig };

export default function startConfig(appInfo: EggAppConfig) {
  const config = {} as Config;

  config.keys = env('CNPMCORE_EGG_KEYS', 'string', randomUUID());
  config.cnpmcore = cnpmcoreConfig;

  // override config from framework / plugin
  config.dataDir = env(
    'CNPMCORE_DATA_DIR',
    'string',
    join(appInfo.root, '.cnpmcore')
  );
  config.orm = {
    ...database,
    database: database.name ?? 'cnpmcore',
    charset: 'utf8mb4',
    logger: {
      // https://github.com/cyjake/leoric/blob/master/docs/zh/logging.md#logqueryerror
      // ignore query error
      logQueryError() {
        // do nothing
      },
      // logQueryError(...args: any[]) {
      //   console.log(args);
      // },
    },
  };

  config.redis = {
    client: {
      port: env('CNPMCORE_REDIS_PORT', 'number', 6379),
      host: env('CNPMCORE_REDIS_HOST', 'string', '127.0.0.1'),
      password: env('CNPMCORE_REDIS_PASSWORD', 'string', ''),
      db: env('CNPMCORE_REDIS_DB', 'number', 0),
    },
  };

  config.security = {
    csrf: {
      enable: false,
    },
  };

  config.cors = {
    // allow all domains
    origin: (ctx: Context): string => {
      return ctx.get('Origin');
    },
    credentials: true,
    // https://github.com/koajs/cors/blob/master/index.js#L10C57-L10C64
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
  };

  config.nfs = {
    client: null,
    dir: env('CNPMCORE_NFS_DIR', 'string', join(config.dataDir, 'nfs')),
    removeBeforeUpload: env(
      'CNPMCORE_NFS_REMOVE_BEFORE_UPLOAD',
      'boolean',
      false
    ),
  };
  /* c8 ignore next 17 */
  // enable oss nfs store by env values
  const nfsType = env('CNPMCORE_NFS_TYPE', 'string', '');
  if (nfsType === 'oss') {
    const ossConfig = {
      cdnBaseUrl: env('CNPMCORE_NFS_OSS_CDN', 'string', ''),
      endpoint: env('CNPMCORE_NFS_OSS_ENDPOINT', 'string', ''),
      bucket: env('CNPMCORE_NFS_OSS_BUCKET', 'string', ''),
      accessKeyId: env('CNPMCORE_NFS_OSS_ID', 'string', ''),
      accessKeySecret: env('CNPMCORE_NFS_OSS_SECRET', 'string', ''),
      defaultHeaders: {
        'Cache-Control': 'max-age=0, s-maxage=60',
      },
    };
    assert.ok(ossConfig.bucket, 'require env CNPMCORE_NFS_OSS_BUCKET');
    assert.ok(ossConfig.endpoint, 'require env CNPMCORE_NFS_OSS_ENDPOINT');
    assert.ok(ossConfig.accessKeyId, 'require env CNPMCORE_NFS_OSS_ID');
    assert.ok(ossConfig.accessKeySecret, 'require env CNPMCORE_NFS_OSS_SECRET');
    config.nfs.client = new OSSClient(ossConfig);
  } else if (nfsType === 's3') {
    const s3Config = {
      region: env('CNPMCORE_NFS_S3_CLIENT_REGION', 'string', 'default'),
      endpoint: env('CNPMCORE_NFS_S3_CLIENT_ENDPOINT', 'string', ''),
      credentials: {
        accessKeyId: env('CNPMCORE_NFS_S3_CLIENT_ID', 'string', ''),
        secretAccessKey: env('CNPMCORE_NFS_S3_CLIENT_SECRET', 'string', ''),
      },
      bucket: env('CNPMCORE_NFS_S3_CLIENT_BUCKET', 'string', ''),
      forcePathStyle: env(
        'CNPMCORE_NFS_S3_CLIENT_FORCE_PATH_STYLE',
        'boolean',
        false
      ),
      disableURL: env('CNPMCORE_NFS_S3_CLIENT_DISABLE_URL', 'boolean', false),
    };
    assert.ok(s3Config.endpoint, 'require env CNPMCORE_NFS_S3_CLIENT_ENDPOINT');
    assert.ok(
      s3Config.credentials.accessKeyId,
      'require env CNPMCORE_NFS_S3_CLIENT_ID'
    );
    assert.ok(
      s3Config.credentials.secretAccessKey,
      'require env CNPMCORE_NFS_S3_CLIENT_SECRET'
    );
    assert.ok(s3Config.bucket, 'require env CNPMCORE_NFS_S3_CLIENT_BUCKET');
    // @ts-expect-error has no construct signatures
    config.nfs.client = new S3Client(s3Config);
  }

  config.logger = {
    enablePerformanceTimer: true,
    enableFastContextLogger: true,
    appLogName: env(
      'CNPMCORE_APP_LOG_NAME',
      'string',
      `${appInfo.name}-web.log`
    ),
    coreLogName: env('CNPMCORE_CORE_LOG_NAME', 'string', 'egg-web.log'),
    agentLogName: env('CNPMCORE_AGENT_LOG_NAME', 'string', 'egg-agent.log'),
    errorLogName: env('CNPMCORE_ERROR_LOG_NAME', 'string', 'common-error.log'),
    outputJSON: env('CNPMCORE_LOG_JSON_OUTPUT', 'boolean', false),
  };
  const logDir = env('CNPMCORE_LOG_DIR', 'string', '');
  if (logDir) {
    config.logger.dir = logDir;
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
        node: env('CNPMCORE_CONFIG_ES_CLIENT_NODE', 'string', ''),
        auth: {
          username: env(
            'CNPMCORE_CONFIG_ES_CLIENT_AUTH_USERNAME',
            'string',
            ''
          ),
          password: env(
            'CNPMCORE_CONFIG_ES_CLIENT_AUTH_PASSWORD',
            'string',
            ''
          ),
        },
      },
    };
  }

  return config;
}
