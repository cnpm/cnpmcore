import { Type } from '@eggjs/typebox-validate/typebox';
import { HTTPContext, Context, HTTPController, HTTPMethod, HTTPMethodEnum, HTTPQuery, Inject } from 'egg';

import { getFullname, getScopeAndName } from '../../common/PackageUtil.ts';
import type { Change } from '../../core/entity/Change.ts';
import type { ChangeRepository } from '../../repository/ChangeRepository.ts';
import type { TeamRepository } from '../../repository/TeamRepository.ts';
import { AbstractController } from './AbstractController.ts';

const ChangeRule = Type.Object({
  since: Type.Integer({ minimum: 0 }),
});

@HTTPController()
export class ChangesStreamController extends AbstractController {
  static PAGE_SIZE = 1000;
  static MAX_SCAN_PAGES = 10;

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
    const limit = ChangesStreamController.PAGE_SIZE;
    // Public feed must not reveal team-private packages (same binding used by checkReadAccess);
    // their events are omitted. Keep scanning past omitted events to fill the page, within a
    // bounded number of rows. `last_seq` is the last scanned seq (CouchDB style), so consumers
    // can resume past a run of omitted events even when no public event was returned.
    const maxScan = limit * ChangesStreamController.MAX_SCAN_PAGES;
    const results: { seq: Change['id']; type: string; id: string; changes: unknown[] }[] = [];
    let cursor = params.since;
    let scanned = 0;
    let lastSeq: Change['id'] | undefined;
    while (results.length < limit && scanned < maxScan) {
      const changes = await this.changeRepository.query(cursor, limit);
      const teamBound = await this.#findTeamBoundFullnames(changes.map((change) => change.targetName));
      for (const change of changes) {
        lastSeq = change.id;
        if (teamBound.has(change.targetName)) continue;
        results.push({
          seq: change.id,
          type: change.type,
          id: change.targetName,
          changes: [change.data],
        });
        if (results.length >= limit) break;
      }
      scanned += changes.length;
      if (changes.length < limit) break;
      cursor = Number(lastSeq) + 1;
    }
    // last_seq is omitted (undefined) when there are no changes since `since`
    return { results, last_seq: lastSeq };
  }

  // Returns the subset of fullnames that are team-bound (private) packages
  async #findTeamBoundFullnames(fullnames: string[]): Promise<Set<string>> {
    const allowScopes = this.config.cnpmcore.allowScopes;
    const namesByScope = new Map<string, Set<string>>();
    for (const fullname of new Set(fullnames)) {
      const [scope, name] = getScopeAndName(fullname);
      // only allowScopes packages can be team-private (see UserRoleManager.checkReadAccess)
      if (!scope || !allowScopes.includes(scope)) continue;
      let names = namesByScope.get(scope);
      if (!names) {
        names = new Set();
        namesByScope.set(scope, names);
      }
      names.add(name);
    }
    const fullnameByPackageId = new Map<string, string>();
    for (const [scope, names] of namesByScope) {
      const packageIds = await this.packageRepository.findPackageIdsByNames(scope, [...names]);
      for (const [name, packageId] of packageIds) {
        fullnameByPackageId.set(packageId, getFullname(scope, name));
      }
    }
    const boundIds = await this.teamRepository.listTeamBoundPackageIds([...fullnameByPackageId.keys()]);
    const result = new Set<string>();
    for (const packageId of boundIds) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      result.add(fullnameByPackageId.get(packageId)!);
    }
    return result;
  }
}
