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
    });
  });

  describe('find the last change', () => {
    it('should work', async () => {
      const expectChange0 = await upstreamRepository.findLastUpstreamChange();
      assert(expectChange0 === null);

      const change1 = await upstreamRepository.createUpstreamChange(UpstreamChangeEntity.create({
        name: 'foo1',
        seq: 1000011,
        changes: '[]',
      }));
      const expectChange1 = await upstreamRepository.findLastUpstreamChange();
      assert(expectChange1!.id === change1.id);
      assert(expectChange1!.seq === change1.seq);

      const change2 = await upstreamRepository.createUpstreamChange(UpstreamChangeEntity.create({
        name: 'foo2',
        seq: 1000012,
        changes: '[]',
      }));
      const expectChange2 = await upstreamRepository.findLastUpstreamChange();
      assert.strictEqual(expectChange2!.id, change2.id);
      assert.strictEqual(expectChange2!.seq, change2.seq);
    });
  });
  
});
