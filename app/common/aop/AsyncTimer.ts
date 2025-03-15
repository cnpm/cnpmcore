import { performance } from 'node:perf_hooks';

import { Advice, type AdviceContext, type IAdvice } from '@eggjs/tegg/aop';
import { Inject } from '@eggjs/tegg';
import type { EggLogger } from 'egg';

const START = Symbol('AsyncTimer#start');
const SUCCEED = Symbol('AsyncTimer#succeed');

// auto print async function call performance timer log into logger
@Advice()
export class AsyncTimer implements IAdvice {
  @Inject()
  private readonly logger: EggLogger;

  async beforeCall(ctx: AdviceContext) {
    ctx.set(START, performance.now());
    ctx.set(SUCCEED, true);
  }

  async afterThrow(ctx: AdviceContext) {
    ctx.set(SUCCEED, false);
  }

  async afterFinally(ctx: AdviceContext) {
    const ms = Math.floor((performance.now() - ctx.get(START)!) * 1000) / 1000;
    this.logger.info(
      '[%s] [%s:%s|%s]',
      ms,
      ctx.that.constructor.name,
      ctx.method,
      ctx.get(SUCCEED)! ? 'T' : 'F'
    );
  }
}
