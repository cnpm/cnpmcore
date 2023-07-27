import {
  AccessLevel,
  SingletonProto,
} from '@eggjs/tegg';
import { AbstractService } from '../../common/AbstractService';
import { NOT_IMPLEMENTED_PATH } from '../../common/constants';
import { NotFoundError, NotImplementedError } from 'egg-errors';

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
