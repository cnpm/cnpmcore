import {
  type EggContext,
  Context,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPQuery,
  Inject,
} from '@eggjs/tegg';
import { Type } from 'egg-typebox-validate/typebox';

import { AbstractController } from './AbstractController.js';
import type { ChangeRepository } from '../../repository/ChangeRepository.js';

const ChangeRule = Type.Object({
  since: Type.Integer({ minimum: 0 }),
});

@HTTPController()
export class ChangesStreamController extends AbstractController {
  @Inject()
  private changeRepository: ChangeRepository;

  // https://github.com/cnpm/cnpmcore/issues/70
  @HTTPMethod({
    // /_changes?since=${since}
    path: '/_changes',
    method: HTTPMethodEnum.GET,
  })
  async listChanges(@Context() ctx: EggContext, @HTTPQuery() since: string) {
    const params = { since: since ? Number(since) : 0 };
    ctx.tValidate(ChangeRule, params);
    const limit = 1000;
    const changes = await this.changeRepository.query(params.since, limit);
    const results = changes.map(change => {
      return {
        seq: change.id,
        type: change.type,
        id: change.targetName,
        changes: [change.data],
      };
    });
    return { results };
  }
}
