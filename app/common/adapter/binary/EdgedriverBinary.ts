import path from 'node:path';
import { SingletonProto } from '@eggjs/tegg';
import {
  AbstractBinary, FetchResult, BinaryItem, BinaryAdapter,
} from './AbstractBinary.js';
import { BinaryType } from '../../enum/Binary.js';

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
      return { items: this.dirItems![dir], nextParams: null };
    }

    // fetch sub dir
    // /foo/ => foo/
    const subDir = dir.substring(1);
    // https://msedgewebdriverstorage.blob.core.windows.net/edgewebdriver?prefix=124.0.2478.97/&delimiter=/&maxresults=100&restype=container&comp=list
    const url = `https://msedgewebdriverstorage.blob.core.windows.net/edgewebdriver?prefix=${encodeURIComponent(subDir)}&delimiter=/&maxresults=100&restype=container&comp=list`;
    const xml = await this.requestXml(url);
    return { items: this.#parseItems(xml), nextParams: null };
  }

  #parseItems(xml: string): BinaryItem[] {
    const items: BinaryItem[] = [];
    // <Blob><Name>124.0.2478.97/edgedriver_arm64.zip</Name><Url>https://msedgewebdriverstorage.blob.core.windows.net/edgewebdriver/124.0.2478.97/edgedriver_arm64.zip</Url><Properties><Last-Modified>Fri, 10 May 2024 18:35:44 GMT</Last-Modified><Etag>0x8DC712000713C13</Etag><Content-Length>9191362</Content-Length><Content-Type>application/octet-stream</Content-Type><Content-Encoding /><Content-Language /><Content-MD5>1tjPTf5JU6KKB06Qf1JOGw==</Content-MD5><Cache-Control /><BlobType>BlockBlob</BlobType><LeaseStatus>unlocked</LeaseStatus></Properties></Blob>
    const fileRe = /<Blob><Name>([^<]+?)<\/Name><Url>([^<]+?)<\/Url><Properties><Last\-Modified>([^<]+?)<\/Last\-Modified><Etag>(?:[^<]+?)<\/Etag><Content\-Length>(\d+)<\/Content\-Length>/g;
    const matchItems = xml.matchAll(fileRe);
    for (const m of matchItems) {
      const fullname = m[1].trim();
      // <Blob>
      //   <Name>124.0.2478.97/edgedriver_arm64.zip</Name>
      //   <Url>https://msedgewebdriverstorage.blob.core.windows.net/edgewebdriver/124.0.2478.97/edgedriver_arm64.zip</Url>
      //   <Properties>
      //     <Last-Modified>Fri, 10 May 2024 18:35:44 GMT</Last-Modified>
      //     <Etag>0x8DC712000713C13</Etag>
      //     <Content-Length>9191362</Content-Length>
      //     <Content-Type>application/octet-stream</Content-Type>
      //     <Content-Encoding/>
      //     <Content-Language/>
      //     <Content-MD5>1tjPTf5JU6KKB06Qf1JOGw==</Content-MD5>
      //     <Cache-Control/>
      //     <BlobType>BlockBlob</BlobType>
      //     <LeaseStatus>unlocked</LeaseStatus>
      //   </Properties>
      // </Blob>
      // ignore size = 0 dir
      const name = path.basename(fullname);
      const url = m[2].trim();
      const date = m[3].trim();
      const size = parseInt(m[4].trim());
      items.push({
        name,
        isDir: false,
        url,
        size,
        date,
      });
    }
    return items;
  }
}
