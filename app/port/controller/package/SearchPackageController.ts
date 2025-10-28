import {
  HTTPContext,
  Context,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPQuery,
  Inject,
  Middleware,
} from 'egg';
import type { Static } from '@eggjs/typebox-validate/typebox';
import { E451 } from 'egg/errors';

import { AbstractController } from '../AbstractController.ts';
import type { SearchQueryOptions } from '../../typebox.ts';
import type { PackageSearchService } from '../../../core/service/PackageSearchService.ts';
import { FULLNAME_REG_STRING } from '../../../common/PackageUtil.ts';
import { AdminAccess } from '../../middleware/AdminAccess.ts';

@HTTPController()
export class SearchPackageController extends AbstractController {
  @Inject()
  private readonly packageSearchService: PackageSearchService;

  @HTTPMethod({
    // GET /-/v1/search?text=react&size=20&from=0&quality=0.65&popularity=0.98&maintenance=0.5
    path: '/-/v1/search',
    method: HTTPMethodEnum.GET,
  })
  async search(
    @HTTPContext() ctx: Context,
    @HTTPQuery() text: Static<typeof SearchQueryOptions>['text'],
    @HTTPQuery() from: Static<typeof SearchQueryOptions>['from'],
    @HTTPQuery() size: Static<typeof SearchQueryOptions>['size']
  ) {
    if (!this.config.cnpmcore.enableElasticsearch) {
      throw new E451(
        'search feature not enabled in `config.cnpmcore.enableElasticsearch`'
      );
    }
    const data = await this.packageSearchService.searchPackage(
      text,
      from,
      size
    );
    this.setCDNHeaders(ctx);
    return data;
  }

  @HTTPMethod({
    path: `/-/v1/search/sync/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.PUT,
  })
  async sync(@HTTPParam() fullname: string) {
    if (!this.config.cnpmcore.enableElasticsearch) {
      throw new E451(
        'search feature not enabled in `config.cnpmcore.enableElasticsearch`'
      );
    }
    const name = await this.packageSearchService.syncPackage(fullname, true);
    return { package: name };
  }

  @HTTPMethod({
    path: `/-/v1/search/sync/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.DELETE,
  })
  @Middleware(AdminAccess)
  async delete(@HTTPParam() fullname: string) {
    if (!this.config.cnpmcore.enableElasticsearch) {
      throw new E451(
        'search feature not enabled in `config.cnpmcore.enableElasticsearch`'
      );
    }
    const name = await this.packageSearchService.removePackage(fullname);
    return { package: name };
  }
}
