export enum SyncerClass {
  NwjsBinary = 'NwjsBinary',
  NodeBinary = 'NodeBinary',
  CypressBinary = 'CypressBinary',
  BucketBinary = 'BucketBinary',
  GithubBinary = 'GithubBinary',
  Sqlite3Binary = 'Sqlite3Binary',
  SqlcipherBinary = 'SqlcipherBinary',
}

type BinaryTaskConfig = {
  category: string;
  syncer: SyncerClass;
  repo: string;
  distUrl?: string;
  ignoreDirs?: string[];
};

const binaries: BinaryTaskConfig[] = [
  // NwjsBinary
  {
    category: 'nwjs',
    syncer: SyncerClass.NwjsBinary,
    repo: 'nwjs/nw.js',
    distUrl: 'https://dl.nwjs.io/',
  },
  // NodeBinary
  {
    category: 'node',
    syncer: SyncerClass.NodeBinary,
    repo: 'nodejs/node',
    distUrl: 'https://nodejs.org/dist',
  },
  {
    category: 'node-unofficial-builds',
    syncer: SyncerClass.NodeBinary,
    repo: 'nodejs/unofficial-builds',
    distUrl: 'https://unofficial-builds.nodejs.org/download/release',
  },
  {
    category: 'alinode',
    syncer: SyncerClass.NodeBinary,
    repo: '',
    distUrl: 'http://alinode.aliyun.com/dist/new-alinode',
  },
  // CypressBinary
  {
    category: 'cypress',
    syncer: SyncerClass.CypressBinary,
    repo: 'cypress-io/cypress',
    distUrl: '',
  },
  // Sqlite3Binary
  {
    category: 'sqlite3',
    syncer: SyncerClass.Sqlite3Binary,
    repo: 'mapbox/node-sqlite3',
    distUrl: '',
  },
  // SqlcipherBinary
  {
    category: 'sqlcipher',
    syncer: SyncerClass.SqlcipherBinary,
    repo: 'journeyapps/node-sqlcipher',
    distUrl: '',
  },
  // BucketBinary
  {
    category: 'chromedriver',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://chromedriver.storage.googleapis.com/',
  },
  {
    category: 'selenium',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://selenium-release.storage.googleapis.com/',
  },
  {
    category: 'node-inspector',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://node-inspector.s3.amazonaws.com/',
    ignoreDirs: [
      '/AWSLogs/',
    ],
  },
  {
    category: 'fsevents',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://fsevents-binaries.s3-us-west-2.amazonaws.com/',
  },
  {
    category: 'tfjs-models',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://tfjs-models.storage.googleapis.com/',
  },
  {
    category: 'tensorflow',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://tensorflow.storage.googleapis.com/',
  },
  {
    category: 'tf-builds',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://tf-builds.storage.googleapis.com/',
  },
  {
    category: 'prisma',
    syncer: SyncerClass.BucketBinary,
    repo: '',
    distUrl: 'https://prisma-builds.s3-eu-west-1.amazonaws.com/',
    ignoreDirs: [
      // https://prisma-builds.s3-eu-west-1.amazonaws.com/?delimiter=/&prefix=
      '/all_commits/',
      '/build_testruns/',
      '/bump_engineer/',
      '/m1_builds/',
      '/master/',
      '/ci/',
      '/unreverse/',
      '/signature_test_run/',
      '/sql-server-char-collation-fix/',
      '/test-ldd-output-on-release/',
      '/windows-mysql-ci/',
    ],
  },
  // GithubBinary
  {
    category: 'xprofiler',
    syncer: SyncerClass.GithubBinary,
    repo: 'X-Profiler/xprofiler',
  },
  {
    category: 'node-sass',
    syncer: SyncerClass.GithubBinary,
    repo: 'sass/node-sass',
  },
  {
    category: 'electron',
    syncer: SyncerClass.GithubBinary,
    repo: 'electron/electron',
  },
  {
    category: 'electron-builder-binaries',
    syncer: SyncerClass.GithubBinary,
    repo: 'electron-userland/electron-builder-binaries',
  },
  {
    category: 'canvas',
    syncer: SyncerClass.GithubBinary,
    repo: 'Automattic/node-canvas',
  },
  {
    category: 'nodejieba',
    syncer: SyncerClass.GithubBinary,
    repo: 'yanyiwu/nodejieba',
  },
  {
    category: 'git-for-windows',
    syncer: SyncerClass.GithubBinary,
    repo: 'git-for-windows/git',
  },
  {
    category: 'atom',
    syncer: SyncerClass.GithubBinary,
    repo: 'atom/atom',
  },
  {
    category: 'operadriver',
    syncer: SyncerClass.GithubBinary,
    repo: 'operasoftware/operachromiumdriver',
  },
  {
    category: 'geckodriver',
    syncer: SyncerClass.GithubBinary,
    repo: 'mozilla/geckodriver',
  },
  {
    category: 'leveldown',
    syncer: SyncerClass.GithubBinary,
    repo: 'Level/leveldown',
  },
  {
    category: 'couchbase',
    syncer: SyncerClass.GithubBinary,
    repo: 'couchbase/couchnode',
  },
  {
    category: 'gl',
    syncer: SyncerClass.GithubBinary,
    repo: 'stackgl/headless-gl',
  },
  {
    category: 'flow',
    syncer: SyncerClass.GithubBinary,
    repo: 'facebook/flow',
  },
  {
    category: 'robotjs',
    syncer: SyncerClass.GithubBinary,
    repo: 'octalmage/robotjs',
  },
  {
    category: 'poi',
    syncer: SyncerClass.GithubBinary,
    repo: 'poooi/poi',
  },
  {
    category: 'utf-8-validate',
    syncer: SyncerClass.GithubBinary,
    repo: 'websockets/utf-8-validate',
  },
  {
    category: 'minikube',
    syncer: SyncerClass.GithubBinary,
    repo: 'kubernetes/minikube',
  },
  {
    category: 'sentry-cli',
    syncer: SyncerClass.GithubBinary,
    repo: 'getsentry/sentry-cli',
  },
  {
    category: 'sharp-libvips',
    syncer: SyncerClass.GithubBinary,
    repo: 'lovell/sharp-libvips',
  },
  {
    category: 'sharp',
    syncer: SyncerClass.GithubBinary,
    repo: 'lovell/sharp',
  },
  {
    category: 'swc',
    syncer: SyncerClass.GithubBinary,
    repo: 'swc-project/swc',
  },
  {
    category: 'argon2',
    syncer: SyncerClass.GithubBinary,
    repo: 'ranisalt/node-argon2',
  },
  {
    category: 'iohook',
    syncer: SyncerClass.GithubBinary,
    repo: 'wilix-team/iohook',
  },
  {
    category: 'saucectl',
    syncer: SyncerClass.GithubBinary,
    repo: 'saucelabs/saucectl',
  },
];

export default binaries;
