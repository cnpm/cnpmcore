import * as ssri from 'ssri';

export function getScope(name: string): string | undefined {
  if (name[0] === '@') {
    return name.split('/', 1)[0];
  }
}

export function calculateIntegrity(content: Uint8Array) {
  const integrityObj = ssri.fromData(content, {
    algorithms: [ 'sha512', 'sha1' ],
  });
  const integrity = integrityObj.sha512[0].toString() as string;
  const shasum = integrityObj.sha1[0].hexDigest() as string;
  return { integrity, shasum };
}
