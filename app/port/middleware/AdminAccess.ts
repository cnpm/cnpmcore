import type { EggContext, Next } from '@eggjs/tegg';
import { ForbiddenError } from 'egg-errors';

import { UserRoleManager } from '../UserRoleManager.ts';

export async function AdminAccess(ctx: EggContext, next: Next) {
  const userRoleManager = await ctx.getEggObject(UserRoleManager);
  const isAdmin = await userRoleManager.isAdmin(ctx);
  if (!isAdmin) {
    throw new ForbiddenError('Not allow to access');
  }
  await next();
}
