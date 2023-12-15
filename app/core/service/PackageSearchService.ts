import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';
import { estypes, errors } from '@elastic/elasticsearch';
import dayjs from 'dayjs';

import { AbstractService } from '../../common/AbstractService';
import { formatAuthor, getScopeAndName } from '../../common/PackageUtil';
import { PackageManagerService } from './PackageManagerService';
import { SearchManifestType, SearchMappingType, SearchRepository } from '../../repository/SearchRepository';
import { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository';
import { PackageRepository } from '../../repository/PackageRepository';


@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageSearchService extends AbstractService {
  @Inject()
  private readonly packageManagerService: PackageManagerService;
  @Inject()
  private readonly searchRepository: SearchRepository;
  @Inject()
  private packageVersionDownloadRepository: PackageVersionDownloadRepository;
  @Inject()
  protected packageRepository: PackageRepository;

  async syncPackage(fullname: string, isSync = true) {
    const [ scope, name ] = getScopeAndName(fullname);
    const fullManifests = await this.packageManagerService.listPackageFullManifests(scope, name, isSync);

    if (!fullManifests.data) {
      this.logger.warn('[PackageSearchService.syncPackage] save package:%s not found', fullname);
      return;
    }

    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      this.logger.warn('[PackageSearchService.syncPackage] findPackage:%s not found', fullname);
      return;
    }

    // get last year download data
    const startDate = dayjs().subtract(1, 'year');
    const endDate = dayjs();

    const entities = await this.packageVersionDownloadRepository.query(pkg.packageId, startDate.toDate(), endDate.toDate());
    let downloadsAll = 0;
    for (const entity of entities) {
      for (let i = 1; i <= 31; i++) {
        const day = String(i).padStart(2, '0');
        const field = `d${day}`;
        const counter = entity[field];
        if (!counter) continue;
        downloadsAll += counter;
      }
    }

    const { data: manifest } = fullManifests;

    const latestVersion = manifest['dist-tags'].latest;
    const latestManifest = manifest.versions[latestVersion];

    const packageDoc: SearchMappingType = {
      name: manifest.name,
      version: latestVersion,
      _rev: manifest._rev,
      scope: scope ? scope.replace('@', '') : 'unscoped',
      keywords: manifest.keywords || [],
      versions: Object.keys(manifest.versions),
      description: manifest.description,
      license: typeof manifest.license === 'object' ? manifest.license?.type : manifest.license,
      maintainers: manifest.maintainers,
      author: formatAuthor(manifest.author),
      'dist-tags': manifest['dist-tags'],
      date: manifest.time[latestVersion],
      created: manifest.time.created,
      modified: manifest.time.modified,
      // 归属 registry，keywords 枚举值
      _source_registry_name: manifest._source_registry_name,
      // 最新版本发布人 _npmUser:
      _npmUser: latestManifest?._npmUser,
      // 最新版本发布信息
      publish_time: latestManifest?.publish_time,
    };

    // http://npmmirror.com/package/npm/files/lib/utils/format-search-stream.js#L147-L148
    // npm cli 使用 username 字段
    if (packageDoc.maintainers) {
      packageDoc.maintainers = packageDoc.maintainers.map(maintainer => {
        return {
          username: maintainer.name,
          ...maintainer,
        };
      });
    }

    const document: SearchManifestType = {
      package: packageDoc,
      downloads: {
        all: downloadsAll,
      },
    };

    return await this.searchRepository.upsertPackage(document);
  }

  async searchPackage(text: string, from: number, size: number): Promise<{ objects: (SearchManifestType | undefined)[], total: number }> {
    const matchQueries = this._buildMatchQueries(text);
    const scriptScore = this._buildScriptScore({
      text,
      scoreEffect: 0.25,
    });

    const res = await this.searchRepository.searchPackage({
      body: {
        size,
        from,
        query: {
          function_score: {
            boost_mode: 'replace',
            query: {
              bool: {
                should: matchQueries,
                minimum_should_match: matchQueries.length ? 1 : 0,
              },
            },
            script_score: scriptScore,
          },
        },
      },
    });
    const { hits, total } = res;
    return {
      objects: hits?.map(item => {
        return item._source;
      }),
      total: (total as estypes.SearchTotalHits).value,
    };
  }

  async removePackage(fullname: string) {
    try {
      return await this.searchRepository.removePackage(fullname);
    } catch (error) {
      // if the package does not exist, returns success
      if (error instanceof errors.ResponseError && error?.statusCode === 404) {
        this.logger.warn('[PackageSearchService.removePackage] remove package:%s not found', fullname);
        return fullname;
      }
      throw error;
    }
  }

  // https://github.com/npms-io/queries/blob/master/lib/search.js#L8C1-L78C2
  private _buildMatchQueries(text: string) {
    if (!text) {
      return [];
    }
    return [
      // Standard match using cross_fields
      {
        multi_match: {
          query: text,
          operator: 'and',
          fields: [
            'package.name.standard^4',
            'package.description.standard',
            'package.keywords.standard^2',
          ],
          type: 'cross_fields',
          boost: 6,
          tie_breaker: 0.5,
        },
      },

      // Partial match using edge-ngram
      {
        multi_match: {
          query: text,
          operator: 'and',
          fields: [
            'package.name.edge_ngram^4',
            'package.description.edge_ngram',
            'package.keywords.edge_ngram^2',
          ],
          type: 'phrase',
          slop: 3,
          boost: 3,
          tie_breaker: 0.5,
        },
      },

      // Normal term match with an english stemmer
      {
        multi_match: {
          query: text,
          operator: 'and',
          fields: [
            'package.name.english_docs^4',
            'package.description.english_docs',
            'package.keywords.english_docs^2',
          ],
          type: 'cross_fields',
          boost: 3,
          tie_breaker: 0.5,
        },
      },

      // Normal term match with a more aggressive english stemmer (not so important)
      {
        multi_match: {
          query: text,
          operator: 'and',
          fields: [
            'package.name.english_aggressive_docs^4',
            'package.description.english_aggressive_docs',
            'package.keywords.english_aggressive_docs^2',
          ],
          type: 'cross_fields',
          tie_breaker: 0.5,
        },
      },
    ];
  }

  private _buildScriptScore(params: { text: string | undefined, scoreEffect: number }) {
    // keep search simple, only download(popularity)
    const downloads = 'doc["downloads.all"].value';
    const source = `doc["package.name.raw"].value.equals(params.text) ? 100000 + ${downloads} : _score * Math.pow(${downloads}, params.scoreEffect)`;
    return {
      script: {
        source,
        params: {
          text: params.text || '',
          scoreEffect: params.scoreEffect,
        },
      },
    };
  }
}
