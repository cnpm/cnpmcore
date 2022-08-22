import { ChangesStreamChange } from '../../common/adapter/changesStream/AbstractChangesStream';
import { Transform, TransformCallback, TransformOptions } from 'node:stream';

// 网络问题可能会导致获取到的数据不完整
// 最后数据可能会发生截断，需要按行读取，例如:
// "seq": 1, "id": "test1",
// "seq"
// :2,
// "id": "test2",
// 先保存在 legacy 中，参与下次解析
export default class ChangesStreamTransform extends Transform {
  constructor(opts: TransformOptions = {}) {
    super({
      ...opts,
      readableObjectMode: true,
    });
  }
  private legacy = '';
  _transform(chunk: any, _: BufferEncoding, callback: TransformCallback): void {
    const text = chunk.toString();
    const lines = text.split('\n');

    for (const line of lines) {
      const content = this.legacy + line;
      const match = /"seq":(\d+),"id":"([^"]+)"/g.exec(content);
      const seq = match?.[1];
      const fullname = match?.[2];
      if (seq && fullname) {
        this.legacy = '';
        // https://nodejs.org/en/docs/guides/backpressuring-in-streams/
        // 需要处理 backpressure 场景
        // 如果下游无法消费数据，就先暂停发送数据
        // 自定义的 push 事件需要特殊处理
        const pushed = this.push({ fullname, seq } as ChangesStreamChange);
        if (!pushed) {
          this.pause();
          // 需要使用 drain 会重复触发，使用 once
          this.once('drain', () => {
            this.resume();
          });
        }
      } else {
        this.legacy += line;
      }
    }

    callback();
  }
}
