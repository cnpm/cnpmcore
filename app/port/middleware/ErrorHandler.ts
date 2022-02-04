import { EggContext, Next } from '@eggjs/tegg';

const DEFAULT_SERVER_ERROR_STATUS = 500;

export async function ErrorHandler(ctx: EggContext, next: Next) {
  try {
    await next();
  } catch (err: any) {
    if (err.name === 'PackageNotFoundError' && err.redirectToSourceRegistry) {
      ctx.redirect(`${err.redirectToSourceRegistry}${ctx.url}`);
      return;
    }

    // http status, default is DEFAULT_SERVER_ERROR_STATUS
    ctx.status = err.status || DEFAULT_SERVER_ERROR_STATUS;
    if (ctx.status >= DEFAULT_SERVER_ERROR_STATUS) {
      ctx.logger.error(err);
    }
    let message = err.message;
    // convert ctx.tValidate error
    if (err.name === 'UnprocessableEntityError' && err.currentSchema && err.errors[0]?.message) {
      // {
      //   instancePath: '/password',
      //   schemaPath: '#/properties/password/minLength',
      //   keyword: 'minLength',
      //   message: 'must NOT have fewer than 8 characters'
      // }
      const item = err.errors[0];
      if (item.instancePath) {
        message = `${item.instancePath.substring(1)}: ${item.message}`;
      } else {
        message = item.message;
      }
    }
    // error body format https://github.com/npm/npm-registry-fetch/blob/main/errors.js#L45
    ctx.body = {
      error: err.code ? `[${String(err.code).toUpperCase()}] ${message}` : message,
    };
  }
}
