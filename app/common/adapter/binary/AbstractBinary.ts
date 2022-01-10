import { EggContextHttpClient, EggLogger } from 'egg';
import { BinaryTaskConfig } from '../../../../config/binaries';

export type BinaryItem = {
  name: string;
  isDir: boolean;
  url: string;
  size: string | number;
  date: string;
  ignoreDownloadStatuses?: number[];
};

export type FetchResult = {
  items: BinaryItem[];
  nextParams?: any;
};

export abstract class AbstractBinary {
  protected httpclient: EggContextHttpClient;
  protected logger: EggLogger;
  protected binaryConfig: BinaryTaskConfig;

  constructor(httpclient: EggContextHttpClient, logger: EggLogger, binaryConfig: BinaryTaskConfig) {
    this.httpclient = httpclient;
    this.logger = logger;
    this.binaryConfig = binaryConfig;
  }

  abstract fetch(dir: string, params?: any): Promise<FetchResult | undefined>;

  protected async requestXml(url: string) {
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 20000,
      followRedirect: true,
      gzip: true,
    });
    const xml = data.toString() as string;
    if (status !== 200) {
      this.logger.warn('[AbstractBinary.requestXml:non-200-status] url: %s, status: %s, headers: %j, xml: %j', url, status, headers, xml);
      return '';
    }
    return xml;
  }

  protected async requestJSON(url: string) {
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 20000,
      dataType: 'json',
      followRedirect: true,
      gzip: true,
    });
    if (status !== 200) {
      this.logger.warn('[AbstractBinary.requestJSON:non-200-status] url: %s, status: %s, headers: %j', url, status, headers);
      return data;
    }
    return data;
  }

  // https://nodejs.org/api/n-api.html#n_api_node_api_version_matrix
  protected async listNodeABIVersions() {
    const nodeABIVersions: number[] = [];
    const versions = await this.requestJSON('https://nodejs.org/dist/index.json');
    for (const version of versions) {
      if (!version.modules) continue;
      const modulesVersion = parseInt(version.modules);
      // node v6.0.0 moduels 48 min
      if (modulesVersion >= 48 && !nodeABIVersions.includes(modulesVersion)) {
        nodeABIVersions.push(modulesVersion);
      }
    }
    return nodeABIVersions;
  }

  protected listNodePlatforms() {
    // https://nodejs.org/api/os.html#osplatform
    return [ 'darwin', 'linux', 'win32' ];
  }

  protected listNodeArchs() {
    if (this.binaryConfig.options?.nodeArchs) return this.binaryConfig.options.nodeArchs;
    // https://nodejs.org/api/os.html#osarch
    return {
      linux: [ 'arm', 'arm64', 's390x', 'ia32', 'x64' ],
      darwin: [ 'arm64', 'ia32', 'x64' ],
      win32: [ 'ia32', 'x64' ],
    };
  }

  protected listNodeLibcs() {
    // https://github.com/lovell/detect-libc/blob/master/lib/detect-libc.js#L42
    return {
      linux: [ 'glibc', 'musl' ],
      darwin: [ 'unknown' ],
      win32: [ 'unknown' ],
    };
  }
}
