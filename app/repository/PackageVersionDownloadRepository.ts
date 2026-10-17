import { AccessLevel, Inject, SingletonProto } from 'egg';

import { getFullname } from '../common/PackageUtil.ts';
import type { PackagePopularity } from '../common/SyncRecheck.ts';
import { AbstractRepository } from './AbstractRepository.ts';
import type { PackageVersionDownload as PackageVersionDownloadModel } from './model/PackageVersionDownload.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionDownloadRepository extends AbstractRepository {
  @Inject()
  private readonly PackageVersionDownload: typeof PackageVersionDownloadModel;

  async listPopularPackages(minDownloads: number, limit: number, now = new Date()): Promise<PackagePopularity[]> {
    const days: { month: number; field: string }[] = [];
    for (let offset = 1; offset <= 7; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      days.push({
        month: date.getFullYear() * 100 + date.getMonth() + 1,
        field: `d${String(date.getDate()).padStart(2, '0')}`,
      });
    }
    // Column names come only from calendar dates. All other inputs are bound.
    const expression = days.map((day) => `CASE WHEN d.year_month = ? THEN d.${day.field} ELSE 0 END`).join(' + ');
    const { rows } = await this.PackageVersionDownload.query(
      `SELECT p.scope, p.name, SUM(${expression}) AS downloads
       FROM package_version_downloads d JOIN packages p ON p.package_id = d.package_id
       WHERE d.year_month BETWEEN ? AND ? AND d.version <> ? AND p.is_private = ?
       GROUP BY p.scope, p.name HAVING SUM(${expression}) >= ?
       ORDER BY downloads DESC, p.scope, p.name LIMIT ?`,
      [
        ...days.map((day) => day.month),
        days[6].month,
        days[0].month,
        '*',
        false,
        ...days.map((day) => day.month),
        minDownloads,
        limit,
      ],
    );
    // Exclude imported '*' totals: adding them to per-version counters double-counts traffic.
    return (rows || []).map((row: { scope: string; name: string; downloads: number | string }) => ({
      name: getFullname(row.scope, row.name),
      downloads: Number(row.downloads),
    }));
  }

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
      this.logger.info(
        '[PackageVersionDownloadRepository:plus:new] id: %s, packageId: %s, version: %s, yearMonth: %s',
        model.id,
        model.packageId,
        model.version,
        model.yearMonth,
      );
    }
    await this.PackageVersionDownload.where({ id: model.id }).increment(field, counter);
    this.logger.info(
      '[PackageVersionDownloadRepository:plus:increment] id: %s, packageId: %s, version: %s, field: %s%s, plus: %d',
      model.id,
      model.packageId,
      model.version,
      model.yearMonth,
      field,
      counter,
    );
  }

  async query(packageId: string, start: Date, end: Date): Promise<PackageVersionDownloadModel[]> {
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
    for (const [date, counter] of counters) {
      const field = `d${date}`;
      (model as unknown as Record<string, number>)[field] = counter;
    }
    await model.save();
  }
}
