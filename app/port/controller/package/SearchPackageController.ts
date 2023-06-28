import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Context,
  EggContext,
  HTTPQuery,
  Inject,
} from '@eggjs/tegg';
import { AbstractController } from '../AbstractController';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

@HTTPController()
export class SearchPackageController extends AbstractController {
  @Inject()
  private readonly elasticsearch: ElasticsearchClient;
  @HTTPMethod({
    // GET /-/v1/search?text=react&size=20&from=0&quality=0.65&popularity=0.98&maintenance=0.5
    path: '/-/v1/search',
    method: HTTPMethodEnum.GET,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(@Context() _ctx: EggContext, @HTTPQuery() _text: string) {
    console.log(this.elasticsearch);
    return null;
  }
}
