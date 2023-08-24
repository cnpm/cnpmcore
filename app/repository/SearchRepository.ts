import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import { SearchAdapter } from '../common/typing';
import { AuthorType, CnpmcorePatchInfo, PackageManifestType } from './PackageRepository';

export type SearchJSONPickKey = '_rev' | 'name' | 'description' | 'keywords' | 'license' | 'maintainers' | 'dist-tags' | '_source_registry_name';

export type SearchMappingType = Pick<PackageManifestType, SearchJSONPickKey> & CnpmcorePatchInfo & {
  scope: string;
  version: string;
  versions: string[];
  date: Date;
  created: Date;
  modified: Date;
  author?: AuthorType | undefined;
  _npmUser?: {
    name: string;
    email: string;
  }
};


export type SearchManifestType = {
  package: SearchMappingType;
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
    return await this.searchAdapter.upsert(document.package.name, document);
  }

  async removePackage(fullname: string) {
    return await this.searchAdapter.delete(fullname);
  }
}
