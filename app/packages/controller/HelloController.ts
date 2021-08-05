import { HTTPController, HTTPQuery, HTTPMethod, HTTPMethodEnum, Inject } from '@eggjs/tegg';
import { HelloService } from '../service/HelloService';


@HTTPController()
export class HelloController {
  @Inject()
  private readonly helloService: HelloService;

  @HTTPMethod({
    method: HTTPMethodEnum.GET,
    path: '/hello',
  })
  async hello(@HTTPQuery() name: string) {
    return this.helloService.hello(name);
  }
}
