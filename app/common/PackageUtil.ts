import { createReadStream } from 'fs';
import tar from 'tar';
import stream from 'stream';
import * as ssri from 'ssri';

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
  let readable: stream.Readable;
  if (typeof contentOrFile === 'string') {
    readable = createReadStream(contentOrFile);
  } else {
    readable = new stream.Readable({
      read() {
        this.push(contentOrFile);
        this.push(null);
      },
    });
  }

  let hasShrinkWrap = false;
  const abortController = new AbortController()
  const parser = new tar.Parse({
    onentry(entry) {
      if (entry.path === 'package/npm-shrinkwrap.json') {
        hasShrinkWrap = true;
        abortController.abort();
      } else {
        // 继续解析下一个文件
        // 详见 https://github.com/isaacs/node-tar#class-tarparse
        entry.resume();
      }
    },
  });

  return stream.promises.pipeline(readable, parser, { signal: abortController.signal })
    .then(() => hasShrinkWrap)
    .catch(() => hasShrinkWrap);
}
