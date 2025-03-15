
import { Inject, ObjectInitType, type ContextEventBus } from '@eggjs/tegg';
import { Advice, type IAdvice } from '@eggjs/tegg/aop';

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
