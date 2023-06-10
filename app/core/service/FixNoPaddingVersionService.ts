import { SingletonProto, AccessLevel, Inject } from '@eggjs/tegg';
import { EggLogger } from 'egg';
import pMap from 'p-map';
import { PackageVersionRepository } from '../../repository/PackageVersionRepository';
import { PaddingSemVer } from '../entity/PaddingSemVer';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class FixNoPaddingVersionService {
  @Inject()
  private readonly packageVersionRepository: PackageVersionRepository;

  @Inject()
  private readonly logger: EggLogger;

  async fixPaddingVersion(id?: number): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const packageVersions = await this.packageVersionRepository.findHaveNotPaddingVersion(id);
      if (packageVersions.length === 0) {
        break;
      }
      id = packageVersions[packageVersions.length - 1].id as unknown as number + 1;
      this.logger.info('[FixNoPaddingVersionService] fix padding version ids %j', packageVersions.map(t => t.id));

      await pMap(packageVersions, async packageVersion => {
        const paddingSemver = new PaddingSemVer(packageVersion.version);
        await this.packageVersionRepository.fixPaddingVersion(packageVersion.packageVersionId, paddingSemver);
      }, { concurrency: 30 });
    }
  }
}
