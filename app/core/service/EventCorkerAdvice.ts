import { EventBus, Inject } from '@eggjs/tegg';
import { Advice, IAdvice } from '@eggjs/tegg/aop';

@Advice()
export class EventCorkerAdvice implements IAdvice {
  @Inject()
  private eventBus: EventBus;
  // 依赖 https://github.com/eggjs/tegg/pull/60 合并后支持

  async beforeCall() {
    this.eventBus;
    // this.eventBus.cork();
  }

  async afterFinally() {
    this.eventBus;
    // this.eventBus.uncork();
  }
}
