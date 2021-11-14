import { EggContext, Next } from '@eggjs/tegg';

const DEFAULT_SERVER_ERROR_STATUS = 500;

export async function errorHandler(ctx: EggContext, next: Next) {
  try {
    await next();
  } catch (err: any) {
    // http status, default is DEFAULT_SERVER_ERROR_STATUS
    ctx.status = err.status || DEFAULT_SERVER_ERROR_STATUS;
    if (ctx.status >= DEFAULT_SERVER_ERROR_STATUS) {
      ctx.logger.error(err);
    }
    // error body format https://github.com/npm/npm-registry-fetch/blob/main/errors.js#L45
    ctx.body = {
      error: err.code ? `[${err.code}] ${err.message}` : err.message,
    };
  }
}
