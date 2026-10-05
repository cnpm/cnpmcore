import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { setTimeout } from 'node:timers/promises';

function getResponse(url, timeout) {
  return new Promise((resolve, reject) => {
    const get = url.protocol === 'https:' ? httpsGet : httpGet;
    const request = get(url, { agent: false, signal: AbortSignal.timeout(timeout) }, (response) => {
      response.on('error', reject);
      if (response.statusCode !== 200) {
        response.destroy();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve(body));
    });
    request.on('error', reject);
  });
}

async function waitForReady() {
  const url = new URL(process.env.CNPMCORE_HEALTH_CHECK_URL || `http://127.0.0.1:${process.env.PORT || 7001}/`);
  const timeout = Number(process.env.CNPMCORE_HEALTH_CHECK_TIMEOUT || 60_000);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('CNPMCORE_HEALTH_CHECK_URL must use HTTP or HTTPS');
  }
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new Error('CNPMCORE_HEALTH_CHECK_TIMEOUT must be a positive integer in milliseconds');
  }

  const deadline = performance.now() + timeout;
  let lastError = 'No response';
  process.stdout.write(`Waiting up to ${timeout}ms for cnpmcore at ${url}\n`);

  while (performance.now() < deadline) {
    try {
      const requestTimeout = Math.max(1, Math.min(5_000, Math.ceil(deadline - performance.now())));
      const body = JSON.parse(await getResponse(url, requestTimeout));
      if (typeof body?.instance_start_time !== 'string' || !body.instance_start_time) {
        throw new Error('HTTP 200 response has no instance_start_time');
      }
      process.stdout.write('cnpmcore is ready\n');
      return;
    } catch (error) {
      lastError = error.cause ? `${error.message}: ${error.cause.message}` : error.message;
    }
    const remaining = deadline - performance.now();
    if (remaining > 0) {
      await setTimeout(Math.min(1_000, remaining));
    }
  }

  throw new Error(`cnpmcore health check timed out after ${timeout}ms at ${url}: ${lastError}`);
}

try {
  await waitForReady();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
