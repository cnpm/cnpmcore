import { TaskType } from '../../common/enum/Task';
import { HookTriggerService } from '../service/HookTriggerService';
import { AbstractWorker } from './AbstractWorker';

export class HookTriggerWorker extends AbstractWorker {

  async initWorkerInfo(): Promise<void> {
    this.queueKey = TaskType.TriggerHook;
    this.serviceClass = HookTriggerService;
    this.configKey = 'triggerHookWorkerMaxConcurrentTasks';
  }
}
