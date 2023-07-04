import { Inject, SingletonProto } from '@eggjs/tegg';
import { TaskType } from '../../common/enum/Task';
import { HookTriggerService } from '../service/HookTriggerService';
import { AbstractWorker } from './AbstractWorker';

@SingletonProto()
export class HookTriggerWorker extends AbstractWorker {

  @Inject()
  private readonly hookTriggerService: HookTriggerService;

  async initWorker(): Promise<void> {
    this.queueKey = TaskType.TriggerHook;
    this.service = this.hookTriggerService;
    this.configKey = 'triggerHookWorkerMaxConcurrentTasks';
  }

}
