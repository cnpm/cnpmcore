import { EggAppConfig, Logger, Inject } from 'egg';

export abstract class AbstractService {
  @Inject()
  protected readonly config: EggAppConfig;
  @Inject()
  protected readonly logger: Logger;
}
