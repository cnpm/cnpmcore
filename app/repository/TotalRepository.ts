import { AccessLevel, Inject, SingletonProto } from 'egg';

import type { Total } from './model/Total.ts';
import { AbstractRepository } from './AbstractRepository.ts';
import { TotalType } from '../common/enum/Total.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TotalRepository extends AbstractRepository {
  @Inject()
  private readonly Total: typeof Total;

  // Package count methods
  async incrementPackageCount(count = 1) {
    await this.increment(TotalType.PackageCount, count);
  }

  async getPackageCount(): Promise<number> {
    return this.get(TotalType.PackageCount);
  }

  // Package version count methods
  async incrementPackageVersionCount(count = 1) {
    await this.increment(TotalType.PackageVersionCount, count);
  }

  async getPackageVersionCount(): Promise<number> {
    return this.get(TotalType.PackageVersionCount);
  }

  // Private helper methods
  private async increment(type: TotalType, count = 1) {
    const model = await this.Total.findOne({ type });
    if (model) {
      await this.Total.where({ id: model.id }).increment('count', count);
    } else {
      await this.Total.create({
        type,
        count: BigInt(count),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  private async get(type: TotalType): Promise<number> {
    const model = await this.Total.findOne({ type });
    return model ? Number(model.count.toString()) : 0;
  }

  // Get all counts
  async getAll(): Promise<{
    packageCount: string;
    packageVersionCount: string;
  }> {
    const [packageCount, packageVersionCount] = await Promise.all([
      this.getPackageCount(),
      this.getPackageVersionCount(),
    ]);
    return {
      packageCount: packageCount.toString(),
      packageVersionCount: packageVersionCount.toString(),
    };
  }

  // Reset all counters to 0
  async reset() {
    await this.Total.where({}).update({
      count: '0',
      updatedAt: new Date(),
    });
  }
}
