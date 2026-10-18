import { Type } from '@eggjs/typebox-validate/typebox';
import { HTTPContext, Context, HTTPController, HTTPMethod, HTTPMethodEnum, HTTPQuery, Inject } from 'egg';

import { getScopeAndName } from '../../common/PackageUtil.ts';
import type { ChangeRepository } from '../../repository/ChangeRepository.ts';
import type { TeamRepository } from '../../repository/TeamRepository.ts';
import { AbstractController } from './AbstractController.ts';

const ChangeRule = Type.Object({
  since: Type.Integer({ minimum: 0 }),
});

@HTTPController()
export class ChangesStreamController extends AbstractController {
  @Inject()
  private changeRepository: ChangeRepository;

  @Inject()
  private teamRepository: TeamRepository;

  // https://github.com/cnpm/cnpmcore/issues/70
  @HTTPMethod({
    // /_changes?since=${since}
    path: '/_changes',
    method: HTTPMethodEnum.GET,
  })
  async listChanges(@HTTPContext() ctx: Context, @HTTPQuery() since: string) {
    const params = { since: since ? Number(since) : 0 };
    ctx.tValidate(ChangeRule, params);
    const limit = 1000;
    const changes = await this.changeRepository.query(params.since, limit);
    // Public feed must not reveal team-private packages (same binding used by checkReadAccess).
    // Unchanged for unbound packages so mirrors keep working; private events are simply omitted.
    const privatePackageIds = new Map<string, boolean>();
    const results = [];
    for (const change of changes) {
      const [scope, name] = getScopeAndName(change.targetName);
      const cacheKey = `${scope}/${name}`;
      let isPrivate = privatePackageIds.get(cacheKey);
      if (isPrivate === undefined) {
        const pkg = await this.packageRepository.findPackage(scope, name);
        isPrivate = !!(pkg && (await this.teamRepository.hasAnyTeamBinding(pkg.packageId)));
        privatePackageIds.set(cacheKey, isPrivate);
      }
      if (isPrivate) {
        continue;
      }
      results.push({
        seq: change.id,
        type: change.type,
        id: change.targetName,
        changes: [change.data],
      });
    }
    return { results };
  }
}
