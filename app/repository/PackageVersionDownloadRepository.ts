import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { PackageVersionDownload as PackageVersionDownloadModel } from './model/PackageVersionDownload';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionDownloadRepository {
  async plus(packageId: string, version: string, counter: number): Promise<void> {
    const now = new Date();
    const yearMonth = now.getFullYear() * 100 + now.getMonth() + 1;
    const date = new Date().getDate();
    const field = date < 10 ? `d0${date}` : `d${date}`;
    let model = await PackageVersionDownloadModel.findOne({
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
      model = await PackageVersionDownloadModel.create(attributes);
    }
    await PackageVersionDownloadModel
      .where({ id: model.id })
      .increment(field, counter);
  }

  async query(packageId: string, start: Date, end: Date) {
    const startYearMonth = start.getFullYear() * 100 + start.getMonth() + 1;
    const endYearMonth = end.getFullYear() * 100 + end.getMonth() + 1;
    const models = await PackageVersionDownloadModel.find({ packageId, yearMonth: { $gte: startYearMonth, $lte: endYearMonth } });
    return models;
  }
}
