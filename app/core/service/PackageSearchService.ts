import { AccessLevel, SingletonProto } from '@eggjs/tegg';
import { AbstractService } from '../../common/AbstractService';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageSearchService extends AbstractService {
  createOrUpdatePackage() {
    throw Error('Not Implemented');
  }

  searchPackage() {
    throw Error('Not Implemented');
  }

  removePackage() {
    throw Error('Not Implemented');
  }
}
