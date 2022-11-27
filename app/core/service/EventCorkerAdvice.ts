import { ContextEventBus, Inject } from '@eggjs/tegg';
import { Advice, IAdvice } from '@eggjs/tegg/aop';

@Advice()
export class EventCorkerAdvice implements IAdvice {
  @Inject()
  private eventBus: ContextEventBus;

  async beforeCall() {
    this.eventBus.cork();
  }

  async afterFinally() {
    this.eventBus.uncork();
  }
}
