import ChangesStreamTransform from 'app/core/util/ChangesStreamTransform';
import assert = require('assert');
import { Readable, pipeline, Writable } from 'node:stream';
import { ChangesStreamChange } from 'app/common/adapter/changesStream/AbstractChangesStream';

describe('test/core/util/ChangesStreamTransform.test.ts', () => {
  let stream: Readable;
  let transform: ChangesStreamTransform;
  beforeEach(async () => {
    transform = new ChangesStreamTransform();
  });
  afterEach(async () => {
    transform.end();
    transform.destroy();
  });


  it('should work', async () => {
    stream = Readable.from('');
    const res = pipeline(stream, transform, error => {
      assert(!error);
    });

    stream.push(`
    {"results":[
      {"seq":1,"id":"api.anyfetch.com","changes":[{"rev":"5-a87e847a323ce2503582b68c5f66a8a3"}],"deleted":true},
      {"seq":2,"id":"backbone.websql.deferred","changes":[{"rev":"4-f5150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
      {"seq":3,"id":"binomal-hash-list","changes":[{"rev":"2-dced04d62bef47954eac61c217ed6fc1"}],"deleted":true},
      {"seq":4,"id":"concat-file","changes":[{"rev":"5-e463032df555c6af3c47a7c9769904d4"}],"deleted":true},
      {"seq":7,"id":"iron-core","changes":[{"rev":"4-b3b1f44a33c3a952ff0cbb2cee527f94"}],"deleted":true},
    `);

    const changes: ChangesStreamChange[] = [];
    for await (const change of res) {
      changes.push(change);
    }

    assert(changes.length === 5);
    assert.deepEqual(changes.map(_ => _.fullname), [ 'api.anyfetch.com', 'backbone.websql.deferred', 'binomal-hash-list', 'concat-file', 'iron-core' ]);
  });

  it('should throw when pipe', async () => {
    let triggered = false;
    stream = Readable.from('');
    const res = stream.pipe(transform);

    await assert.rejects(async () => {
      stream.push('"seq":1,');
      stream.emit('error', new Error('mock errors'));
      stream.push('"id":"test1"\n');
      for await (const _ of res) {
        triggered = true;
        assert(_ !== null);
      }
    }, /mock errors/);

    assert(triggered === false);
  });

  it('should work when concurrent', async () => {

    stream = Readable.from('');
    const res = pipeline(stream, transform, error => {
      assert(!error);
    });

    stream.push(`
      {"results":[
        {"seq":1,"id":"api.anyfetch.com","changes":[{"rev":"5-a87e847a323ce2503582b68c5f66a8a3"}],"deleted":true},
        {"seq":2,"id":"backbone.websql.deferred","changes":[{"rev":"4-f5150b238ab62cd890211fb57fc9eca5"}],"deleted":true},
        {"seq":3,"id":"binomal-hash-list","changes":[{"rev":"2-dced04d62bef47954eac61c217ed6fc1"}],"deleted":true},
        {"seq":4,"id":"concat-file","changes":[{"rev":"5-e463032df555c6af3c47a7c9769904d4"}],"deleted":true},
        {"seq":7,"id":"iron-core","changes":[{"rev":"4-b3b1f44a33c3a952ff0cbb2cee527f94"}],"deleted":true},
    `);

    const changes: ChangesStreamChange[] = [];
    async function parseMessage() {
      for await (const change of res) {
        changes.push(change);
      }
    }

    const task = parseMessage();
    stream.push('{"seq":8,"id":"icon-cone5","changes":[{"rev":"5-a87e847a323ce2503582b68c5f67a8a3"}],"deleted":true},');
    await task;

    assert(changes.length === 6);
  });

  it('should work handle backpressure', async () => {
    let seq = 1;
    stream = Readable.from('');
    const transform = new ChangesStreamTransform({ highWaterMark: 1 });
    let assertDrainTime = 0;
    let assertWriteTime = 0;

    // 模拟消费流，每 10ms 消费一个 changeObject
    const assertWrite = new Writable({
      objectMode: true,
      highWaterMark: 1,
      write(_, __, callback) {
        assertWriteTime++;
        setTimeout(() => {
          callback();
        }, 10);
      },
    });

    assertWrite.on('drain', () => {
      assertDrainTime++;
    });

    const res = new Promise<void>((resolve, reject) => {
      pipeline(stream, transform, assertWrite, err => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });

    for (let i = 0; i < 50; i++) {
      stream.push(`{"seq":${++seq},"id":"${seq}","changes":[{"rev":"5-a87e847a323ce2503582b68c5f66a8a3"}],"deleted":true},`);
    }

    await res;

    assert(assertDrainTime === assertWriteTime);
    assert(assertWriteTime === 50);

  });

});
