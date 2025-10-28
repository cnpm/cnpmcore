import { Inject, Logger } from 'egg';

export abstract class AbstractRepository {
  @Inject()
  protected logger: Logger;
}
