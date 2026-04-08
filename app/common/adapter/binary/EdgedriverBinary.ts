import { SingletonProto } from 'egg';

import { BinaryType } from '../../enum/Binary.ts';
import { AbstractBinary, BinaryAdapter, type BinaryItem, type FetchResult } from './AbstractBinary.ts';

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
      timeout: 30_000,
      followRedirect: true,
      gzip: true,
    });
    if (status !== 200) {
      this.logger.warn(
        '[EdgedriverBinary.request:non-200-status] url: %s, status: %s, headers: %j, data: %j',
        jsonApiEndpoint,
        status,
        headers,
        data,
      );
      return;
    }
    this.logger.info('[EdgedriverBinary] remote data length: %s', data.length);
    // [
    //   {
    //     "Product": "Stable",
    //     "Releases": [
    //       {
    //         "ReleaseId": 73376,
    //         "Platform": "iOS",
    //         "Architecture": "arm64",
    //         "CVEs": [],
    //         "ProductVersion": "124.0.2478.89",
    //         "Artifacts": [],
    //         "PublishedTime": "2024-05-07T02:57:00",
    //         "ExpectedExpiryDate": "2025-05-07T02:57:00"
    //       },
    //       {
    //         "ReleaseId": 73629,
    //         "Platform": "Windows",
    //         "Architecture": "x86",
    //         "CVEs": [
    //           "CVE-2024-4559",
    //           "CVE-2024-4671"
    //         ],
    //         "ProductVersion": "124.0.2478.97",
    //         "Artifacts": [
    //           {
    //             "ArtifactName": "msi",
    //             "Location": "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/aa1c9fe3-bb9c-4a80-9ff7-5c109701fbfe/MicrosoftEdgeEnterpriseX86.msi",
    //             "Hash": "4CEF7B907D3E2371E953C41190E32C3560CEE7D3F16D7550CA156DC976EBCB80",
    //             "HashAlgorithm": "SHA256",
    //             "SizeInBytes": 162029568
    //           }
    //         ],
    //         "PublishedTime": "2024-05-11T06:47:00",
    //         "ExpectedExpiryDate": "2025-05-10T16:59:00"
    //       },
    //       {
    //         "ReleaseId": 73630,
    //         "Platform": "Linux",
    //         "Architecture": "x64",
    //         "CVEs": [
    //           "CVE-2024-4559"
    //         ],
    //         "ProductVersion": "124.0.2478.97",
    //         "Artifacts": [
    //           {
    //             "ArtifactName": "rpm",
    //             "Location": "https://packages.microsoft.com/yumrepos/edge/microsoft-edge-stable-124.0.2478.97-1.x86_64.rpm",
    //             "Hash": "32D9C333544DDD9C56FED54844E89EF00F3E5620942C07B9B68D214016687895",
    //             "HashAlgorithm": "SHA256",
    //             "SizeInBytes": 169877932
    //           },
    //           {
    //             "ArtifactName": "deb",
    //             "Location": "https://packages.microsoft.com/repos/edge/pool/main/m/microsoft-edge-stable/microsoft-edge-stable_124.0.2478.97-1_amd64.deb",
    //             "Hash": "85D0AD1D63847B3DD54F0F214D18A2B54462BB43291536E773AD1B8B29BBF799",
    //             "HashAlgorithm": "SHA256",
    //             "SizeInBytes": 167546042
    //           }
    //         ],
    //         "PublishedTime": "2024-05-10T17:01:00",
    //         "ExpectedExpiryDate": "2025-05-10T17:01:00"
    //       },
    // {
    //   "Product": "EdgeUpdate",
    //   "Releases": [
    //     {
    //       "ReleaseId": 73493,
    //       "Platform": "Windows",
    //       "Architecture": "x86",
    //       "CVEs": [],
    //       "ProductVersion": "1.3.187.37",
    //       "Artifacts": [
    //         {
    //           "ArtifactName": "exe",
    //           "Location": "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/a2fa84fe-796b-4f80-b1cd-f4d1f5731aa8/MicrosoftEdgeUpdateSetup_X86_1.3.187.37.exe",
    //           "Hash": "503088D22461FEE5D7B6B011609D73FFD5869D3ACE1DBB0F00F8F3B9D122C514",
    //           "HashAlgorithm": "SHA256",
    //           "SizeInBytes": 1622072
    //         }
    //       ],
    //       "PublishedTime": "2024-05-08T05:44:00",
    //       "ExpectedExpiryDate": "2025-05-08T05:44:00"
    //     }
    //   ]
    // }
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
      return { items: this.dirItems?.[dir] ?? [], nextParams: null };
    }

    // fetch sub dir: generate the known platform filenames for this version.
    // We intentionally don't call any listing API — see the file-level
    // comment for the rationale. Any platform that doesn't exist for a
    // specific version is skipped cleanly via `ignoreDownloadStatuses`.
    // /126.0.2578.0/ => 126.0.2578.0/
    const subDir = dir.slice(1);
    const items: BinaryItem[] = EDGEDRIVER_PLATFORM_FILES.map((name) => ({
      name,
      isDir: false,
      url: `${EDGEDRIVER_DOWNLOAD_BASE}${subDir}${name}`,
      size: '-',
      date: '-',
      ignoreDownloadStatuses: [404],
    }));
    return { items, nextParams: null };
  }
}
