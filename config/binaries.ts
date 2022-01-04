type BinaryTaskConfig = {
  category: string;
  syncer: string;
  repo: string;
  distUrl?: string;
};

const binaries: BinaryTaskConfig[] = [
  // NodeBinary
  {
    category: 'node',
    syncer: 'NodeBinary',
    repo: 'nodejs/node',
    distUrl: 'https://nodejs.org/dist',
  },
  {
    category: 'node-unofficial-builds',
    syncer: 'NodeBinary',
    repo: 'nodejs/unofficial-builds',
    distUrl: 'https://unofficial-builds.nodejs.org/download/release',
  },
  {
    category: 'alinode',
    syncer: 'NodeBinary',
    repo: '',
    distUrl: 'http://alinode.aliyun.com/dist/new-alinode',
  },
  // NwjsBinary
  {
    category: 'nwjs',
    syncer: 'NwjsBinary',
    repo: 'nwjs/nw.js',
    distUrl: 'https://dl.nwjs.io',
  },
  // GithubBinary
  {
    category: 'xprofiler',
    syncer: 'GithubBinary',
    repo: 'X-Profiler/xprofiler',
  },
  {
    category: 'node-sass',
    syncer: 'GithubBinary',
    repo: 'sass/node-sass',
  },
  {
    category: 'electron',
    syncer: 'GithubBinary',
    repo: 'electron/electron',
  },
  {
    category: 'electron-builder-binaries',
    syncer: 'GithubBinary',
    repo: 'electron-userland/electron-builder-binaries',
  },
  {
    category: 'canvas',
    syncer: 'GithubBinary',
    repo: 'Automattic/node-canvas',
  },
  {
    category: 'nodejieba',
    syncer: 'GithubBinary',
    repo: 'yanyiwu/nodejieba',
  },
  {
    category: 'git-for-windows',
    syncer: 'GithubBinary',
    repo: 'git-for-windows/git',
  },
  {
    category: 'atom',
    syncer: 'GithubBinary',
    repo: 'atom/atom',
  },
  {
    category: 'operadriver',
    syncer: 'GithubBinary',
    repo: 'operasoftware/operachromiumdriver',
  },
  {
    category: 'geckodriver',
    syncer: 'GithubBinary',
    repo: 'mozilla/geckodriver',
  },
  {
    category: 'leveldown',
    syncer: 'GithubBinary',
    repo: 'Level/leveldown',
  },
  {
    category: 'couchbase',
    syncer: 'GithubBinary',
    repo: 'couchbase/couchnode',
  },
  {
    category: 'gl',
    syncer: 'GithubBinary',
    repo: 'stackgl/headless-gl',
  },
  {
    category: 'flow',
    syncer: 'GithubBinary',
    repo: 'facebook/flow',
  },
  {
    category: 'robotjs',
    syncer: 'GithubBinary',
    repo: 'octalmage/robotjs',
  },
  {
    category: 'poi',
    syncer: 'GithubBinary',
    repo: 'poooi/poi',
  },
  {
    category: 'utf-8-validate',
    syncer: 'GithubBinary',
    repo: 'websockets/utf-8-validate',
  },
  {
    category: 'minikube',
    syncer: 'GithubBinary',
    repo: 'kubernetes/minikube',
  },
  {
    category: 'sentry-cli',
    syncer: 'GithubBinary',
    repo: 'getsentry/sentry-cli',
  },
  {
    category: 'sharp-libvips',
    syncer: 'GithubBinary',
    repo: 'lovell/sharp-libvips',
  },
  {
    category: 'sharp',
    syncer: 'GithubBinary',
    repo: 'lovell/sharp',
  },
  {
    category: 'swc',
    syncer: 'GithubBinary',
    repo: 'swc-project/swc',
  },
  {
    category: 'argon2',
    syncer: 'GithubBinary',
    repo: 'ranisalt/node-argon2',
  },
  {
    category: 'iohook',
    syncer: 'GithubBinary',
    repo: 'wilix-team/iohook',
  },
  {
    category: 'saucectl',
    syncer: 'GithubBinary',
    repo: 'saucelabs/saucectl',
  },
];

export default binaries;
