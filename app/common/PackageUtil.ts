import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as ssri from 'ssri';
import tar from 'tar';
import { AuthorType, PackageJSONType } from '../repository/PackageRepository';


// /@cnpm%2ffoo
// /@cnpm%2Ffoo
// /@cnpm/foo
// /foo
// name max length is 214 chars
// https://www.npmjs.com/package/path-to-regexp#custom-matching-parameters
export const FULLNAME_REG_STRING = '@[^/]{1,220}\/[^/]{1,220}|@[^%]+\%2[fF][^/]{1,220}|[^@/]{1,220}';

export function getScopeAndName(fullname: string): string[] {
  if (fullname.startsWith('@')) {
    return fullname.split('/', 2);
  }
  return [ '', fullname ];
}

export function getFullname(scope: string, name: string): string {
  return scope ? `${scope}/${name}` : name;
}

export function cleanUserPrefix(username: string): string {
  return username.replace(/^.*:/, '');
}

export function getPrefixedName(prefix: string, username: string): string {
  return prefix ? `${prefix}${username}` : username;
}

export async function calculateIntegrity(contentOrFile: Uint8Array | string) {
  let integrityObj;
  if (typeof contentOrFile === 'string') {
    integrityObj = await ssri.fromStream(createReadStream(contentOrFile), {
      algorithms: [ 'sha512', 'sha1' ],
    });
  } else {
    integrityObj = ssri.fromData(contentOrFile, {
      algorithms: [ 'sha512', 'sha1' ],
    });
  }
  const integrity = integrityObj.sha512[0].toString() as string;
  const shasum = integrityObj.sha1[0].hexDigest() as string;
  return { integrity, shasum };
}

export function formatTarball(registry: string, scope: string, name: string, version: string) {
  const fullname = getFullname(scope, name);
  return `${registry}/${fullname}/-/${name}-${version}.tgz`;
}

export function detectInstallScript(manifest: any) {
  // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md#abbreviated-version-object
  let hasInstallScript = false;
  const scripts = manifest.scripts;
  if (scripts) {
    // https://www.npmjs.com/package/fix-has-install-script
    if (scripts.install || scripts.preinstall || scripts.postinstall) {
      hasInstallScript = true;
    }
  }
  return hasInstallScript;
}

/** 判断一个版本压缩包中是否包含 npm-shrinkwrap.json */
export async function hasShrinkWrapInTgz(contentOrFile: Uint8Array | string): Promise<boolean> {
  let readable: Readable;
  if (typeof contentOrFile === 'string') {
    readable = createReadStream(contentOrFile);
  } else {
    readable = new Readable({
      read() {
        this.push(contentOrFile);
        this.push(null);
      },
    });
  }

  let hasShrinkWrap = false;
  const abortController = new AbortController();
  const parser = tar.t({
    // options.strict 默认为 false，会忽略 Recoverable errors，例如 tar 解析失败
    // 详见 https://github.com/isaacs/node-tar#warnings-and-errors
    onentry(entry) {
      if (entry.path === 'package/npm-shrinkwrap.json') {
        hasShrinkWrap = true;
        abortController.abort();
      }
    },
  });

  try {
    await pipeline(readable, parser, { signal: abortController.signal });
    return hasShrinkWrap;
  } catch (e) {
    if (e.code === 'ABORT_ERR') {
      return hasShrinkWrap;
    }
    throw Object.assign(new Error('[hasShrinkWrapInTgz] Fail to parse input file'), { cause: e });
  }
}

/** 写入 ES 时，格式化 author */
export function formatAuthor(author: string | AuthorType | undefined): AuthorType | undefined {
  if (author === undefined) {
    return author;
  }

  if (typeof author === 'string') {
    return { name: author };
  }

  return author;
}

export async function extractPackageJSON(tarballBytes: Buffer): Promise<PackageJSONType> {
  return new Promise((resolve, reject) => {
    Readable.from(tarballBytes)
      .pipe(tar.t({
        filter: name => name === 'package/package.json',
        onentry: async entry => {
          const chunks: Buffer[] = [];
          for await (const chunk of entry) {
            chunks.push(chunk);
          }
          try {
            const data = Buffer.concat(chunks);
            return resolve(JSON.parse(data.toString()));
          } catch (err) {
            reject(new Error('Error parsing package.json'));
          }
        },
      }));
  });
}
