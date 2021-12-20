import { EggContext, Next } from '@eggjs/tegg';

export async function Tracing(ctx: EggContext, next: Next) {
  // headers: {
  //   'user-agent': 'npm/8.1.2 node/v16.13.1 darwin arm64 workspaces/false',
  //   'npm-command': 'adduser',
  //   'content-type': 'application/json',
  //   accept: '*/*',
  //   'content-length': '124',
  //   'accept-encoding': 'gzip,deflate',
  //   host: 'localhost:7001',
  //   connection: 'keep-alive'
  // }
  ctx.set('request-id', ctx.tracer.traceId);
  if (ctx.method !== 'HEAD') {
    ctx.logger.info('[Tracing] auth: %s, npm-command: %s, referer: %s, user-agent: %j',
      ctx.get('authorization') ? 1 : 0,
      ctx.get('npm-command') || '-',
      ctx.get('referer') || '-',
      ctx.get('user-agent'));
  }
  await next();
}
