import {
  Inject,
  QualifierImplDecoratorUtil,
  type ImplDecorator,
} from '@eggjs/tegg';
import type { RegistryType } from '../../../common/enum/Registry.js';
import type { Registry } from '../../../core/entity/Registry.js';
import type { EggHttpClient, EggLogger } from 'egg';

export const CHANGE_STREAM_ATTRIBUTE = 'CHANGE_STREAM_ATTRIBUTE';
export interface ChangesStreamChange {
  seq: string;
  fullname: string;
}

export abstract class AbstractChangeStream {
  @Inject()
  protected logger: EggLogger;

  @Inject()
  protected httpclient: EggHttpClient;

  abstract getInitialSince(registry: Registry): Promise<string>;
  abstract fetchChanges(
    registry: Registry,
    since: string
  ): AsyncGenerator<ChangesStreamChange>;

  getChangesStreamUrl(
    registry: Registry,
    since: string,
    limit?: number
  ): string {
    const url = new URL(registry.changeStream);
    url.searchParams.set('since', since);
    if (limit) {
      url.searchParams.set('limit', String(limit));
    }
    return url.toString();
  }
}

export const RegistryChangesStream: ImplDecorator<
  AbstractChangeStream,
  typeof RegistryType
> = QualifierImplDecoratorUtil.generatorDecorator(
  AbstractChangeStream,
  CHANGE_STREAM_ATTRIBUTE
);
