import { EggContext, Next } from '@eggjs/tegg';
import { UserRoleManager } from '../UserRoleManager';

export async function AlwaysAuth(ctx: EggContext, next: Next) {
  if (ctx.app.config.cnpmcore.alwaysAuth) {
    // ignore login request: `PUT /-/user/org.couchdb.user::username`
    const isLoginRequest = ctx.method === 'PUT' && ctx.path.startsWith('/-/user/org.couchdb.user:');
    if (!isLoginRequest) {
      const userRoleManager = await ctx.getEggObject(UserRoleManager);
      await userRoleManager.requiredAuthorizedUser(ctx, 'read');
    }
  }
  await next();
}
