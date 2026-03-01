import { errors, type estypes } from '@elastic/elasticsearch';
import dayjs from 'dayjs';
import { AccessLevel, Inject, SingletonProto } from 'egg';

import { AbstractService } from '../../common/AbstractService.ts';
import { formatAuthor, getScopeAndName } from '../../common/PackageUtil.ts';
import type { DistRepository } from '../../repository/DistRepository.ts';
import type { AuthorType, PackageRepository } from '../../repository/PackageRepository.ts';
import type { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository.ts';
import type { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository.ts';
import type { PackageVersionRepository } from '../../repository/PackageVersionRepository.ts';
import type { SearchManifestType, SearchMappingType, SearchRepository } from '../../repository/SearchRepository.ts';
import type { PackageManagerService } from './PackageManagerService.ts';

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
  @Inject()
  protected packageVersionBlockRepository: PackageVersionBlockRepository;
  @Inject()
  protected packageVersionRepository: PackageVersionRepository;
  @Inject()
  protected distRepository: DistRepository;

  async syncPackage(fullname: string, isSync = true) {
    const [scope, name] = getScopeAndName(fullname);
    const {
      blockReason,
      manifest: latestManifest,
      pkg,
    } = await this.packageManagerService.showPackageVersionManifest(scope, name, 'latest', isSync, true);
    if (!pkg || !latestManifest) {
      this.logger.warn('[PackageSearchService.syncPackage] findPackage:%s not found', fullname);
      return;
    }

    if (blockReason) {
      this.logger.warn('[PackageSearchService.syncPackage] package:%s is blocked, try to remove es', fullname);
      await this.removePackage(fullname);
      return;
    }

    // get last year download data
    const startDate = dayjs().subtract(1, 'year');
    const endDate = dayjs();

    const entities = await this.packageVersionDownloadRepository.query(
      pkg.packageId,
      startDate.toDate(),
      endDate.toDate(),
    );
    let downloadsAll = 0;
    for (const entity of entities) {
      for (let i = 1; i <= 31; i++) {
        const day = String(i).padStart(2, '0');
        const field = `d${day}`;
        const counter = entity[field as keyof typeof entity] as number;
        if (!counter) continue;
        downloadsAll += counter;
      }
    }

    let time: Record<string, Date> = {};
    let _rev = '';
    let keywords: string[] | undefined;
    let description: string | undefined;
    const builder = await this.distRepository.readDistBytesToJSONBuilder(pkg.manifestsDist!);
    if (builder) {
      time = builder.getIn(['time'])!;
      _rev = builder.getIn(['_rev'])!;
      keywords = builder.getIn(['keywords']);
      description = builder.getIn(['description']);
    }
    const versions = await this.packageVersionRepository.findAllVersions(scope, name);
    const distTags = await this.packageManagerService.distTags(pkg);
    const packageDoc: SearchMappingType = {
      name: latestManifest.name,
      version: latestManifest.version,
      _rev,
      scope: scope ? scope.replace('@', '') : 'unscoped',
      keywords: keywords || latestManifest.keywords || [],
      versions,
      description,
      license: typeof latestManifest.license === 'object' ? latestManifest.license?.type : latestManifest.license,
      maintainers: latestManifest.maintainers as AuthorType[],
      author: formatAuthor(latestManifest.author),
      'dist-tags': distTags,
      date: time[latestManifest.version]!,
      created: time.created,
      modified: time.modified,
      // 归属 registry，keywords 枚举值
      _source_registry_name: latestManifest._source_registry_name,
      // 最新版本发布人 _npmUser:
      _npmUser: latestManifest?._npmUser,
      // 最新版本发布信息
      publish_time: latestManifest?.publish_time,
      // deprecated message of the latest version
      deprecated: latestManifest?.deprecated as string | undefined,
    };

    // http://npmmirror.com/package/npm/files/lib/utils/format-search-stream.js#L147-L148
    // npm cli 使用 username 字段
    if (packageDoc.maintainers) {
      packageDoc.maintainers = packageDoc.maintainers.map((maintainer) => {
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

  async searchPackage(
    text: string,
    from: number,
    size: number,
  ): Promise<{ objects: (SearchManifestType | undefined)[]; total: number }> {
    const matchQueries = this._buildMatchQueries(text);
    const scriptScore = this._buildScriptScore({
      text,
      scoreEffect: 0.25,
    });

    const mustNotQueries = this._buildMustNotQueries();
    const filterQueries = this._buildFilterQueries();

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
                minimum_should_match: matchQueries.length > 0 ? 1 : 0,
                ...(mustNotQueries.length > 0 ? { must_not: mustNotQueries } : {}),
                ...(filterQueries.length > 0 ? { filter: filterQueries } : {}),
              },
            },
            script_score: scriptScore,
          },
        },
      },
    });
    const { hits, total } = res;
    return {
      objects: hits?.map((item) => {
        // 从 https://github.com/npm/cli/pull/7407 (npm cli v10.6.0) 开始，npm cli 使用 publisher 字段(以前使用 maintainers 字段)
        // 从现有数据来看，_npmUser 字段和 publisher 字段是等价的
        // 为了兼容老版本，不删除 _npmUser 字段
        if (!item._source?.package.publisher && item._source?.package._npmUser) {
          item._source.package.publisher = {
            username: item._source.package._npmUser.name,
            email: item._source.package._npmUser.email,
          };
        }

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

  // Build must_not queries for filtering deprecated packages
  // https://github.com/cnpm/cnpmcore/issues/858
  private _buildMustNotQueries() {
    // oxlint-disable-next-line typescript-eslint/no-explicit-any
    const queries: any[] = [];
    if (this.config.cnpmcore.searchFilterDeprecated) {
      queries.push({
        exists: {
          field: 'package.deprecated',
        },
      });
    }
    return queries;
  }

  // Build filter queries for minimum publish duration
  // https://github.com/cnpm/cnpmcore/issues/858
  private _buildFilterQueries() {
    // oxlint-disable-next-line typescript-eslint/no-explicit-any
    const queries: any[] = [];
    const minDuration = this.config.cnpmcore.searchPublishMinDuration;
    if (minDuration) {
      const ms = this._parseDuration(minDuration);
      if (ms > 0) {
        const cutoff = new Date(Date.now() - ms);
        queries.push({
          range: {
            'package.date': {
              lte: cutoff.toISOString(),
            },
          },
        });
      }
    }
    return queries;
  }

  // Parse duration string like '1h', '1d', '1w', '2w' to milliseconds
  private _parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(h|d|w)$/);
    if (!match) {
      if (duration) {
        this.logger.warn(
          '[PackageSearchService._parseDuration] invalid duration format: %s, expected format: 1h, 1d, 1w',
          duration,
        );
      }
      return 0;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'w':
        return value * 7 * 24 * 60 * 60 * 1000;
      default:
        return 0;
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
          fields: ['package.name.standard^4', 'package.description.standard', 'package.keywords.standard^2'],
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
          fields: ['package.name.edge_ngram^4', 'package.description.edge_ngram', 'package.keywords.edge_ngram^2'],
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

  private _buildScriptScore(params: { text: string | undefined; scoreEffect: number }) {
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
