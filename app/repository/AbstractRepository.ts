import {
  Inject,
} from '@eggjs/tegg';
import {
  EggLogger,
} from 'egg';

export abstract class AbstractRepository {
  @Inject()
  protected logger: EggLogger;
}
