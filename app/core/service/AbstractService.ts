import {
  Inject,
} from '@eggjs/tegg';
import {
  EggAppConfig,
  EggLogger,
} from 'egg';

export abstract class AbstractService {
  @Inject()
  protected readonly config: EggAppConfig;
  @Inject()
  protected readonly logger: EggLogger;
}
