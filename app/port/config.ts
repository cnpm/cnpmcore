import type { DATABASE_TYPE } from '../../config/database.ts';
import type { ChangesStreamMode, SyncDeleteMode, SyncMode } from '../common/constants.ts';

export { cnpmcoreConfig } from '../../config/config.default.ts';

export interface CnpmcoreConfig {
  name: string;
  /**
   * enable hook or not
   */
  hookEnable: boolean;
  /**
   * mac custom hooks count
   */
  hooksLimit: number;
  /**
   * upstream registry url
   */
  sourceRegistry: string;
  /**
   * upstream registry is base on `cnpmcore` or not
   * if your upstream is official npm registry, please turn it off
   */
  sourceRegistryIsCNpm: boolean;
  /**
   * sync upstream first
   */
  syncUpstreamFirst: boolean;
  /**
   * sync upstream timeout, default is 3mins
   */
  sourceRegistrySyncTimeout: number;
  /**
   * sync task high water size, default is 100
   */
  taskQueueHighWaterSize: number;
  /**
   * sync mode
   * - none: don't sync npm package
   * - admin: don't sync npm package,only admin can create sync task by sync controller.
   * - all: sync all npm packages
   * - exist: only sync exist packages, effected when `enableCheckRecentlyUpdated` or `enableChangesStream` is enabled
   */
  syncMode: SyncMode;
  syncDeleteMode: SyncDeleteMode;
  syncPackageWorkerMaxConcurrentTasks: number;
  triggerHookWorkerMaxConcurrentTasks: number;
  createTriggerHookWorkerMaxConcurrentTasks: number;
  /**
   * stop syncing these packages in future
   */
  syncPackageBlockList: string[];
  /**
   * check recently from https://www.npmjs.com/browse/updated, if use set changesStreamRegistry to cnpmcore,
   * maybe you should disable it
   */
  enableCheckRecentlyUpdated: boolean;
  /**
   * mirror binary, default is false
   */
  enableSyncBinary: boolean;
  /**
   * sync binary source api, default is `${sourceRegistry}/-/binary`
   */
  syncBinaryFromAPISource: string;
  /**
   * enable sync downloads data from source registry https://github.com/cnpm/cnpmcore/issues/108
   * all three parameters must be configured at the same time to take effect
   */
  enableSyncDownloadData: boolean;
  syncDownloadDataSourceRegistry: string;
  /**
   * should be YYYY-MM-DD format
   */
  syncDownloadDataMaxDate: string;
  /**
   * @see https://github.com/npm/registry-follower-tutorial
   */
  enableChangesStream: boolean;
  checkChangesStreamInterval: number;
  changesStreamRegistry: string;
  /**
   * handle _changes request mode, default is 'streaming', please set it to 'json' when on cnpmcore registry
   */
  changesStreamRegistryMode: ChangesStreamMode;
  /**
   * registry url
   */
  registry: string;
  /**
   * https://docs.npmjs.com/cli/v6/using-npm/config#always-auth npm <= 6
   * if `alwaysAuth=true`, all api request required access token
   */
  alwaysAuth: boolean;
  /**
   * white scope list
   */
  allowScopes: string[];
  /**
   * allow publish non-scope package, disable by default
   */
  allowPublishNonScopePackage: boolean;
  /**
   * Public registration is allowed, otherwise only admins can login
   */
  allowPublicRegistration: boolean;
  /**
   * default system admins
   */
  admins: Record<string, string>;
  /**
   * use webauthn for login, https://webauthn.guide/
   * only support platform authenticators, browser support: https://webauthn.me/browser-support
   */
  enableWebAuthn: boolean;
  /**
   * http response cache control header
   */
  enableCDN: boolean;
  /**
   * if you are using CDN, can override it
   * it meaning cache 300s on CDN server and client side.
   */
  cdnCacheControlHeader: string;
  /**
   * if you are using CDN, can set it to 'Accept, Accept-Encoding'
   */
  cdnVaryHeader: string;
  /**
   * store full package version manifests data to database table(package_version_manifests), default is false
   */
  enableStoreFullPackageVersionManifestsToDatabase: boolean;
  /**
   * only support npm as client and npm >= 7.0.0 allow publish action
   */
  enableNpmClientAndVersionCheck: boolean;
  /**
   * sync when package not found, only effect when syncMode = all/exist
   */
  syncNotFound: boolean;
  /**
   * redirect to source registry when package not found
   */
  redirectNotFound: boolean;
  /**
   * enable unpkg features, https://github.com/cnpm/cnpmcore/issues/452
   */
  enableUnpkg: boolean;
  /**
   * enable sync unpkg files
   */
  enableSyncUnpkgFiles: boolean;
  /**
   * enable sync unpkg files from the white list, https://github.com/cnpm/unpkg-white-list
   */
  enableSyncUnpkgFilesWhiteList: boolean;
  /**
   * allow large package version size, default is MAX_SAFE_INTEGER
   */
  largePackageVersionSize: number;
  /**
   * When the number of oversized versions exceeds this threshold, the sync task will fail.
   * Oversized versions within the threshold will be skipped and the rest will still be synced.
   * e.g. threshold=3 means up to 3 oversized versions are tolerated (skipped), the 4th will fail the task.
   * default is 3
   */
  largePackageVersionBlockThreshold: number;
  /**
   * enable this would make sync specific version task not append latest version into this task automatically,it would mark the local latest stable version as latest tag.
   * in most cases, you should set to false to keep the same behavior as source registry.
   */
  strictSyncSpecivicVersion: boolean;
  /**
   * enable elasticsearch
   */
  enableElasticsearch: boolean;
  /**
   * elasticsearch index. if enableElasticsearch is true, you must set a index to write es doc.
   */
  elasticsearchIndex: string;
  /**
   * filter deprecated packages from search results, default is false
   * NOTE: Before enabling, you must update your Elasticsearch index mappings to include the
   * `package.deprecated` field. See docs/elasticsearch-setup.md and docs/elasticsearch-index.json
   * for the required mapping configuration.
   * @see https://docs.npmjs.com/searching-for-and-choosing-packages-to-download
   */
  searchFilterDeprecated: boolean;
  /**
   * minimum duration after publish before a package appears in search results
   * supports: '1h', '1d', '1w', '2w' (hours, days, weeks), empty string means no filter
   * Uses the existing `package.created` field in Elasticsearch to filter by package creation time.
   * @see https://docs.npmjs.com/searching-for-and-choosing-packages-to-download
   */
  searchPublishMinDuration: string;
  /**
   * strictly enforces/validates manifest and tgz when publish, https://github.com/cnpm/cnpmcore/issues/542
   */
  strictValidateTarballPkg?: boolean;

  /**
   * strictly enforces/validates dependencies version when publish or sync
   */
  strictValidatePackageDeps?: boolean;

  /**
   * enable blocking a package on a specific version (not only the whole package).
   * when enabled, blocked versions are filtered out of the public manifest / dist-tags
   * and rejected on direct version access. default is false (behavior identical to today).
   * see https://github.com/cnpm/cnpmcore/pull/906
   *
   * ⚠️ MIGRATION WARNING — read before enabling on an existing deployment:
   * this flag RETROACTIVELY enforces every existing version-level row in `package_version_blocks`
   * (rows whose `version` is a specific version, not `*`). Some deployments (e.g. npmmirror) have
   * written single-version rows purely as AUDIT records while keeping the versions installable.
   * Turning this flag on will immediately HIDE all those versions from the manifest and reject
   * direct version access — a production-visible behavior change. Audit / migrate / clean those
   * existing rows BEFORE enabling. (Buffer rows with `type='buffer'` are unaffected by this caveat;
   * only legacy `type=NULL` version rows are.)
   */
  enableBlockPackageVersion?: boolean;

  /**
   * enable dependency isolation (buffer) zone.
   * when enabled, a newly synced version is held invisible for `dependencyIsolationDuration`
   * before being auto-released, giving deployments a window to run out-of-band validation.
   * default is false (behavior identical to today).
   * see RFC: https://github.com/cnpm/cnpmcore/issues/1057
   *
   * ⚠️ REQUIRES `enableBlockPackageVersion` (isolation hides versions via the version-level block
   * mechanism). Because of that dependency, enabling isolation inherits the migration warning on
   * `enableBlockPackageVersion` above: it also activates enforcement of all existing single-version
   * audit rows. Clean up those rows before enabling isolation in production.
   */
  enableDependencyIsolation?: boolean;

  /**
   * dependency isolation buffer duration in milliseconds, analogous to pnpm `minimumReleaseAge`.
   * a synced version stays invisible until `gmt_create + dependencyIsolationDuration`.
   * default is 6 hours. only effective when `enableDependencyIsolation` is true.
   */
  dependencyIsolationDuration?: number;

  /**
   * dependency isolation allowlist, analogous to pnpm `minimumReleaseAgeExclude`.
   * matched packages skip the buffer zone (released immediately).
   * supports exact package name and scope wildcard, e.g. `lodash`, `@scope/*`, `@scope/pkg`.
   * default is empty.
   */
  dependencyIsolationExclude?: string[];

  /**
   * database config
   */
  database: {
    type: DATABASE_TYPE | string;
  };

  /**
   * experimental features
   */
  experimental: {
    /**
     * enable sync package with packument
     */
    syncPackageWithPackument: boolean;
    /**
     * enable use JSONBuilder to update package manifests
     * it would improve the performance of update package manifests and reduce the memory usage
     */
    enableJSONBuilder: boolean;
  };
}
