import { createReadStream } from 'fs';
import * as ssri from 'ssri';

// /@cnpm%2ffoo
// /@cnpm%2Ffoo
// /@cnpm/foo
// /foo
export const FULLNAME_REG_STRING = '@[^/]+\/[^/]+|@[^%]+\%2[fF][^/]+|[^@/]+';

export function getScopeAndName(fullname: string): string[] {
  if (fullname.startsWith('@')) {
    return fullname.split('/', 2);
  }
  return [ '', fullname ];
}

export function getFullname(scope: string, name: string): string {
  return scope ? `${scope}/${name}` : name;
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
