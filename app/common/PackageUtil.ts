import { createReadStream } from 'fs';
import * as ssri from 'ssri';

export function getScope(name: string): string | undefined {
  if (name.startsWith('@')) {
    return name.split('/', 1)[0];
  }
}

// get filename from package name
// @foo/bar == filename: bar
// bar == filename: bar
export function getFilename(name: string) {
  return name.startsWith('@') ? name.split('/', 2)[1] : name;
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

export function formatTarball(registry: string, name: string, version: string) {
  const filename = name.startsWith('@') ? name.split('/', 2)[1] : name;
  return `${registry}/${name}/-/${filename}-${version}.tgz`;
}
