import type { EggContext } from '@eggjs/tegg';

export function isSyncWorkerRequest(ctx: EggContext) {
  // sync request will contain this query params
  let isSyncWorkerRequest = ctx.query.cache === '0';
  if (!isSyncWorkerRequest) {
    const ua = ctx.headers['user-agent'] || '';
    // old sync client will request with these user-agent
    if (ua.includes('npm_service.cnpmjs.org/')) {
      isSyncWorkerRequest = true;
    }
  }
  return isSyncWorkerRequest;
}
