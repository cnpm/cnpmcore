import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { SyncRecheckQueue } from '../../app/infra/SyncRecheckQueue.ts';

describe('test/infra/SyncRecheckQueue.test.ts', () => {
  let queue: SyncRecheckQueue;
  let now: number;
  const input = { fullname: 'popular', registryId: 'npm', seq: '1', taskId: 'initial' };
  beforeEach(async () => {
    queue = await app.getEggObject(SyncRecheckQueue);
    now = Date.now();
    mock(Date, 'now', () => now);
    mock(app.config.cnpmcore, 'syncRecheck', {
      ...app.config.cnpmcore.syncRecheck,
      enabled: true,
      delays: [100, 200, 300],
      maxPendingPackages: 2,
    });
  });

  async function claimAfter(ms: number) {
    now += ms;
    await app.redis.del('CNPMCORE_SYNC_RECHECK:dispatch');
    return await queue.claim();
  }

  it('coalesces events without postponing the first check or losing versions with equal timestamps', async () => {
    const first = await queue.record({ ...input, version: '1.0.0' });
    assert.ok(first);
    now += 20;
    await Promise.all([
      queue.record({ ...input, version: '2.0.0' }),
      queue.record({ ...input, seq: '2', version: '3.0.0' }),
    ]);
    const state = await queue.get(queue.key('npm', 'popular'));
    assert.ok(state);
    assert.equal(state.nextCheckAt, first.nextCheckAt);
    assert.deepEqual(Object.keys(state.expectedVersions).sort(), ['1.0.0', '2.0.0', '3.0.0']);
    assert.equal(await queue.claim(), null);
    const claim = await claimAfter(80);
    assert.ok(claim);
    assert.equal(claim.state.generation, 3);
  });

  it('caps pending records across registries and grants only one concurrent lease', async () => {
    await queue.record(input);
    await queue.record({ ...input, registryId: 'another' });
    assert.equal(await queue.record({ ...input, fullname: 'overflow' }), null);
    now += 100;
    const claims = await Promise.all([queue.claim(), queue.claim()]);
    assert.equal(claims.filter(Boolean).length, 1);
  });

  it('preserves the rolling budget after completion and a new event', async () => {
    await queue.record(input);
    for (let index = 0; index < 3; index++) {
      const claim = await claimAfter(1000);
      assert.ok(claim);
      const reserved = await queue.reserve(claim.key, claim.state.lease!);
      assert.ok(reserved?.dispatchTaskId);
      await queue.dispatched(claim.key, reserved, reserved.dispatchTaskId);
    }
    const key = queue.key('npm', 'popular');
    assert.equal((await queue.get(key))?.pending, false);
    await queue.record({ ...input, seq: '2' });
    const claim = await claimAfter(1000);
    assert.ok(claim);
    const limited = await queue.reserve(key, claim.state.lease!);
    assert.equal(limited?.dispatchTaskId, undefined);
    assert.equal(limited?.attempts.length, 3);
    const next = await claimAfter(60 * 60_000);
    assert.ok(next);
    assert.ok((await queue.reserve(key, next.state.lease!))?.dispatchTaskId);
  });

  it('recovers an expired lease with the same reserved task and budget slot', async () => {
    await queue.record(input);
    const first = await claimAfter(100);
    assert.ok(first);
    const reserved = await queue.reserve(first.key, first.state.lease!);
    assert.ok(reserved?.dispatchTaskId);
    assert.equal(await claimAfter(1), null);
    const recovered = await claimAfter(60_000);
    assert.ok(recovered);
    const second = await queue.reserve(recovered.key, recovered.state.lease!);
    assert.equal(second?.dispatchTaskId, reserved.dispatchTaskId);
    assert.equal(second?.attempts.length, 1);
    // An expired owner cannot clear the replacement owner's lease.
    assert.equal(await queue.finish(first.key, first.state), null);
  });

  it('retains changes that arrive during completion or the last dispatch', async () => {
    mock(app.config.cnpmcore.syncRecheck, 'delays', [100]);
    await queue.record(input);
    let claim = await claimAfter(100);
    assert.ok(claim);
    await queue.record({ ...input, seq: '2' });
    await queue.finish(claim.key, claim.state);
    assert.equal((await queue.get(claim.key))?.pending, true);
    claim = await claimAfter(100);
    assert.ok(claim);
    const reserved = await queue.reserve(claim.key, claim.state.lease!);
    assert.ok(reserved?.dispatchTaskId);
    await queue.record({ ...input, seq: '3' });
    await queue.dispatched(claim.key, reserved, reserved.dispatchTaskId);
    const current = await queue.get(claim.key);
    assert.equal(current?.seq, '3');
    assert.equal(current?.pending, true);
    assert.equal(current?.attempts.length, 1);
  });

  it('defers active work without consuming a retry and removes expired due entries', async () => {
    await queue.record(input);
    const claim = await claimAfter(100);
    assert.ok(claim);
    await queue.defer(claim.key, claim.state.lease!);
    assert.deepEqual((await queue.get(claim.key))?.attempts, []);
    await app.redis.del(claim.key);
    assert.equal(await claimAfter(30_000), null);
    assert.equal(await app.redis.zcard('CNPMCORE_SYNC_RECHECK:due'), 0);
  });
});
