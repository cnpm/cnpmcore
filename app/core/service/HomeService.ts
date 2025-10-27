import {
  AccessLevel,
  SingletonProto,
} from 'egg';
import { NotFoundError, NotImplementedError } from '@eggjs/errors';

import { AbstractService } from '../../common/AbstractService.ts';
import { NOT_IMPLEMENTED_PATH } from '../../common/constants.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class HomeService extends AbstractService {
  async misc(path: string) {
    if (NOT_IMPLEMENTED_PATH.includes(path)) {
      throw new NotImplementedError(`${path} not implemented yet`);
    }
    throw new NotFoundError(`${path} not found`);
  }
}
