import { basename } from 'node:path';

import { SingletonProto } from 'egg';

import binaries, { type BinaryName } from '../../../../config/binaries.ts';
import { BinaryType } from '../../enum/Binary.ts';
import { AbstractBinary, BinaryAdapter, type BinaryItem, type FetchResult } from './AbstractBinary.ts';

// Mozilla product-details API for listing Firefox versions
// https://product-details.mozilla.org/1.0/firefox.json
const PRODUCT_DETAILS_URL = 'https://product-details.mozilla.org/1.0/firefox.json';

interface FirefoxRelease {
  version: string;
  category: string;
  date: string;
  build_number: number;
  description: string | null;
  is_security_driven: boolean;
  product: string;
}

interface FirefoxProductDetails {
  releases: Record<string, FirefoxRelease>;
}

@SingletonProto()
@BinaryAdapter(BinaryType.Firefox)
export class FirefoxBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  // Only fetch Firefox versions >= 100.0.0 to avoid too old versions
  async fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    // For root directory, use Mozilla's product-details JSON API
    // This is more reliable than parsing the large HTML directory listing
    if (dir === '/') {
      return await this.#fetchRootDir(binaryName);
    }
    return await this.#fetchSubDir(dir, binaryName);
  }

  // Use Mozilla's product-details JSON API to list Firefox versions
  async #fetchRootDir(binaryName: BinaryName): Promise<FetchResult | undefined> {
    const binaryConfig = binaries[binaryName];
    const data = await this.requestJSON<FirefoxProductDetails>(PRODUCT_DETAILS_URL);
    const items = this.#parseProductDetails(data, binaryConfig.options?.ignoreDownloadStatuses);
    return { items, nextParams: null };
  }

  #parseProductDetails(data: FirefoxProductDetails, ignoreDownloadStatuses?: number[]): BinaryItem[] {
    const versionSet = new Set<string>();
    for (const release of Object.values(data.releases)) {
      const version = release.version;
      versionSet.add(version);
    }

    const items: BinaryItem[] = [];
    for (const version of versionSet) {
      // Filter out old Firefox versions (< 100.0.0)
      const match = /^(\d+)/.exec(version);
      if (match) {
        const major = Number.parseInt(match[1]);
        if (major < 100) {
          continue;
        }
      }

      const name = `${version}/`;
      items.push({
        name,
        isDir: true,
        url: '',
        size: '-',
        date: '-',
        ignoreDownloadStatuses,
      });
    }

    // Add special directories
    for (const special of ['latest/', 'latest-beta/', 'latest-esr/']) {
      items.push({
        name: special,
        isDir: true,
        url: '',
        size: '-',
        date: '-',
        ignoreDownloadStatuses,
      });
    }

    return items;
  }

  // Parse Mozilla archive HTML directory listing for subdirectories
  async #fetchSubDir(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    const binaryConfig = binaries[binaryName];
    const url = `${binaryConfig.distUrl}${dir}`;
    const html = await this.requestXml(url);

    // Mozilla archive has format like:
    // <tr>
    //         <td>Dir</td>
    //         <td><a href="/pub/firefox/releases/131.0.3/update/">update/</a></td>
    //         <td></td>
    //         <td></td>
    // </tr>
    // <tr>
    //         <td>File</td>
    //         <td><a href="/pub/firefox/releases/131.0.3/SHA256SUMS.asc">SHA256SUMS.asc</a></td>
    //         <td>833</td>
    //         <td>12-Apr-2025 08:52</td>
    // </tr>

    // Parse Mozilla directory listing format - handles two different formats:
    // Format 1 (main index): <td><a href="/path/">name/</a></td>
    // Format 2 (version dir): <td>Type</td><td><a href="/path/">name</a></td><td>size</td><td>date</td>

    // Try the detailed format first (with Type/Size/Date columns)
    const detailedRe =
      /<tr>\s*<td>(Dir|File)<\/td>\s*<td><a href="([^"]+?)"[^>]*?>[^<]+?<\/a><\/td>\s*<td>([^<]*?)<\/td>\s*<td>([^<]*?)<\/td>\s*<\/tr>/gi;
    const detailedMatches = Array.from(html.matchAll(detailedRe));

    let matchs: RegExpMatchArray[];
    let useDetailedFormat = false;

    if (detailedMatches.length > 0) {
      // Use detailed format
      matchs = detailedMatches;
      useDetailedFormat = true;
    } else {
      // Fallback to simple format
      const simpleRe = /<td><a href="([^"]+?)"[^>]*?>[^<]+?<\/a><\/td>/gi;
      matchs = Array.from(html.matchAll(simpleRe));
    }

    const items: BinaryItem[] = [];

    for (const m of matchs) {
      let href: string;
      let isDir: boolean;
      let size: string;
      let date: string;

      if (useDetailedFormat) {
        // Detailed format: [fullMatch, type, href, size, date]
        const type = m[1]; // "Dir" or "File"
        href = m[2];
        size = m[3].trim() || '-';
        date = m[4].trim() || '-';
        isDir = type === 'Dir';
      } else {
        // Simple format: [fullMatch, href]
        href = m[1];
        isDir = href.endsWith('/');
        size = '-';
        date = '-';
      }

      // Extract the name from the href path
      // href could be "/pub/firefox/releases/130.0/" or just "130.0/"
      let name = href;
      if (href.startsWith('/')) {
        // Extract the last part of the path
        const parts = href.split('/').filter(Boolean);
        name = parts[parts.length - 1] ?? '';
        if (href.endsWith('/')) {
          name += '/';
        }
      }

      if (!isDir) {
        // Keep the full name for files
        name = basename(name);
      }

      // Skip parent directory links
      if (name === '../' || href === '/pub/firefox/' || href.endsWith('/..') || href === '/pub/firefox/releases/')
        continue;

      // Filter out old Firefox versions (< 100.0.0) for directories - apply to main index (root directory)
      if (isDir && name !== '../' && dir === '/') {
        const versionName = name.slice(0, -1); // Remove trailing '/'
        // Skip non-version directories that are just special names
        if (/^\d+\.\d+/.test(versionName)) {
          try {
            const major = Number.parseInt(versionName.split('.')[0]);
            if (major < 100) {
              continue; // Skip versions < 100.0.0
            }
          } catch {
            // If version parsing fails, skip this directory
            continue;
          }
        }
        // Also skip named directories that aren't version numbers
        else if (!['latest', 'latest-beta', 'latest-esr'].includes(versionName)) {
          continue;
        }
      }

      const fileUrl = isDir ? '' : `${url}${name}`;
      if (binaryConfig.ignoreFiles?.includes(`${dir}${name}`)) continue;

      const item = {
        name,
        isDir,
        url: fileUrl,
        size,
        date,
        ignoreDownloadStatuses: binaryConfig.options?.ignoreDownloadStatuses,
      };
      items.push(item);
    }
    return { items, nextParams: null };
  }
}
