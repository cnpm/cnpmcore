import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { BinarySyncerService } from '../../../../app/core/service/BinarySyncerService.ts';
import type { BinaryName } from '../../../../config/binaries.ts';

describe('test/core/service/BinarySyncerService/createTask.test.ts', () => {
  let binarySyncerService: BinarySyncerService;

  beforeEach(async () => {
    binarySyncerService = await app.getEggObject(BinarySyncerService);
  });

  describe('createTask()', () => {
    it('should ignore duplicate binary task', async () => {
      const task = await binarySyncerService.createTask('banana' as BinaryName, {});
      const newTask = await binarySyncerService.createTask('banana' as BinaryName, {});
      assert.ok(task?.taskId === newTask?.taskId);
      assert.ok(task?.bizId === 'SyncBinary:banana');
    });
  });
});
