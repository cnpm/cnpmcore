import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPQuery,
  Inject,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { Type } from '@sinclair/typebox';
import { AbstractController } from './AbstractController';
import { ChangeRepository } from '../../repository/ChangeRepository';

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
    const results = changes.reverse().map(change => {
      return {
        seq: change.id,
        type: change.type,
        id: change.targetName,
        changes: [ change.data ],
      };
    });
    return { results };
  }
}

