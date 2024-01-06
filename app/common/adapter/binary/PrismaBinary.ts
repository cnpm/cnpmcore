import path from 'node:path';
import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import binaries, { BinaryName } from '../../../../config/binaries';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.Prisma)
export class PrismaBinary extends AbstractBinary {
  private dirItems: {
    [key: string]: BinaryItem[];
  } = {};

  async initFetch() {
    // https://github.com/cnpm/cnpmcore/issues/473#issuecomment-1562115738
    const pkgUrl = 'https://registry.npmjs.com/@prisma/engines';
    const data = await this.requestJSON(pkgUrl);
    const modified = data.time.modified;
    this.dirItems = {};
    this.dirItems['/'] = [
      {
        name: 'all_commits/',
        date: modified,
        size: '-',
        isDir: true,
        url: '',
      },
    ];
    this.dirItems['/all_commits/'] = [];
    const commitIdMap: Record<string, boolean> = {};
    // https://list-binaries.prisma-orm.workers.dev/?delimiter=/&prefix=all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/
    for (const version in data.versions) {
      const major = parseInt(version.split('.', 1)[0]);
      // need >= 3.0.0
      if (major < 3) continue;
      const date = data.time[version];
      const pkg = data.versions[version];
      // https://registry.npmjs.com/@prisma/engines/4.14.1
      // https://registry.npmjs.com/@prisma/engines/5.7.0 should read from dependencies
      const enginesVersion = pkg.devDependencies?.['@prisma/engines-version']
        || pkg.dependencies?.['@prisma/engines-version'] || '';
      // "@prisma/engines-version": "4.14.0-67.d9a4c5988f480fa576d43970d5a23641aa77bc9c"
      // "@prisma/engines-version": "5.7.0-41.79fb5193cf0a8fdbef536e4b4a159cad677ab1b9"
      const matched = /\.(\w{30,})$/.exec(enginesVersion);
      if (!matched) continue;
      const commitId = matched[1];
      if (commitIdMap[commitId]) continue;
      commitIdMap[commitId] = true;
      this.dirItems['/all_commits/'].push({
        name: `${commitId}/`,
        date,
        size: '-',
        isDir: true,
        url: '',
      });
    }
  }

  async fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    const existsItems = this.dirItems[dir];
    if (existsItems) {
      return { items: existsItems, nextParams: null };
    }
    // /foo/ => foo/
    const binaryConfig = binaries[binaryName];
    const subDir = dir.substring(1);
    const url = `${binaryConfig.distUrl}?delimiter=/&prefix=${encodeURIComponent(subDir)}`;
    const result = await this.requestJSON(url);
    return { items: this.#parseItems(result), nextParams: null };
  }

  #parseItems(result: any): BinaryItem[] {
    const items: BinaryItem[] = [];
    // objects": [
    //   {
    //   "uploaded": "2023-05-23T15:43:05.772Z",
    //   "checksums": {
    //   "md5": "d41d8cd98f00b204e9800998ecf8427e"
    //   },
    //   "httpEtag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    //   "etag": "d41d8cd98f00b204e9800998ecf8427e",
    //   "size": 0,
    //   "version": "7e77b6b8c1d214f2c6be3c959749b5a6",
    //   "key": "all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/darwin-arm64/.finished"
    //   },
    // {
    //   "uploaded": "2023-05-23T15:41:33.861Z",
    //   "checksums": {
    //   "md5": "4822215a13ae372ae82afd12689fce37"
    //   },
    //   "httpEtag": "\"4822215a13ae372ae82afd12689fce37\"",
    //   "etag": "4822215a13ae372ae82afd12689fce37",
    //   "size": 96,
    //   "version": "7e77b6ba29d4e776023e4fa62825c13a",
    //   "key": "all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/darwin-arm64/libquery_engine.dylib.node.gz.sha256"
    //   },
    // https://list-binaries.prisma-orm.workers.dev/?delimiter=/&prefix=all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/darwin-arm64/
    const objects: {
      uploaded: string;
      size: number;
      key: string;
    }[] = result.objects || [];
    for (const o of objects) {
      const fullname = o.key;
      // ignore size = 0
      if (o.size === 0) continue;
      const name = path.basename(fullname);
      items.push({
        name,
        isDir: false,
        // https://binaries.prisma.sh/all_commits/2452cc6313d52b8b9a96999ac0e974d0aedf88db/darwin-arm64/prisma-fmt.gz
        url: `https://binaries.prisma.sh/${fullname}`,
        size: o.size,
        date: o.uploaded,
      });
    }
    // delimitedPrefixes: [ 'all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/darwin-arm64/' ]
    // https://list-binaries.prisma-orm.workers.dev/?delimiter=/&prefix=all_commits/61023c35d2c8762f66f09bc4183d2f630b541d08/
    const delimitedPrefixes: string[] = result.delimitedPrefixes || [];
    for (const fullname of delimitedPrefixes) {
      const name = `${path.basename(fullname)}/`;
      items.push({
        name,
        isDir: true,
        url: '',
        size: '-',
        date: new Date().toISOString(),
      });
    }
    return items;
  }
}
