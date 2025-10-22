import assert from 'node:assert/strict';
import { Task } from '../../../app/core/entity/Task.ts';

describe('test/core/entity/Task.js', () => {
  describe('needMergeWhenWaiting', () => {
    it('should not merge if data.shouldNotMerge is true', () => {
      const task = Task.createSyncBinary('foo', {
        shouldNotMerge: true,
      });
      assert.equal(task.needMergeWhenWaiting(), false);
    });

    it('should merge sync binary task', () => {
      const task = Task.createSyncBinary('foo');
      assert.equal(task.needMergeWhenWaiting(), true);
    });
  });
});
