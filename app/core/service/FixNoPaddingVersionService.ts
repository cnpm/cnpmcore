import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';
import type { EggLogger } from 'egg';
import pMap from 'p-map';
import type { PackageVersionRepository } from '../../repository/PackageVersionRepository.ts';
import { PaddingSemVer } from '../entity/PaddingSemVer.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class FixNoPaddingVersionService {
  @Inject()
  private readonly packageVersionRepository: PackageVersionRepository;

  @Inject()
  private readonly logger: EggLogger;

  async fixPaddingVersion(id?: number): Promise<void> {
    while (true) {
      const packageVersions =
        await this.packageVersionRepository.findHaveNotPaddingVersion(id);
      if (packageVersions.length === 0) {
        break;
      }
      const lastVersion = packageVersions[packageVersions.length - 1];
      id =
        (lastVersion.id as unknown as number) +
        1;
      this.logger.info(
        '[FixNoPaddingVersionService] fix padding version ids %j',
        packageVersions.map(t => t.id)
      );

      await pMap(
        packageVersions,
        async packageVersion => {
          const paddingSemver = new PaddingSemVer(packageVersion.version);
          await this.packageVersionRepository.fixPaddingVersion(
            packageVersion.packageVersionId,
            paddingSemver
          );
        },
        { concurrency: 30 }
      );
    }
  }
}
