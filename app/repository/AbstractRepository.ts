import { Inject } from '@eggjs/tegg';
import type { EggLogger } from 'egg';

export abstract class AbstractRepository {
  @Inject()
  protected logger: EggLogger;
}
