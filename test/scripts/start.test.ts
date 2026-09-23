import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import pkg from '../../package.json' with { type: 'json' };

const execFileAsync = promisify(execFile);

describe('test/scripts/start.test.ts', () => {
  let directory: string;
  let statusFile: string;
  let server: Server;
  let port: number;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'cnpmcore-start-'));
    statusFile = path.join(directory, 'egg.status');
    await mkdir(path.join(directory, 'bin'));
    await mkdir(path.join(directory, 'scripts'));
    await copyFile(
      new URL('../../scripts/wait-for-ready.mjs', import.meta.url),
      path.join(directory, 'scripts/wait-for-ready.mjs'),
    );
    await writeFile(statusFile, 'stale status');
    await writeFile(
      path.join(directory, 'bin/eggctl'),
      '#!/bin/sh\n[ "$*" = "start --daemon --ignore-stderr" ] || exit 2\necho "ExperimentalWarning: Web Crypto" >&2\nexit "${EGGCTL_EXIT_CODE:-0}"\n',
      { mode: 0o755 },
    );
    server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });

  function start(env: NodeJS.ProcessEnv = {}) {
    return execFileAsync('sh', ['-c', pkg.scripts.start], {
      cwd: directory,
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: [path.join(directory, 'bin'), path.dirname(process.execPath), process.env.PATH].join(path.delimiter),
        CNPMCORE_HEALTH_CHECK_URL: `http://127.0.0.1:${port}/`,
        CNPMCORE_HEALTH_CHECK_TIMEOUT: '200',
        ...env,
      },
    });
  }

  it('creates the status file only after the registry becomes ready despite startup warnings', async () => {
    let requests = 0;
    server.on('request', (request, response) => {
      assert.equal(request.url, '/');
      assert.equal(existsSync(statusFile), false);
      requests++;
      if (requests === 1) {
        response.writeHead(503).end('starting');
      } else if (requests === 2) {
        response.end('{"message":"instance_start_time"}');
      } else {
        response.end(JSON.stringify({ instance_start_time: new Date().toISOString() }));
      }
    });

    const result = await start({ CNPMCORE_HEALTH_CHECK_TIMEOUT: '5000' });
    assert.equal(requests, 3);
    assert.match(result.stderr, /ExperimentalWarning/);
    assert.match(result.stdout, /cnpmcore is ready/);
    assert.equal(existsSync(statusFile), true);
  });

  it('uses PORT when no health check URL is specified', async () => {
    server.on('request', (_request, response) => {
      response.end(JSON.stringify({ instance_start_time: new Date().toISOString() }));
    });
    await start({ CNPMCORE_HEALTH_CHECK_URL: '', PORT: String(port), CNPMCORE_HEALTH_CHECK_TIMEOUT: '2000' });
    assert.equal(existsSync(statusFile), true);
  });

  for (const [status, body] of [
    [503, '{"instance_start_time":"2026-09-23T00:00:00.000Z"}'],
    [200, '{"message":"instance_start_time"}'],
    [200, '{"instance_start_time":null}'],
    [200, 'not JSON'],
  ] as const) {
    it(`fails without a status file for HTTP ${status} with body ${body}`, async () => {
      server.on('request', (_request, response) => {
        response.writeHead(status).end(body);
      });
      await assert.rejects(start(), { code: 1, stderr: /health check timed out/ });
      assert.equal(existsSync(statusFile), false);
    });
  }

  it('times out when the server never finishes the response body', async () => {
    server.on('request', (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write('{"instance_start_time":');
    });
    await assert.rejects(start(), { code: 1, stderr: /health check timed out/ });
    assert.equal(existsSync(statusFile), false);
  });

  it('times out when the server is unavailable', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await assert.rejects(start(), { code: 1, stderr: /health check timed out/ });
    assert.equal(existsSync(statusFile), false);
  });

  it('does not check health or create a status file when the launcher fails', async () => {
    let requests = 0;
    server.on('request', (_request, response) => {
      requests++;
      response.end(JSON.stringify({ instance_start_time: new Date().toISOString() }));
    });
    await assert.rejects(start({ EGGCTL_EXIT_CODE: '3' }), { code: 3 });
    assert.equal(requests, 0);
    assert.equal(existsSync(statusFile), false);
  });

  it('rejects invalid timeout configuration', async () => {
    await assert.rejects(start({ CNPMCORE_HEALTH_CHECK_TIMEOUT: '-1' }), {
      code: 1,
      stderr: /must be a positive integer in milliseconds/,
    });
    assert.equal(existsSync(statusFile), false);
  });
});
