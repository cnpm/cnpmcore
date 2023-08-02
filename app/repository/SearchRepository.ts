import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import { SearchAdapter } from '../common/typing';
import { PackageManifestType } from './PackageRepository';

export type SearchManifestType = {
  package: PackageManifestType;
  downloads: {
    all: number;
  };
};

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class SearchRepository {
  @Inject()
  private readonly searchAdapter: SearchAdapter;


  async searchPackage(query) {
    return await this.searchAdapter.search<SearchManifestType>(query);
  }

  async upsertPackage(document: SearchManifestType) {
    return await this.searchAdapter.upsert(document.package._id, document);
  }

  async remotePackage(fullname: string) {
    return await this.searchAdapter.delete(fullname);
  }
}
