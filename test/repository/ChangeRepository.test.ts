import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { ChangeRepository } from '../../app/repository/ChangeRepository';
import { Change as ChangeModel } from '../../app/repository/model/Change';

describe('test/repository/ChangeRepository.test.ts', () => {
  let changeRepository: ChangeRepository;

  beforeEach(async () => {
    changeRepository = await app.getEggObject(ChangeRepository);
    await ChangeModel.truncate();
  });

  afterEach(async () => {
    await ChangeModel.truncate();
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
