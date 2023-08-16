import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { AbstractRepository } from './AbstractRepository';
import type { PackageVersionDownload as PackageVersionDownloadModel } from './model/PackageVersionDownload';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionDownloadRepository extends AbstractRepository {
  @Inject()
  private readonly PackageVersionDownload: typeof PackageVersionDownloadModel;

  async plus(packageId: string, version: string, counter: number): Promise<void> {
    const now = new Date();
    const yearMonth = now.getFullYear() * 100 + now.getMonth() + 1;
    const date = new Date().getDate();
    const field = date < 10 ? `d0${date}` : `d${date}`;
    let model = await this.PackageVersionDownload.findOne({
      packageId,
      version,
      yearMonth,
    });
    if (!model) {
      // create a record
      const attributes = {
        packageId,
        version,
        yearMonth,
      };
      model = await this.PackageVersionDownload.create(attributes);
      this.logger.info('[PackageVersionDownloadRepository:plus:new] id: %s, packageId: %s, version: %s, yearMonth: %s',
        model.id, model.packageId, model.version, model.yearMonth);
    }
    await this.PackageVersionDownload
      .where({ id: model.id })
      .increment(field, counter);
    this.logger.info('[PackageVersionDownloadRepository:plus:increment] id: %s, packageId: %s, version: %s, field: %s%s, plus: %d',
      model.id, model.packageId, model.version, model.yearMonth, field, counter);
  }

  async query(packageId: string, start: Date, end: Date) {
    const startYearMonth = start.getFullYear() * 100 + start.getMonth() + 1;
    const endYearMonth = end.getFullYear() * 100 + end.getMonth() + 1;
    const models = await this.PackageVersionDownload.find({
      packageId,
      yearMonth: { $gte: startYearMonth, $lte: endYearMonth },
    });
    return models;
  }

  async saveSyncDataByMonth(packageId: string, yearMonth: number, counters: [string, number][]): Promise<void> {
    const version = '*';
    let model = await this.PackageVersionDownload.findOne({
      packageId,
      version,
      yearMonth,
    });
    if (!model) {
      // create a record
      const attributes = {
        packageId,
        version,
        yearMonth,
      };
      model = await this.PackageVersionDownload.create(attributes);
    }
    for (const [ date, counter ] of counters) {
      const field = `d${date}`;
      (model as unknown as Record<string, number>)[field] = counter;
    }
    await model.save();
  }
}
