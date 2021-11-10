import { EggContext, Next } from '@eggjs/tegg';

export async function errorHandler(ctx: EggContext, next: Next) {
  try {
    await next();
  } catch (err: any) {
    // http status, default is 500
    ctx.status = err.status || 500;
    // error body format https://github.com/npm/npm-registry-fetch/blob/main/errors.js#L45
    ctx.body = {
      error: err.code ? `[${err.code}] ${err.message}` : err.message,
    };
  }
}
