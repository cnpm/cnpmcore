import {
  AccessLevel,
  SingletonProto,
} from '@eggjs/tegg';
import { NotFoundError, NotImplementedError } from 'egg-errors';
import { AbstractService } from '../../common/AbstractService.js';
import { NOT_IMPLEMENTED_PATH } from '../../common/constants.js';

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
