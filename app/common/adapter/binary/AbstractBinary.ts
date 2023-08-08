import { ImplDecorator, Inject, QualifierImplDecoratorUtil } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import { EggHttpClient, EggLogger } from 'egg';
import { BinaryName, BinaryTaskConfig } from '../../../../config/binaries';

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

const platforms = [ 'darwin', 'linux', 'win32' ] as const;

export const BINARY_ADAPTER_ATTRIBUTE = Symbol('BINARY_ADAPTER_ATTRIBUTE');

export abstract class AbstractBinary {
  @Inject()
  protected logger: EggLogger;

  @Inject()
  protected httpclient: EggHttpClient;

  abstract initFetch(binaryName: BinaryName): Promise<void>;
  abstract fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined>;

  protected async requestXml(url: string) {
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 30000,
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
      timeout: 30000,
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
    return platforms;
  }

  protected listNodeArchs(binaryConfig?: BinaryTaskConfig) {
    if (binaryConfig?.options?.nodeArchs) return binaryConfig.options.nodeArchs;
    // https://nodejs.org/api/os.html#osarch
    return {
      linux: [ 'arm', 'arm64', 's390x', 'ia32', 'x64' ],
      darwin: [ 'arm64', 'ia32', 'x64' ],
      win32: [ 'ia32', 'x64' ],
    };
  }

  protected listNodeLibcs(): Record<typeof platforms[number], string[]> {
    // https://github.com/lovell/detect-libc/blob/master/lib/detect-libc.js#L42
    return {
      darwin: [ 'unknown' ],
      linux: [ 'glibc', 'musl' ],
      win32: [ 'unknown' ],
    };
  }
}

export const BinaryAdapter: ImplDecorator<AbstractBinary, typeof BinaryType> =
  QualifierImplDecoratorUtil.generatorDecorator(AbstractBinary, BINARY_ADAPTER_ATTRIBUTE);
