import { Inject } from '@eggjs/tegg';
import type { EggAppConfig, EggLogger } from 'egg';

export abstract class AbstractService {
  @Inject()
  protected readonly config: EggAppConfig;
  @Inject()
  protected readonly logger: EggLogger;
}
