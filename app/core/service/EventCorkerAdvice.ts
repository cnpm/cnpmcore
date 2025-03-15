import type { ContextEventBus } from '@eggjs/tegg';
import { Inject, ObjectInitType } from '@eggjs/tegg';
import type { IAdvice } from '@eggjs/tegg/aop';
import { Advice } from '@eggjs/tegg/aop';

@Advice({
  initType: ObjectInitType.CONTEXT,
})
export class EventCorkAdvice implements IAdvice {
  @Inject()
  private eventBus: ContextEventBus;

  async beforeCall() {
    this.eventBus.cork();
  }

  async afterFinally() {
    this.eventBus.uncork();
  }
}
