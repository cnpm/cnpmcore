import assert from 'node:assert/strict';

import { HookEventType } from '../../../app/common/enum/Hook.ts';
import { HookEvent } from '../../../app/core/entity/HookEvent.ts';

describe('test/core/entity/HookEvent.test.ts', () => {
  const fullname = '@scope/package';
  const changeId = 'change-123';

  it('should create owner event', () => {
    const event = HookEvent.createOwnerEvent(fullname, changeId, 'user1');
    assert.equal(event.event, HookEventType.Owner);
    assert.equal(event.fullname, fullname);
    assert.equal(event.changeId, changeId);
    assert.equal(event.type, 'package');
    assert.equal(event.version, '1.0.0');
    assert.deepEqual(event.change, { maintainer: 'user1' });
  });

  it('should create owner remove event', () => {
    const event = HookEvent.createOwnerRmEvent(fullname, changeId, 'user1');
    assert.equal(event.event, HookEventType.OwnerRm);
    assert.deepEqual(event.change, { maintainer: 'user1' });
  });

  it('should create dist-tag event', () => {
    const event = HookEvent.createDistTagEvent(fullname, changeId, 'latest');
    assert.equal(event.event, HookEventType.DistTag);
    assert.deepEqual(event.change, { 'dist-tag': 'latest' });
  });

  it('should create dist-tag remove event', () => {
    const event = HookEvent.createDistTagRmEvent(fullname, changeId, 'beta');
    assert.equal(event.event, HookEventType.DistTagRm);
    assert.deepEqual(event.change, { 'dist-tag': 'beta' });
  });

  it('should create deprecated event', () => {
    const event = HookEvent.createDeprecatedEvent(fullname, changeId, 'use @scope/new-package instead');
    assert.equal(event.event, HookEventType.Deprecated);
    assert.deepEqual(event.change, { deprecated: 'use @scope/new-package instead' });
  });

  it('should create undeprecated event', () => {
    const event = HookEvent.createUndeprecatedEvent(fullname, changeId, '');
    assert.equal(event.event, HookEventType.Undeprecated);
    assert.deepEqual(event.change, { deprecated: '' });
  });
});
