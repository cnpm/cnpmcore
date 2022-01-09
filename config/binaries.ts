export enum SyncerClass {
  NwjsBinary = 'NwjsBinary',
  NodeBinary = 'NodeBinary',
  CypressBinary = 'CypressBinary',
  BucketBinary = 'BucketBinary',
  GithubBinary = 'GithubBinary',
  Sqlite3Binary = 'Sqlite3Binary',
  SqlcipherBinary = 'SqlcipherBinary',
  PuppeteerBinary = 'PuppeteerBinary',
  NodePreGypBinary = 'NodePreGypBinary',
}

export type BinaryTaskConfig = {
  category: string;
  description: string;
  syncer: SyncerClass;
  repo: string;
  distUrl: string;
  ignoreDirs?: string[];
};

const binaries: {
  [category: string]: BinaryTaskConfig;
} = {
  // NwjsBinary
  nwjs: {
    category: 'nwjs',
    description: 'NW.js (previously known as node-webkit) lets you call all Node.js modules directly from DOM and enables a new way of writing applications with all Web technologies.',
    syncer: SyncerClass.NwjsBinary,
    repo: 'nwjs/nw.js',
    distUrl: 'https://dl.nwjs.io/',
  },
  // NodeBinary
  node: {
    category: 'node',
    description: 'Node.js® is a JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
    syncer: SyncerClass.NodeBinary,
    repo: 'nodejs/node',
    distUrl: 'https://nodejs.org/dist',
  },
  'node-unofficial-builds': {
    category: 'node-unofficial-builds',
    description: 'Node.js unofficial-builds project https://unofficial-builds.nodejs.org/',
    syncer: SyncerClass.NodeBinary,
    repo: 'nodejs/unofficial-builds',
    distUrl: 'https://unofficial-builds.nodejs.org/download/release',
  },
  alinode: {
    category: 'alinode',
    description: 'Node.js 性能平台（Node.js Performance Platform）是面向中大型 Node.js 应用提供性能监控、安全提醒、故障排查、性能优化等服务的整体性解决方案。凭借对 Node.js 内核深入的理解，我们提供完善的工具链和服务，协助客户主动、快速发现和定位线上问题。',
    syncer: SyncerClass.NodeBinary,
    repo: '',
    distUrl: 'http://alinode.aliyun.com/dist/new-alinode',
  },
  // CypressBinary
  cypress: {
    category: 'cypress',
    description: 'Fast, easy and reliable testing for anything that runs in a browser.',
    syncer: SyncerClass.CypressBinary,
    repo: 'cypress-io/cypress',
    distUrl: 'https://www.cypress.io/',
  },
  // Sqlite3Binary
  sqlite3: {
    category: 'sqlite3',
    description: 'Asynchronous, non-blocking SQLite3 bindings for Node.js',
    syncer: SyncerClass.Sqlite3Binary,
    repo: 'mapbox/node-sqlite3',
    distUrl: 'https://mapbox-node-binary.s3.amazonaws.com',
  },
  // SqlcipherBinary
  '@journeyapps/sqlcipher': {
    category: '@journeyapps/sqlcipher',
    description: 'SQLCipher bindings for Node',
    syncer: SyncerClass.SqlcipherBinary,
    repo: 'journeyapps/node-sqlcipher',
    distUrl: 'https://journeyapps-node-binary.s3.amazonaws.com',
  },
  // PuppeteerBinary
  'chromium-browser-snapshots': {
    category: 'chromium-browser-snapshots',
    description: 'chromium-browser-snapshots sync for puppeteer',
    syncer: SyncerClass.PuppeteerBinary,
    repo: 'puppeteer/puppeteer',
    distUrl: 'https://chromium-browser-snapshots.storage.googleapis.com/?delimiter=/&prefix=',
  },
  // NodePreGypBinary
  'grpc-tools': {
    category: 'grpc-tools',
    description: 'Tools for developing with gRPC on Node.js',
    syncer: SyncerClass.NodePreGypBinary,
    repo: 'https://github.com/grpc/grpc-node/blob/master/packages/grpc-tools/',
    distUrl: 'https://node-precompiled-binaries.grpc.io',
  },
  grpc: {
    category: 'grpc',
    description: 'gRPC Library for Node',
    syncer: SyncerClass.NodePreGypBinary,
    repo: 'grpc/grpc-node',
    distUrl: 'https://node-precompiled-binaries.grpc.io',
  },
  // BucketBinary
  chromedriver: {
    category: 'chromedriver',
    description: 'WebDriver is an open source tool for automated testing of webapps across many browsers',
    syncer: SyncerClass.BucketBinary,
    repo: 'https://chromedriver.chromium.org/contributing',
    distUrl: 'https://chromedriver.storage.googleapis.com/',
  },
  selenium: {
    category: 'selenium',
    description: 'Selenium automates browsers. That\'s it!',
    syncer: SyncerClass.BucketBinary,
    repo: 'https://www.selenium.dev/',
    distUrl: 'https://selenium-release.storage.googleapis.com/',
  },
  'node-inspector': {
    category: 'node-inspector',
    description: 'Node.js debugger based on Blink Developer Tools',
    syncer: SyncerClass.BucketBinary,
    repo: 'node-inspector/node-inspector',
    distUrl: 'https://node-inspector.s3.amazonaws.com/',
    ignoreDirs: [
      '/AWSLogs/',
    ],
  },
  fsevents: {
    category: 'fsevents',
    description: 'Native access to MacOS FSEvents in Node.js',
    syncer: SyncerClass.BucketBinary,
    repo: 'fsevents/fsevents',
    distUrl: 'https://fsevents-binaries.s3-us-west-2.amazonaws.com/',
  },
  'tfjs-models': {
    category: 'tfjs-models',
    description: 'Pretrained models for TensorFlow.js',
    syncer: SyncerClass.BucketBinary,
    repo: 'tensorflow/tfjs-models',
    distUrl: 'https://tfjs-models.storage.googleapis.com/',
  },
  tensorflow: {
    category: 'tensorflow',
    description: 'A WebGL accelerated JavaScript library for training and deploying ML models.',
    syncer: SyncerClass.BucketBinary,
    repo: 'tensorflow/tfjs',
    distUrl: 'https://tensorflow.storage.googleapis.com/',
  },
  'tf-builds': {
    category: 'tf-builds',
    description: 'A WebGL accelerated JavaScript library for training and deploying ML models.',
    syncer: SyncerClass.BucketBinary,
    repo: 'tensorflow/tfjs',
    distUrl: 'https://tf-builds.storage.googleapis.com/',
  },
  prisma: {
    category: 'prisma',
    description: 'Next-generation ORM for Node.js & TypeScript | PostgreSQL, MySQL, MariaDB, SQL Server, SQLite & MongoDB (Preview) https://www.prisma.io/',
    syncer: SyncerClass.BucketBinary,
    repo: 'prisma/prisma',
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
  xprofiler: {
    category: 'xprofiler',
    description: '🌀An addon for node.js, which supporting output performance log and real-time profiling through sampling.',
    syncer: SyncerClass.GithubBinary,
    repo: 'X-Profiler/xprofiler',
    distUrl: 'https://github.com/X-Profiler/xprofiler/releases',
  },
  'node-sass': {
    category: 'node-sass',
    description: '🌈 Node.js bindings to libsass',
    syncer: SyncerClass.GithubBinary,
    repo: 'sass/node-sass',
    distUrl: 'https://github.com/sass/node-sass/releases',
  },
  electron: {
    category: 'electron',
    description: 'Build cross-platform desktop apps with JavaScript, HTML, and CSS',
    syncer: SyncerClass.GithubBinary,
    repo: 'electron/electron',
    distUrl: 'https://github.com/electron/electron/releases',
  },
  'electron-builder-binaries': {
    category: 'electron-builder-binaries',
    description: 'electron-builder downloads required tools files on demand (e.g. to code sign windows application, to make AppX).',
    syncer: SyncerClass.GithubBinary,
    repo: 'electron-userland/electron-builder-binaries',
    distUrl: 'https://github.com/electron-userland/electron-builder-binaries/releases',
  },
  canvas: {
    category: 'canvas',
    description: 'Node canvas is a Cairo backed Canvas implementation for NodeJS.',
    syncer: SyncerClass.GithubBinary,
    repo: 'Automattic/node-canvas',
    distUrl: 'https://github.com/Automattic/node-canvas/releases',
  },
  nodejieba: {
    category: 'nodejieba',
    description: '"结巴"中文分词的Node.js版本',
    syncer: SyncerClass.GithubBinary,
    repo: 'yanyiwu/nodejieba',
    distUrl: 'https://github.com/yanyiwu/nodejieba/releases',
  },
  'git-for-windows': {
    category: 'git-for-windows',
    description: 'A fork of Git containing Windows-specific patches.',
    syncer: SyncerClass.GithubBinary,
    repo: 'git-for-windows/git',
    distUrl: 'https://github.com/git-for-windows/git/releases',
  },
  atom: {
    category: 'atom',
    description: 'The hackable text editor',
    syncer: SyncerClass.GithubBinary,
    repo: 'atom/atom',
    distUrl: 'https://github.com/atom/atom/releases',
  },
  operadriver: {
    category: 'operadriver',
    description: 'OperaDriver for Chromium-based Opera releases',
    syncer: SyncerClass.GithubBinary,
    repo: 'operasoftware/operachromiumdriver',
    distUrl: 'https://github.com/operasoftware/operachromiumdriver/releases',
  },
  geckodriver: {
    category: 'geckodriver',
    description: 'WebDriver for Firefox',
    syncer: SyncerClass.GithubBinary,
    repo: 'mozilla/geckodriver',
    distUrl: 'https://github.com/mozilla/geckodriver/releases',
  },
  leveldown: {
    category: 'leveldown',
    description: 'Pure C++ Node.js LevelDB binding. An abstract-leveldown compliant store.',
    syncer: SyncerClass.GithubBinary,
    repo: 'Level/leveldown',
    distUrl: 'https://github.com/Level/leveldown/releases',
  },
  couchbase: {
    category: 'couchbase',
    description: 'Couchbase Node.js Client Library (Official)',
    syncer: SyncerClass.GithubBinary,
    repo: 'couchbase/couchnode',
    distUrl: 'https://github.com/couchbase/couchnode/releases',
  },
  gl: {
    category: 'gl',
    description: '🎃 Windowless WebGL for node.js',
    syncer: SyncerClass.GithubBinary,
    repo: 'stackgl/headless-gl',
    distUrl: 'https://github.com/stackgl/headless-gl/releases',
  },
  flow: {
    category: 'flow',
    description: 'Adds static typing to JavaScript to improve developer productivity and code quality.',
    syncer: SyncerClass.GithubBinary,
    repo: 'facebook/flow',
    distUrl: 'https://github.com/facebook/flow/releases',
  },
  robotjs: {
    category: 'robotjs',
    description: 'Node.js Desktop Automation. http://robotjs.io/',
    syncer: SyncerClass.GithubBinary,
    repo: 'octalmage/robotjs',
    distUrl: 'https://github.com/octalmage/robotjs/releases',
  },
  poi: {
    category: 'poi',
    description: 'Scalable KanColle browser and tool. https://poi.io/',
    syncer: SyncerClass.GithubBinary,
    repo: 'poooi/poi',
    distUrl: 'https://github.com/poooi/poi/releases',
  },
  'utf-8-validate': {
    category: 'utf-8-validate',
    description: 'Check if a buffer contains valid UTF-8',
    syncer: SyncerClass.GithubBinary,
    repo: 'websockets/utf-8-validate',
    distUrl: 'https://github.com/websockets/utf-8-validate/releases',
  },
  minikube: {
    category: 'minikube',
    description: 'Run Kubernetes locally https://minikube.sigs.k8s.io/',
    syncer: SyncerClass.GithubBinary,
    repo: 'kubernetes/minikube',
    distUrl: 'https://github.com/kubernetes/minikube/releases',
  },
  'sentry-cli': {
    category: 'sentry-cli',
    description: 'A command line utility to work with Sentry. https://docs.sentry.io/cli/',
    syncer: SyncerClass.GithubBinary,
    repo: 'getsentry/sentry-cli',
    distUrl: 'https://github.com/getsentry/sentry-cli/releases',
  },
  'sharp-libvips': {
    category: 'sharp-libvips',
    description: 'Packaging scripts to prebuild libvips and its dependencies - you\'re probably looking for https://github.com/lovell/sharp',
    syncer: SyncerClass.GithubBinary,
    repo: 'lovell/sharp-libvips',
    distUrl: 'https://github.com/lovell/sharp-libvips/releases',
  },
  sharp: {
    category: 'sharp',
    description: 'High performance Node.js image processing, the fastest module to resize JPEG, PNG, WebP, AVIF and TIFF images. Uses the libvips library. https://sharp.pixelplumbing.com/',
    syncer: SyncerClass.GithubBinary,
    repo: 'lovell/sharp',
    distUrl: 'https://github.com/lovell/sharp/releases',
  },
  swc: {
    category: 'swc',
    description: 'swc is a super-fast compiler written in rust; producing widely-supported javascript from modern standards and typescript. https://swc.rs/',
    syncer: SyncerClass.GithubBinary,
    repo: 'swc-project/swc',
    distUrl: 'https://github.com/swc-project/swc/releases',
  },
  argon2: {
    category: 'argon2',
    description: 'Node.js bindings for Argon2 hashing algorithm',
    syncer: SyncerClass.GithubBinary,
    repo: 'ranisalt/node-argon2',
    distUrl: 'https://github.com/ranisalt/node-argon2/releases',
  },
  iohook: {
    category: 'iohook',
    description: 'Node.js global keyboard and mouse listener.',
    syncer: SyncerClass.GithubBinary,
    repo: 'wilix-team/iohook',
    distUrl: 'https://github.com/wilix-team/iohook/releases',
  },
  saucectl: {
    category: 'saucectl',
    description: 'A command line interface to run testrunner tests',
    syncer: SyncerClass.GithubBinary,
    repo: 'saucelabs/saucectl',
    distUrl: 'https://github.com/saucelabs/saucectl/releases',
  },
};

export default binaries;
