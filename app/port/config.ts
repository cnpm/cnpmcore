import { SyncDeleteMode, SyncMode, ChangesStreamMode } from '../common/constants';

export { cnpmcoreConfig } from '../../config/config.default';

export type CnpmcoreConfig = {
  name: string,
  /**
   * enable hook or not
   */
  hookEnable: boolean,
  /**
   * mac custom hooks count
   */
  hooksLimit: number,
  /**
   * upstream registry url
   */
  sourceRegistry: string,
  /**
   * upstream registry is base on `cnpmcore` or not
   * if your upstream is official npm registry, please turn it off
   */
  sourceRegistryIsCNpm: boolean,
  /**
   * sync upstream first
   */
  syncUpstreamFirst: boolean,
  /**
   * sync upstream timeout, default is 3mins
   */
  sourceRegistrySyncTimeout: number,
  /**
   * sync task high water size, default is 100
   */
  taskQueueHighWaterSize: number,
  /**
   * sync mode
   * - none: don't sync npm package
   * - admin: don't sync npm package,only admin can create sync task by sync contorller.
   * - all: sync all npm packages
   * - exist: only sync exist packages, effected when `enableCheckRecentlyUpdated` or `enableChangesStream` is enabled
   */
  syncMode: SyncMode,
  syncDeleteMode: SyncDeleteMode,
  syncPackageWorkerMaxConcurrentTasks: number,
  triggerHookWorkerMaxConcurrentTasks: number,
  createTriggerHookWorkerMaxConcurrentTasks: number,
  /**
   * stop syncing these packages in future
   */
  syncPackageBlockList: string[],
  /**
   * check recently from https://www.npmjs.com/browse/updated, if use set changesStreamRegistry to cnpmcore,
   * maybe you should disable it
   */
  enableCheckRecentlyUpdated: boolean,
  /**
   * mirror binary, default is false
   */
  enableSyncBinary: boolean,
  /**
   * sync binary source api, default is `${sourceRegistry}/-/binary`
   */
  syncBinaryFromAPISource: string,
  /**
   * enable sync downloads data from source registry https://github.com/cnpm/cnpmcore/issues/108
   * all three parameters must be configured at the same time to take effect
   */
  enableSyncDownloadData: boolean,
  syncDownloadDataSourceRegistry: string,
  /**
   * should be YYYY-MM-DD format
   */
  syncDownloadDataMaxDate: string,
  /**
   * @see https://github.com/npm/registry-follower-tutorial
   */
  enableChangesStream: boolean,
  checkChangesStreamInterval: number,
  changesStreamRegistry: string,
  /**
   * handle _changes request mode, default is 'streaming', please set it to 'json' when on cnpmcore registry
   */
  changesStreamRegistryMode: ChangesStreamMode,
  /**
   * registry url
   */
  registry: string,
  /**
   * https://docs.npmjs.com/cli/v6/using-npm/config#always-auth npm <= 6
   * if `alwaysAuth=true`, all api request required access token
   */
  alwaysAuth: boolean,
  /**
   * white scope list
   */
  allowScopes: string [],
  /**
   * allow publish non-scope package, disable by default
   */
  allowPublishNonScopePackage: boolean,
  /**
   * Public registration is allowed, otherwise only admins can login
   */
  allowPublicRegistration: boolean,
  /**
   * default system admins
   */
  admins: Record<string, string>,
  /**
   * use webauthn for login, https://webauthn.guide/
   * only support platform authenticators, browser support: https://webauthn.me/browser-support
   */
  enableWebAuthn: boolean,
  /**
   * http response cache control header
   */
  enableCDN: boolean,
  /**
   * if you are using CDN, can override it
   * it meaning cache 300s on CDN server and client side.
   */
  cdnCacheControlHeader: string,
  /**
   * if you are using CDN, can set it to 'Accept, Accept-Encoding'
   */
  cdnVaryHeader: string,
  /**
   * store full package version manifests data to database table(package_version_manifests), default is false
   */
  enableStoreFullPackageVersionManifestsToDatabase: boolean,
  /**
   * only support npm as client and npm >= 7.0.0 allow publish action
   */
  enableNpmClientAndVersionCheck: boolean,
  /**
   * sync when package not found, only effect when syncMode = all/exist
   */
  syncNotFound: boolean,
  /**
   * redirect to source registry when package not found
   */
  redirectNotFound: boolean,
  /**
   * enable unpkg features, https://github.com/cnpm/cnpmcore/issues/452
   */
  enableUnpkg: boolean,
  /**
   * enable this would make sync specific version task not append latest version into this task automatically,it would mark the local latest stable version as latest tag.
   * in most cases, you should set to false to keep the same behavior as source registry.
   */
  strictSyncSpecivicVersion: boolean,
  /**
  * enable elasticsearch
  */
  enableElasticsearch: boolean,
  /**
  * elasticsearch index. if enableElasticsearch is true, you must set a index to write es doc.
  */
  elasticsearchIndex: string,
  /**
   * strictly enforces/validates manifest and tgz when publish, https://github.com/cnpm/cnpmcore/issues/542
   */
  strictValidateTarballPkg?: boolean,
};
