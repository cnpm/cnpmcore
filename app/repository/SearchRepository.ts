import type { estypes } from '@elastic/elasticsearch';
import { AccessLevel, Inject, SingletonProto } from 'egg';

import type { SearchAdapter } from '../common/typing.ts';
import type { AuthorType, CnpmcorePatchInfo, PackageManifestType } from './PackageRepository.ts';

export type SearchJSONPickKey =
  | '_rev'
  | 'name'
  | 'description'
  | 'keywords'
  | 'license'
  | 'maintainers'
  | 'dist-tags'
  | '_source_registry_name';

export interface SearchPackageLinks {
  npm: string;
  homepage?: string;
  repository?: string;
  bugs?: string;
}

export type SearchMappingType = Pick<PackageManifestType, SearchJSONPickKey> &
  CnpmcorePatchInfo & {
    scope: string;
    version: string;
    versions: string[];
    date: Date;
    created: Date;
    modified: Date;
    author?: AuthorType | undefined;
    links?: SearchPackageLinks;
    _npmUser?: {
      name: string;
      email: string;
    };
    publisher?: {
      username: string;
      email: string;
    };
  };

export interface SearchManifestType {
  package: SearchMappingType;
  downloads: {
    all: number;
  };
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class SearchRepository {
  @Inject()
  private readonly searchAdapter: SearchAdapter;

  async searchPackage(
    // oxlint-disable-next-line typescript-eslint/no-explicit-any
    query: any,
  ): Promise<estypes.SearchHitsMetadata<SearchManifestType>> {
    return await this.searchAdapter.search<SearchManifestType>(query);
  }

  async upsertPackage(document: SearchManifestType) {
    return await this.searchAdapter.upsert(document.package.name, document);
  }

  async removePackage(fullname: string) {
    return await this.searchAdapter.delete(fullname);
  }
}
