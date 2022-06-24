import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ChangeRepository } from 'app/repository/ChangeRepository';
import { Change as ChangeModel } from 'app/repository/model/Change';

describe('test/repository/ChangeRepository.test.ts', () => {
  let ctx: Context;

  let changeRepository: ChangeRepository;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    changeRepository = await ctx.getEggObject(ChangeRepository);
    await ChangeModel.truncate();
  });

  afterEach(async () => {
    await ChangeModel.truncate();
    await app.destroyModuleContext(ctx);
  });


  describe('query', () => {
    beforeEach(async () => {
      for (let i = 1; i < 10; i++) {
        const change = new ChangeModel({});
        change.type = 'add';
        change.targetName = 'test';
        change.data = {};
        change.changeId = 'change_id_' + i;
        await change.save();
      }
    });

    it('should list from header', async () => {
      const changes = await changeRepository.query(0, 5);
      const ids = changes.map(t => t.id);
      assert.deepStrictEqual(ids, [
        1, 2, 3, 4, 5,
      ]);
    });
  });
});
