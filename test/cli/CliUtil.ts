import coffee from 'coffee';

export async function npmLogin(registry: string, userconfig: string) {
  await coffee
    .spawn('npm-cli-login', [], {
      env: {
        ...process.env,
        NPM_USER: 'testuser',
        NPM_PASS: '123123123',
        NPM_EMAIL: 'testuser@example.com',
        NPM_REGISTRY: registry,
        NPM_RC_PATH: userconfig,
      },
    })
    .debug()
    .expect('code', 0)
    .end();
}
