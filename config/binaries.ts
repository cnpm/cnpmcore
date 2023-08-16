import { BinaryType } from '../app/common/enum/Binary';

export type BinaryTaskConfig = {
  category: CategoryName; // 默认 category 为 binaryName，但是有些 binary 会有不同的 category，比如 canvas，包含 canvas 和 node-canvas-prebuilt 两个
  description: string;
  type: BinaryType;
  repo: string;
  distUrl: string;
  ignoreDirs?: readonly string[];
  ignoreFiles?: readonly string[];
  options?: {
    nodePlatforms?: readonly string[],
    nodeArchs?: Record<string, readonly string[]>,
    // Imagemin binFiles
    binFiles?: Record<string, readonly string[]>,
    // default is 1
    maxPage?: number;
    // custom npm package name, for ImageminBinary
    npmPackageName?: string;
    // custom for NodePreGypBinary
    requiredNapiVersions?: boolean;
    // ignore download fail response status
    ignoreDownloadStatuses?: number[],
  },
  disable?: boolean;
};

const binaries = {
  // NwjsBinary
  nwjs: {
    category: 'nwjs',
    description: 'NW.js (previously known as node-webkit) lets you call all Node.js modules directly from DOM and enables a new way of writing applications with all Web technologies.',
    type: BinaryType.Nwjs,
    repo: 'nwjs/nw.js',
    distUrl: 'https://dl.nwjs.io/',
  },
  // NodeBinary
  node: {
    category: 'node',
    description: 'Node.js® is a JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
    type: BinaryType.Node,
    repo: 'nodejs/node',
    distUrl: 'https://nodejs.org/dist',
  },
  'node-rc': {
    category: 'node-rc',
    description: 'Node.js Release Candidate',
    type: BinaryType.Node,
    repo: 'nodejs/node',
    distUrl: 'https://nodejs.org/download/rc',
  },
  'node-nightly': {
    category: 'node-nightly',
    description: 'Node.js Nightly Build',
    type: BinaryType.Node,
    repo: 'nodejs/node',
    distUrl: 'https://nodejs.org/download/nightly',
  },
  'node-unofficial-builds': {
    category: 'node-unofficial-builds',
    description: 'Node.js unofficial-builds project https://unofficial-builds.nodejs.org/',
    type: BinaryType.Node,
    repo: 'nodejs/unofficial-builds',
    distUrl: 'https://unofficial-builds.nodejs.org/download/release',
  },
  alinode: {
    category: 'alinode',
    description: 'Node.js 性能平台（Node.js Performance Platform）是面向中大型 Node.js 应用提供性能监控、安全提醒、故障排查、性能优化等服务的整体性解决方案。凭借对 Node.js 内核深入的理解，我们提供完善的工具链和服务，协助客户主动、快速发现和定位线上问题。',
    type: BinaryType.Node,
    repo: '',
    distUrl: 'http://alinode.aliyun.com/dist/new-alinode',
  },
  python: {
    category: 'python',
    description: 'The Python programming language https://www.python.org/',
    type: BinaryType.Node,
    repo: 'python/cpython',
    distUrl: 'https://www.python.org/ftp/python',
    ignoreFiles: [
      '/src/Python-1.6.tar.gz',
    ],
    options: {
      // https://www.python.org/ftp/python/3.9.14/Python-3.9.14.tar.xz.sig status(403)
      ignoreDownloadStatuses: [ 403 ] satisfies number[],
    },
  },
  // CypressBinary
  cypress: {
    category: 'cypress',
    description: 'Fast, easy and reliable testing for anything that runs in a browser.',
    type: BinaryType.Cypress,
    repo: 'cypress-io/cypress',
    distUrl: 'https://www.cypress.io/',
  },
  // SqlcipherBinary
  '@journeyapps/sqlcipher': {
    category: '@journeyapps/sqlcipher',
    description: 'SQLCipher bindings for Node',
    type: BinaryType.Sqlcipher,
    repo: 'journeyapps/node-sqlcipher',
    distUrl: 'https://journeyapps-node-binary.s3.amazonaws.com',
  },
  // puppeteer binary
  'chromium-browser-snapshots': {
    category: 'chromium-browser-snapshots',
    description: 'chromium-browser-snapshots sync for puppeteer',
    type: BinaryType.Puppeteer,
    repo: 'puppeteer/puppeteer',
    distUrl: 'https://chromium-browser-snapshots.storage.googleapis.com/?delimiter=/&prefix=',
  },
  // ChromeBinary
  'chrome-for-testing': {
    category: 'chrome-for-testing',
    description: 'chrome-for-testing for puppeteer',
    type: BinaryType.ChromeForTesting,
    repo: 'puppeteer/puppeteer',
    distUrl: 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/',
  },
  // NodePreGypBinary
  'grpc-tools': {
    category: 'grpc-tools',
    description: 'Tools for developing with gRPC on Node.js',
    type: BinaryType.NodePreGyp,
    repo: 'https://github.com/grpc/grpc-node/blob/master/packages/grpc-tools/',
    distUrl: 'https://node-precompiled-binaries.grpc.io',
  },
  grpc: {
    category: 'grpc',
    description: 'gRPC Library for Node',
    type: BinaryType.NodePreGyp,
    repo: 'grpc/grpc-node',
    distUrl: 'https://node-precompiled-binaries.grpc.io',
  },
  'skia-canvas': {
    category: 'skia-canvas',
    description: 'A canvas environment for Node',
    type: BinaryType.NodePreGyp,
    repo: 'samizdatco/skia-canvas',
    distUrl: 'https://skia-canvas.s3.us-east-1.amazonaws.com',
    options: {
      requiredNapiVersions: true,
    },
  },
  wrtc: {
    category: 'wrtc',
    description: 'node-webrtc is a Node.js Native Addon that provides bindings to WebRTC M87.',
    type: BinaryType.NodePreGyp,
    repo: 'node-webrtc/node-webrtc',
    distUrl: 'https://node-webrtc.s3.amazonaws.com',
  },
  nodegit: {
    category: 'nodegit',
    description: 'Native Node bindings to Git.',
    type: BinaryType.NodePreGyp,
    repo: 'nodegit/nodegit',
    distUrl: 'https://axonodegit.s3.amazonaws.com/nodegit',
    options: {
      nodeArchs: {
        linux: [ 'x64' ],
        darwin: [ 'x64' ],
        // https://github.com/nodegit/nodegit/blob/master/.github/workflows/tests.yml#L141
        win32: [ 'x64', 'ia32' ],
      },
    },
    // don't sync it for now
    disable: true,
  },
  // BucketBinary
  chromedriver: {
    category: 'chromedriver',
    description: 'WebDriver is an open source tool for automated testing of webapps across many browsers',
    type: BinaryType.Bucket,
    repo: 'https://chromedriver.chromium.org/contributing',
    distUrl: 'https://chromedriver.storage.googleapis.com/',
  },
  selenium: {
    category: 'selenium',
    description: 'Selenium automates browsers. That\'s it!',
    type: BinaryType.Bucket,
    repo: 'https://www.selenium.dev/',
    distUrl: 'https://selenium-release.storage.googleapis.com/',
  },
  'node-inspector': {
    category: 'node-inspector',
    description: 'Node.js debugger based on Blink Developer Tools',
    type: BinaryType.Bucket,
    repo: 'node-inspector/node-inspector',
    distUrl: 'https://node-inspector.s3.amazonaws.com/',
    ignoreDirs: [
      '/AWSLogs/',
    ],
  },
  fsevents: {
    category: 'fsevents',
    description: 'Native access to MacOS FSEvents in Node.js',
    type: BinaryType.Bucket,
    repo: 'fsevents/fsevents',
    distUrl: 'https://fsevents-binaries.s3-us-west-2.amazonaws.com/',
  },
  'tfjs-models': {
    category: 'tfjs-models',
    description: 'Pretrained models for TensorFlow.js',
    type: BinaryType.Bucket,
    repo: 'tensorflow/tfjs-models',
    distUrl: 'https://tfjs-models.storage.googleapis.com/',
  },
  tensorflow: {
    category: 'tensorflow',
    description: 'A WebGL accelerated JavaScript library for training and deploying ML models.',
    type: BinaryType.Bucket,
    repo: 'tensorflow/tfjs',
    distUrl: 'https://tensorflow.storage.googleapis.com/',
  },
  'tf-builds': {
    category: 'tf-builds',
    description: 'A WebGL accelerated JavaScript library for training and deploying ML models.',
    type: BinaryType.Bucket,
    repo: 'tensorflow/tfjs',
    distUrl: 'https://tf-builds.storage.googleapis.com/',
  },
  prisma: {
    category: 'prisma',
    description: 'Next-generation Node.js and TypeScript ORM https://www.prisma.io/',
    type: BinaryType.Prisma,
    repo: 'prisma/prisma',
    distUrl: 'https://list-binaries.prisma-orm.workers.dev/',
  },
  // ImageminBinary
  'jpegtran-bin': {
    category: 'jpegtran-bin',
    description: 'jpegtran bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/jpegtran-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/jpegtran-bin/blob/v4.0.0/lib/index.js
      nodePlatforms: [ 'macos', 'linux', 'freebsd', 'sunos', 'win' ],
      nodeArchs: {
        macos: [],
        linux: [ 'x86', 'x64' ],
        freebsd: [ 'x86', 'x64' ],
        sunos: [ 'x86', 'x64' ],
        win: [ 'x86', 'x64' ],
      },
      binFiles: {
        macos: [ 'jpegtran' ],
        linux: [ 'jpegtran' ],
        freebsd: [ 'jpegtran' ],
        sunos: [ 'jpegtran' ],
        win: [ 'jpegtran.exe', 'libjpeg-62.dll' ],
      },
    },
  },
  'pngquant-bin': {
    category: 'pngquant-bin',
    description: 'pngquant bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/pngquant-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/pngquant-bin/blob/v4.0.0/lib/index.js
      nodePlatforms: [ 'macos', 'linux', 'freebsd', 'win' ],
      nodeArchs: {
        macos: [],
        linux: [ 'x86', 'x64' ],
        freebsd: [ 'x64' ],
        win: [],
      },
      binFiles: {
        macos: [ 'pngquant' ],
        linux: [ 'pngquant' ],
        freebsd: [ 'pngquant' ],
        win: [ 'pngquant.exe' ],
      },
    },
  },
  'mozjpeg-bin': {
    category: 'mozjpeg-bin',
    description: 'mozjpeg bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/mozjpeg-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // should use https://www.npmjs.com/package/mozjpeg
      npmPackageName: 'mozjpeg',
      // https://github.com/imagemin/mozjpeg-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/mozjpeg-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'macos', 'linux', 'win' ],
      nodeArchs: {
        osx: [],
        macos: [],
        linux: [],
        win: [],
      },
      binFiles: {
        osx: [ 'cjpeg' ],
        macos: [ 'cjpeg' ],
        linux: [ 'cjpeg' ],
        win: [ 'cjpeg.exe' ],
      },
    },
  },
  'gifsicle-bin': {
    category: 'gifsicle-bin',
    description: 'gifsicle bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/gifsicle-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // should use https://www.npmjs.com/package/gifsicle
      npmPackageName: 'gifsicle',
      // https://github.com/imagemin/gifsicle-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/gifsicle-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'macos', 'linux', 'freebsd', 'win' ],
      nodeArchs: {
        macos: [],
        linux: [ 'x86', 'x64' ],
        freebsd: [ 'x86', 'x64' ],
        win: [ 'x86', 'x64' ],
      },
      binFiles: {
        macos: [ 'gifsicle' ],
        linux: [ 'gifsicle' ],
        freebsd: [ 'gifsicle' ],
        win: [ 'gifsicle.exe' ],
      },
    },
  },
  'optipng-bin': {
    category: 'optipng-bin',
    description: 'optipng bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/optipng-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/optipng-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/optipng-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'macos', 'linux', 'freebsd', 'sunos', 'win' ],
      nodeArchs: {
        macos: [],
        linux: [ 'x86', 'x64' ],
        freebsd: [ 'x86', 'x64' ],
        sunos: [ 'x86', 'x64' ],
        win: [],
      },
      binFiles: {
        macos: [ 'optipng' ],
        linux: [ 'optipng' ],
        freebsd: [ 'optipng' ],
        sunos: [ 'optipng' ],
        win: [ 'optipng.exe' ],
      },
    },
  },
  'zopflipng-bin': {
    category: 'zopflipng-bin',
    description: 'zopflipng bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/zopflipng-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/zopflipng-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/zopflipng-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'linux', 'win32' ],
      nodeArchs: {
        osx: [],
        linux: [],
        win32: [],
      },
      binFiles: {
        osx: [ 'zopflipng' ],
        linux: [ 'zopflipng' ],
        win32: [ 'zopflipng.exe' ],
      },
    },
  },
  'jpegoptim-bin': {
    category: 'jpegoptim-bin',
    description: 'jpegoptim bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/jpegoptim-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/jpegoptim-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/jpegoptim-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'linux', 'win32' ],
      nodeArchs: {
        osx: [],
        linux: [],
        win32: [],
      },
      binFiles: {
        osx: [ 'jpegoptim' ],
        linux: [ 'jpegoptim' ],
        win32: [ 'jpegoptim.exe' ],
      },
    },
  },
  'jpeg-recompress-bin': {
    category: 'jpeg-recompress-bin',
    description: 'jpeg-recompress bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/jpeg-recompress-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/jpeg-recompress-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/jpeg-recompress-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'linux', 'win' ],
      nodeArchs: {
        osx: [],
        linux: [],
        win: [],
      },
      binFiles: {
        osx: [ 'jpeg-recompress' ],
        linux: [ 'jpeg-recompress' ],
        win: [ 'jpeg-recompress.exe' ],
      },
    },
  },
  'pngcrush-bin': {
    category: 'pngcrush-bin',
    description: 'pngcrush bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/pngcrush-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/pngcruss-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/pngcrush-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'linux', 'win' ],
      nodeArchs: {
        osx: [],
        linux: [],
        win: [ 'x64', 'x86' ],
      },
      binFiles: {
        osx: [ 'pngcrush' ],
        linux: [ 'pngcrush' ],
        win: [ 'pngcrush.exe' ],
      },
    },
  },
  'pngout-bin': {
    category: 'pngout-bin',
    description: 'pngout bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/pngout-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/pngout-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/pngout-bin/blob/v5.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'linux', 'freebsd', 'win32' ],
      nodeArchs: {
        osx: [],
        linux: [ 'x64', 'x86' ],
        freebsd: [ 'x64', 'x86' ],
        win32: [],
      },
      binFiles: {
        osx: [ 'pngcrush' ],
        linux: [ 'pngcrush' ],
        freebsd: [ 'pngout' ],
        win32: [ 'pngcrush.exe' ],
      },
    },
  },
  'gif2webp-bin': {
    category: 'gif2webp-bin',
    description: 'gif2webp bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/gif2webp-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/gif2webp-bin/blob/v4.0.0/lib/index.js
      nodePlatforms: [ 'macos', 'linux', 'win' ],
      nodeArchs: {
        macos: [],
        linux: [],
        win: [],
      },
      binFiles: {
        macos: [ 'gif2webp' ],
        linux: [ 'gif2webp' ],
        win: [ 'gif2webp.exe' ],
      },
    },
  },
  'guetzli-bin': {
    category: 'guetzli-bin',
    description: 'guetzli bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/guetzli-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // should use https://www.npmjs.com/package/guetzli
      npmPackageName: 'guetzli',
      // https://github.com/imagemin/guetzli-bin/blob/v4.0.0/lib/index.js
      nodePlatforms: [ 'macos', 'linux', 'win' ],
      nodeArchs: {
        macos: [],
        linux: [],
        win: [],
      },
      binFiles: {
        macos: [ 'guetzli' ],
        linux: [ 'guetzli' ],
        win: [ 'guetzli.exe' ],
      },
    },
  },
  'advpng-bin': {
    category: 'advpng-bin',
    description: 'advpng bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/advpng-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/advpng-bin/blob/v4.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'linux', 'win32' ],
      nodeArchs: {
        osx: [],
        linux: [],
        win32: [],
      },
      binFiles: {
        osx: [ 'advpng' ],
        linux: [ 'advpng' ],
        win32: [ 'advpng.exe' ],
      },
    },
  },
  'cwebp-bin': {
    category: 'cwebp-bin',
    description: 'cwebp bin-wrapper that makes it seamlessly available as a local dependency',
    type: BinaryType.Imagemin,
    repo: 'imagemin/cwebp-bin',
    distUrl: 'https://raw.githubusercontent.com',
    options: {
      // https://github.com/imagemin/cwebp-bin/blob/v4.0.0/lib/index.js
      nodePlatforms: [ 'osx', 'linux', 'win' ],
      nodeArchs: {
        osx: [],
        linux: [ 'x86', 'x64' ],
        win: [ 'x86', 'x64' ],
      },
      binFiles: {
        osx: [ 'cwebp' ],
        linux: [ 'cwebp' ],
        win: [ 'cwebp.exe' ],
      },
    },
  },
  // GithubBinary
  npm: {
    category: 'npm',
    description: 'the package manager for JavaScript',
    type: BinaryType.GitHub,
    repo: 'npm/cli',
    distUrl: 'https://github.com/npm/cli/releases',
    options: {
      maxPage: 3,
    },
  },
  xprofiler: {
    category: 'xprofiler',
    description: '🌀An addon for node.js, which supporting output performance log and real-time profiling through sampling.',
    type: BinaryType.GitHub,
    repo: 'X-Profiler/xprofiler',
    distUrl: 'https://github.com/X-Profiler/xprofiler/releases',
  },
  'node-sass': {
    category: 'node-sass',
    description: '🌈 Node.js bindings to libsass',
    type: BinaryType.GitHub,
    repo: 'sass/node-sass',
    distUrl: 'https://github.com/sass/node-sass/releases',
  },
  'sass-embedded': {
    category: 'sass-embedded',
    description: 'This is a wrapper for Dart Sass that implements the compiler side of the Embedded Sass protocol.',
    type: BinaryType.GitHub,
    repo: 'sass/dart-sass-embedded',
    distUrl: 'https://github.com/sass/dart-sass-embedded/releases',
  },
  electron: {
    category: 'electron',
    description: 'Build cross-platform desktop apps with JavaScript, HTML, and CSS',
    type: BinaryType.Electron,
    repo: 'electron/electron',
    distUrl: 'https://github.com/electron/electron/releases',
    options: {
      // for sync more old versions
      maxPage: 1,
    },
  },
  'electron-nightly': {
    category: 'electron-nightly',
    description: 'Build cross-platform desktop apps with JavaScript, HTML, and CSS',
    type: BinaryType.GitHub,
    repo: 'electron/nightlies',
    distUrl: 'https://github.com/electron/nightlies/releases',
    options: {
      maxPage: 3,
    },
  },
  'electron-builder-binaries': {
    category: 'electron-builder-binaries',
    description: 'electron-builder downloads required tools files on demand (e.g. to code sign windows application, to make AppX).',
    type: BinaryType.GitHub,
    repo: 'electron-userland/electron-builder-binaries',
    distUrl: 'https://github.com/electron-userland/electron-builder-binaries/releases',
  },
  'ffmpeg-static': {
    category: 'ffmpeg-static',
    description: 'ffmpeg static binaries for Mac OSX and Linux and Windows',
    type: BinaryType.GitHub,
    repo: 'eugeneware/ffmpeg-static',
    distUrl: 'https://github.com/eugeneware/ffmpeg-static/releases',
  },
  nodejieba: {
    category: 'nodejieba',
    description: '"结巴"中文分词的Node.js版本',
    type: BinaryType.GitHub,
    repo: 'yanyiwu/nodejieba',
    distUrl: 'https://github.com/yanyiwu/nodejieba/releases',
  },
  'git-for-windows': {
    category: 'git-for-windows',
    description: 'A fork of Git containing Windows-specific patches.',
    type: BinaryType.GitHub,
    repo: 'git-for-windows/git',
    distUrl: 'https://github.com/git-for-windows/git/releases',
  },
  atom: {
    category: 'atom',
    description: 'The hackable text editor',
    type: BinaryType.GitHub,
    repo: 'atom/atom',
    distUrl: 'https://github.com/atom/atom/releases',
  },
  operadriver: {
    category: 'operadriver',
    description: 'OperaDriver for Chromium-based Opera releases',
    type: BinaryType.GitHub,
    repo: 'operasoftware/operachromiumdriver',
    distUrl: 'https://github.com/operasoftware/operachromiumdriver/releases',
  },
  geckodriver: {
    category: 'geckodriver',
    description: 'WebDriver for Firefox',
    type: BinaryType.GitHub,
    repo: 'mozilla/geckodriver',
    distUrl: 'https://github.com/mozilla/geckodriver/releases',
  },
  leveldown: {
    category: 'leveldown',
    description: 'Pure C++ Node.js LevelDB binding. An abstract-leveldown compliant store.',
    type: BinaryType.GitHub,
    repo: 'Level/leveldown',
    distUrl: 'https://github.com/Level/leveldown/releases',
  },
  couchbase: {
    category: 'couchbase',
    description: 'Couchbase Node.js Client Library (Official)',
    type: BinaryType.GitHub,
    repo: 'couchbase/couchnode',
    distUrl: 'https://github.com/couchbase/couchnode/releases',
  },
  gl: {
    category: 'gl',
    description: '🎃 Windowless WebGL for node.js',
    type: BinaryType.GitHub,
    repo: 'stackgl/headless-gl',
    distUrl: 'https://github.com/stackgl/headless-gl/releases',
  },
  flow: {
    category: 'flow',
    description: 'Adds static typing to JavaScript to improve developer productivity and code quality.',
    type: BinaryType.GitHub,
    repo: 'facebook/flow',
    distUrl: 'https://github.com/facebook/flow/releases',
  },
  robotjs: {
    category: 'robotjs',
    description: 'Node.js Desktop Automation. http://robotjs.io/',
    type: BinaryType.GitHub,
    repo: 'octalmage/robotjs',
    distUrl: 'https://github.com/octalmage/robotjs/releases',
  },
  poi: {
    category: 'poi',
    description: 'Scalable KanColle browser and tool. https://poi.io/',
    type: BinaryType.GitHub,
    repo: 'poooi/poi',
    distUrl: 'https://github.com/poooi/poi/releases',
  },
  'utf-8-validate': {
    category: 'utf-8-validate',
    description: 'Check if a buffer contains valid UTF-8',
    type: BinaryType.GitHub,
    repo: 'websockets/utf-8-validate',
    distUrl: 'https://github.com/websockets/utf-8-validate/releases',
  },
  minikube: {
    category: 'minikube',
    description: 'Run Kubernetes locally https://minikube.sigs.k8s.io/',
    type: BinaryType.GitHub,
    repo: 'kubernetes/minikube',
    distUrl: 'https://github.com/kubernetes/minikube/releases',
  },
  'sentry-cli': {
    category: 'sentry-cli',
    description: 'A command line utility to work with Sentry. https://docs.sentry.io/cli/',
    type: BinaryType.GitHub,
    repo: 'getsentry/sentry-cli',
    distUrl: 'https://github.com/getsentry/sentry-cli/releases',
  },
  'sharp-libvips': {
    category: 'sharp-libvips',
    description: 'Packaging scripts to prebuild libvips and its dependencies - you\'re probably looking for https://github.com/lovell/sharp',
    type: BinaryType.GitHub,
    repo: 'lovell/sharp-libvips',
    distUrl: 'https://github.com/lovell/sharp-libvips/releases',
  },
  sharp: {
    category: 'sharp',
    description: 'High performance Node.js image processing, the fastest module to resize JPEG, PNG, WebP, AVIF and TIFF images. Uses the libvips library. https://sharp.pixelplumbing.com/',
    type: BinaryType.GitHub,
    repo: 'lovell/sharp',
    distUrl: 'https://github.com/lovell/sharp/releases',
  },
  swc: {
    category: 'swc',
    description: 'swc is a super-fast compiler written in rust; producing widely-supported javascript from modern standards and typescript. https://swc.rs/',
    type: BinaryType.GitHub,
    repo: 'swc-project/swc',
    distUrl: 'https://github.com/swc-project/swc/releases',
  },
  'node-swc': {
    category: 'node-swc',
    description: 'Experimental repo to avoid spamming watchers, see https://github.com/swc-project/swc',
    type: BinaryType.GitHub,
    repo: 'swc-project/node-swc',
    distUrl: 'https://github.com/swc-project/node-swc/releases',
  },
  argon2: {
    category: 'argon2',
    description: 'Node.js bindings for Argon2 hashing algorithm',
    type: BinaryType.GitHub,
    repo: 'ranisalt/node-argon2',
    distUrl: 'https://github.com/ranisalt/node-argon2/releases',
  },
  iohook: {
    category: 'iohook',
    description: 'Node.js global keyboard and mouse listener.',
    type: BinaryType.GitHub,
    repo: 'wilix-team/iohook',
    distUrl: 'https://github.com/wilix-team/iohook/releases',
  },
  saucectl: {
    category: 'saucectl',
    description: 'A command line interface to run testrunner tests',
    type: BinaryType.GitHub,
    repo: 'saucelabs/saucectl',
    distUrl: 'https://github.com/saucelabs/saucectl/releases',
  },
  'node-gdal-async': {
    category: 'node-gdal-async',
    description: 'Node.js bindings for GDAL (Geospatial Data Abstraction Library) with full async support. https://mmomtchev.github.io/node-gdal-async/',
    type: BinaryType.GitHub,
    repo: 'mmomtchev/node-gdal-async',
    distUrl: 'https://github.com/mmomtchev/node-gdal-async/releases',
  },
  'looksgood-s2': {
    category: 'looksgood-s2',
    description: 'Node.js JavaScript & TypeScript bindings for Google S2.',
    type: BinaryType.GitHub,
    repo: 'looksgood/s2',
    distUrl: 'https://github.com/looksgood/s2/releases',
  },
  'ali-zeromq': {
    category: 'ali-zeromq',
    description: 'Node.js bindings for zeromq',
    type: BinaryType.GitHub,
    repo: 'looksgood/zeromq.js',
    distUrl: 'https://github.com/looksgood/zeromq.js/releases',
  },
  'ali-usb_ctl': {
    category: 'ali-usb_ctl',
    description: 'Node.js usb control module',
    type: BinaryType.GitHub,
    repo: 'looksgood/ali-usb_ctl',
    distUrl: 'https://github.com/looksgood/ali-usb_ctl/releases',
  },
  'node-re2': {
    category: 'node-re2',
    description: 'node.js bindings for RE2: fast, safe alternative to backtracking regular expression engines.',
    type: BinaryType.GitHub,
    repo: 'uhop/node-re2',
    distUrl: 'https://github.com/uhop/node-re2/releases',
  },
  sqlite3: {
    category: 'sqlite3',
    description: 'Asynchronous, non-blocking SQLite3 bindings for Node.js',
    type: BinaryType.GitHub,
    repo: 'TryGhost/node-sqlite3',
    distUrl: 'https://github.com/TryGhost/node-sqlite3/releases',
  },
  'better-sqlite3': {
    category: 'better-sqlite3',
    description: 'AsyncThe fastest and simplest library for SQLite3 in Node.js',
    type: BinaryType.GitHub,
    repo: 'WiseLibs/better-sqlite3',
    distUrl: 'https://github.com/WiseLibs/better-sqlite3/releases',
  },
  keytar: {
    category: 'keytar',
    description: 'Native Password Node Module',
    type: BinaryType.GitHub,
    repo: 'atom/node-keytar',
    distUrl: 'https://github.com/atom/node-keytar/releases',
  },
  // PlaywrightBinary
  playwright: {
    category: 'playwright',
    description: 'Playwright is a framework for Web Testing and Automation.',
    type: BinaryType.Playwright,
    repo: 'microsoft/playwright',
    distUrl: 'https://github.com/microsoft/playwright/releases',
  },
  nydus: {
    category: 'nydus',
    description: 'the Dragonfly image service, providing fast, secure and easy access to container images.',
    type: BinaryType.GitHub,
    repo: 'dragonflyoss/image-service',
    distUrl: 'https://github.com/dragonflyoss/image-service/releases',
  },
  canvas: {
    // canvas@<=2.6.1 二进制需要从 node-canvas-prebuilt 下载
    category: 'node-canvas-prebuilt',
    description: 'Node canvas is a Cairo backed Canvas implementation for NodeJS.',
    type: BinaryType.GitHub,
    repo: 'Automattic/node-canvas',
    distUrl: 'https://github.com/Automattic/node-canvas/releases',
  },
  'canvas-prebuilt': {
    category: 'canvas-prebuilt',
    distUrl: 'https://github.com/node-gfx/node-canvas-prebuilt/releases',
    repo: 'chearon/node-canvas-prebuilt',
    description: 'Prebuilt versions of node-canvas as a drop-in replacement',
    type: BinaryType.GitHub,
    options: {
      nodeArchs: {
        linux: [ 'x64' ],
        darwin: [ 'x64' ],
        win32: [ 'x64' ],
      },
    },
  },
  'node-canvas-prebuilt': {
    category: 'node-canvas-prebuilt',
    distUrl: 'https://github.com/node-gfx/node-canvas-prebuilt/releases',
    repo: 'node-gfx/node-canvas-prebuilt',
    description: 'Repo used to build binaries for node-canvas on CI',
    type: BinaryType.GitHub,
    options: {
      nodeArchs: {
        linux: [ 'x64' ],
        darwin: [ 'x64' ],
        win32: [ 'x64' ],
      },
    },
  },
  'libpg-query-node': {
    category: 'libpg-query-node',
    description: 'libpg-query is a real PostgreSQL query parser',
    type: BinaryType.NodePreGyp,
    repo: 'pyramation/libpg-query-node',
    distUrl: 'https://supabase-public-artifacts-bucket.s3.amazonaws.com',
    options: {
      npmPackageName: 'libpg-query',
    },
  },
} as const;

export type BinaryName = keyof typeof binaries;
export type CategoryName = typeof binaries[BinaryName]['category'];

const BinaryConfigMap: Record<BinaryName, BinaryTaskConfig> = {
  ...binaries,
};

export default BinaryConfigMap;
