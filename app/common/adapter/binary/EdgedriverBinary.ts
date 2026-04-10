import { SingletonProto } from '@eggjs/tegg';
import {
  AbstractBinary, FetchResult, BinaryItem, BinaryAdapter,
} from './AbstractBinary';
import { BinaryType } from '../../enum/Binary';

// Microsoft moved Edge WebDriver binaries to https://msedgedriver.microsoft.com/
// in July 2025 after `msedgedriver.azureedge.net` was retired, and around
// 2026-04-07 also disabled public access on the legacy Azure Blob container
// that used to host the XML file listing. There is still no paginated/filtered
// listing API — the only "listing" endpoint on the new host is a ~1.2MB static
// JSON dump (`/listing.json`, ~9000 entries covering every version since
// 112.0.1722.39).
//
// To avoid hammering that 1.2MB dump for every version subdirectory during a
// sync, we mirror the approach used by `FirefoxBinary` / `ChromeForTestingBinary`
// and generate the per-version download URLs from a static list of known
// platform filenames. cnpmcore's sync pipeline honors the per-item
// `ignoreDownloadStatuses` field, so any version that doesn't ship a given
// platform (e.g. older builds without `edgedriver_mac64_m1.zip`) gets a clean
// 404 and is skipped rather than failing the sync.
const EDGEDRIVER_DOWNLOAD_BASE = 'https://msedgedriver.microsoft.com/';
// Platform filenames observed in Microsoft's current `listing.json` dump.
// Every version since 112.0.1722.39 ships some subset of these six files.
const EDGEDRIVER_PLATFORM_FILES = [
  'edgedriver_arm64.zip',
  'edgedriver_linux64.zip',
  'edgedriver_mac64.zip',
  'edgedriver_mac64_m1.zip',
  'edgedriver_win32.zip',
  'edgedriver_win64.zip',
] as const;

@SingletonProto()
@BinaryAdapter(BinaryType.Edgedriver)
export class EdgedriverBinary extends AbstractBinary {
  private dirItems?: {
    [key: string]: BinaryItem[];
  };

  async initFetch() {
    this.dirItems = undefined;
  }

  async #syncDirItems() {
    this.dirItems = {};
    this.dirItems['/'] = [];
    const jsonApiEndpoint = 'https://edgeupdates.microsoft.com/api/products';
    const { data, status, headers } = await this.httpclient.request(jsonApiEndpoint, {
      dataType: 'json',
      timeout: 30000,
      followRedirect: true,
      gzip: true,
    });
    if (status !== 200) {
      this.logger.warn('[EdgedriverBinary.request:non-200-status] url: %s, status: %s, headers: %j, data: %j',
        jsonApiEndpoint, status, headers, data);
      return;
    }
    this.logger.info('[EdgedriverBinary] remote data length: %s', data.length);
    const products = data as {
      Product: string;
      Releases: {
        ReleaseId: number;
        Platform: string;
        Architecture: string;
        CVEs: string[];
        ProductVersion: string;
        Artifacts: {
          ArtifactName: string;
          Location: string;
          Hash: string;
          HashAlgorithm: string;
          SizeInBytes: string;
        }[];
        PublishedTime: string;
        ExpectedExpiryDate: string;
      }[];
    }[];
    const existsVersions = new Set<string>();
    for (const product of products) {
      if (product.Product === 'EdgeUpdate') continue;
      for (const release of product.Releases) {
        if (!release.Artifacts || release.Artifacts.length === 0) continue;
        if (existsVersions.has(release.ProductVersion)) continue;
        this.dirItems['/'].push({
          name: `${release.ProductVersion}/`,
          date: release.PublishedTime,
          size: '-',
          isDir: true,
          url: '',
        });
        existsVersions.add(release.ProductVersion);
      }
    }
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      await this.#syncDirItems();
    }
    // fetch root dir
    if (dir === '/') {
      return { items: this.dirItems![dir], nextParams: null };
    }

    // fetch sub dir: generate the known platform filenames for this version.
    // We intentionally don't call any listing API — see the file-level
    // comment for the rationale. Any platform that doesn't exist for a
    // specific version is skipped cleanly via `ignoreDownloadStatuses`.
    // /126.0.2578.0/ => 126.0.2578.0/
    const subDir = dir.substring(1);
    const items: BinaryItem[] = EDGEDRIVER_PLATFORM_FILES.map(name => ({
      name,
      isDir: false,
      url: `${EDGEDRIVER_DOWNLOAD_BASE}${subDir}${name}`,
      size: '-',
      date: '-',
      ignoreDownloadStatuses: [ 404 ],
    }));
    return { items, nextParams: null };
  }
}
