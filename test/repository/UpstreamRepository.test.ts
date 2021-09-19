import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { UpstreamRepository } from '../../app/repository/UpstreamRepository';
import { UpstreamChange as UpstreamChangeEntity } from '../../app/core/entity/UpstreamChange';
import { UpstreamChange as UpstreamChangeModel } from '../../app/repository/model/UpstreamChange';

describe('test/repository/UpstreamRepository.test.ts', () => {
  let ctx: Context;
  let upstreamRepository: UpstreamRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    upstreamRepository = await ctx.getEggObject(UpstreamRepository);
  });

  afterEach(async () => {
    app.destroyModuleContext(ctx);
    await Promise.all([
      UpstreamChangeModel.truncate(),
    ]);
  });

  describe('create upstream change', () => {
    it('should work', async () => {
      const change = await upstreamRepository.createUpstreamChange(UpstreamChangeEntity.create({
        name: 'foo',
        seq: 1000010,
        changes: '[]',
      }));
      assert(change.id);
      assert(change.seq === 1000010);
      assert(change.name === 'foo');
      assert(change.upstreamChangeId);
      console.log('change', change);
    });
  });
});
