import { SingletonProto } from 'egg';

import { BinaryType } from '../../enum/Binary.ts';
import { AbstractBinary, BinaryAdapter, type BinaryItem, type FetchResult } from './AbstractBinary.ts';

// Microsoft moved the Edge WebDriver download listing off the public
// Azure Blob container (the old XML listing API returns
// `PublicAccessNotPermitted` since ~2026-04-07). The new source of truth
// is a single JSON dump at https://msedgedriver.microsoft.com/listing.json
// which lists every version-prefixed driver file; individual files are
// downloadable from https://msedgedriver.microsoft.com/<name>.
const EDGEDRIVER_LISTING_URL = 'https://msedgedriver.microsoft.com/listing.json';
const EDGEDRIVER_DOWNLOAD_BASE = 'https://msedgedriver.microsoft.com/';

interface EdgedriverListingEntry {
  isDirectory: boolean;
  name: string;
  contentLength: number;
  lastModified: string;
}
interface EdgedriverListing {
  items: EdgedriverListingEntry[];
  generatedAt: string;
}

@SingletonProto()
@BinaryAdapter(BinaryType.Edgedriver)
export class EdgedriverBinary extends AbstractBinary {
  private dirItems?: {
    [key: string]: BinaryItem[];
  };
  // Promise-level cache for the full `listing.json` dump (~9000 entries).
  // A single sync task calls `fetch('/<version>/')` for many versions;
  // without this cache each call would re-download the listing.
  // Reset in `initFetch` so each sync task gets fresh data.
  #listingPromise?: Promise<EdgedriverListing | undefined>;

  async initFetch() {
    this.dirItems = undefined;
    this.#listingPromise = undefined;
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

    // fetch sub dir
    // /126.0.2578.0/ => 126.0.2578.0/
    const subDir = dir.slice(1);
    const listing = await this.#fetchListing();
    // Return undefined (not an empty-items FetchResult) on listing
    // failure so the caller can distinguish "listing unavailable" from
    // "this version exists but has no files".
    if (!listing?.items) {
      return;
    }
    const items: BinaryItem[] = [];
    for (const entry of listing.items) {
      if (entry.isDirectory) continue;
      if (!entry.name.startsWith(subDir)) continue;
      // Only direct children of `subDir`, not nested paths.
      const rest = entry.name.slice(subDir.length);
      if (!rest || rest.includes('/')) continue;
      items.push({
        name: rest,
        isDir: false,
        url: `${EDGEDRIVER_DOWNLOAD_BASE}${entry.name}`,
        size: entry.contentLength,
        date: entry.lastModified,
      });
    }
    return { items, nextParams: null };
  }

  async #fetchListing(): Promise<EdgedriverListing | undefined> {
    if (!this.#listingPromise) {
      this.#listingPromise = this.#loadListing();
    }
    return this.#listingPromise;
  }

  async #loadListing(): Promise<EdgedriverListing | undefined> {
    try {
      // `AbstractBinary.requestJSON` already handles timeout / follow
      // redirect / gzip / non-200 warn logging. It returns whatever
      // `data` the server sent even on non-200, so we validate the
      // shape before trusting it.
      const listing = await this.requestJSON<EdgedriverListing>(EDGEDRIVER_LISTING_URL);
      if (!listing?.items || !Array.isArray(listing.items)) {
        return;
      }
      return listing;
    } catch (err) {
      this.logger.warn(
        '[EdgedriverBinary.loadListing:request-failed] url: %s, error: %s',
        EDGEDRIVER_LISTING_URL,
        (err as Error).message,
      );
      // Clear the cached promise so the next sync task retries cleanly.
      this.#listingPromise = undefined;
      return;
    }
  }
}
