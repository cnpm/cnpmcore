import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Inject,
} from '@eggjs/tegg';
import { AbstractController } from './AbstractController';
import { RegistryService } from '../../core/service/RegistryService';

@HTTPController()
export class RegistryController extends AbstractController {
  @Inject()
  private readonly registryService: RegistryService;

  @HTTPMethod({
    path: '/-/registry',
    method: HTTPMethodEnum.GET,
  })
  async listRegistries() {
    return await this.registryService.list();
  }

}
