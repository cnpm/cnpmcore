import fs from 'node:fs/promises';

export async function npmLogin(registry: string, userconfig: string) {
  const response = await fetch(`${registry}/-/user/org.couchdb.user:testuser`, {
    headers: {
      Authorization: 'Bearer 123123123',
      'Content-Type': 'application/json',
    },
    method: 'PUT',
    body: JSON.stringify({
      name: 'testuser',
      password: '123123123',
      email: 'testuser@example.com',
      type: 'user',
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to login: ${await response.text()}`);
  }
  const body = await response.json();
  const registryUrl = new URL(registry);
  await fs.writeFile(userconfig, `\n//${registryUrl.host}/:_authToken=${body.token}\n`);
}
