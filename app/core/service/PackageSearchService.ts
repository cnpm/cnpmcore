import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';
import { AbstractService } from '../../common/AbstractService';
import { getScopeAndName } from '../../common/PackageUtil';
import { PackageManagerService } from './PackageManagerService';
import { SearchManifestType, SearchRepository } from '../../repository/SearchRepository';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageSearchService extends AbstractService {
  @Inject()
  private readonly packageManagerService: PackageManagerService;
  @Inject()
  private readonly searchRepository: SearchRepository;


  async syncPackage(fullname: string, isSync = true) {
    const [ scope, name ] = getScopeAndName(fullname);
    const fullManifests = await this.packageManagerService.listPackageFullManifests(scope, name, isSync);

    if (!fullManifests.data) {
      this.logger.warn('[PackageSearchService.syncPackage] save package:%s not found', fullname);
      return;
    }
    const document: SearchManifestType = {
      package: fullManifests.data,
      // TODO get download data from internal data
      downloads: {
        all: 0,
      },
    };

    return await this.searchRepository.upsertPackage(document);
  }

  async searchPackage(text: string | undefined, from: number, size: number): Promise<(SearchManifestType | undefined)[]> {
    const matchQueries = this._buildMatchQueries(text);
    const scriptScore = this._buildScriptScore({
      text,
      scoreEffect: 0.25,
    });

    const res = await this.searchRepository.searchPackage({
      type: 'score',
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
    const data = res.hits.map(item => {
      return item._source;
    });
    return data;
  }

  async removePackage(fullname: string) {
    return await this.searchRepository.remotePackage(fullname);
  }

  // https://github.com/npms-io/queries/blob/master/lib/search.js#L8C1-L78C2
  private _buildMatchQueries(text: string | undefined) {
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
