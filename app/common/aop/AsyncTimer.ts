import { performance } from 'node:perf_hooks';
import { Advice, AdviceContext, IAdvice } from '@eggjs/tegg/aop';
import { Inject } from '@eggjs/tegg';
import { EggLogger } from 'egg';

// auto print async function call performance timer log into logger
@Advice()
export class AsyncTimer implements IAdvice {
  @Inject()
  private readonly logger: EggLogger;
  private start: number;
  private succeed = true;

  async beforeCall() {
    this.start = performance.now();
  }

  async afterThrow() {
    this.succeed = false;
  }

  async afterFinally(ctx: AdviceContext) {
    const ms = Math.floor((performance.now() - this.start) * 1000) / 1000;
    this.logger.info('[%s] [%s:%s|%s]',
      ms, ctx.that.constructor.name, ctx.method, this.succeed ? 'T' : 'F');
  }
}
