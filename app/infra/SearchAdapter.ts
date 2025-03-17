import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';
import type { EggAppConfig } from 'egg';
import type {
  Client as ElasticsearchClient,
  estypes,
} from '@elastic/elasticsearch';

import type { SearchAdapter } from '../common/typing.js';

/**
 * Use elasticsearch to search the huge npm packages.
 */
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
  name: 'searchAdapter',
})
export class ESSearchAdapter implements SearchAdapter {
  @Inject()
  private config: EggAppConfig;

  @Inject()
  private readonly elasticsearch: ElasticsearchClient; // 由 elasticsearch 插件引入

  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  async search<T>(query: any): Promise<estypes.SearchHitsMetadata<T>> {
    const {
      cnpmcore: { elasticsearchIndex: index },
    } = this.config;
    const result = await this.elasticsearch.search<T>({
      index,
      ...query,
    });
    return result.hits;
  }

  async upsert<T>(id: string, document: T): Promise<string> {
    const {
      cnpmcore: { elasticsearchIndex: index },
    } = this.config;
    const res = await this.elasticsearch.index({
      id,
      index,
      document,
    });
    return res._id;
  }

  async delete(id: string): Promise<string> {
    const {
      cnpmcore: { elasticsearchIndex: index },
    } = this.config;
    const res = await this.elasticsearch.delete({
      index,
      id,
    });
    return res._id;
  }
}
