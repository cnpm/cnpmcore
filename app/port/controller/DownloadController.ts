import { HTTPController, HTTPMethod, HTTPMethodEnum, HTTPParam, Inject } from 'egg';
import { UnprocessableEntityError } from 'egg/errors';

import dayjs from '../../common/dayjs.ts';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil.ts';
import type { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository.ts';
import { AbstractController } from './AbstractController.ts';

const DATE_FORMAT = 'YYYY-MM-DD';

@HTTPController()
export class DownloadController extends AbstractController {
  @Inject()
  private packageVersionDownloadRepository: PackageVersionDownloadRepository;

  // npm compatible: /downloads/point/{period}/{package}
  // @see https://github.com/npm/registry/blob/master/docs/download-counts.md
  @HTTPMethod({
    path: `/downloads/point/:range/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.GET,
  })
  async showPackageDownloadPoint(@HTTPParam() fullname: string, @HTTPParam() range: string) {
    const [startDate, endDate] = this.checkAndGetRange(range);
    const pkg = await this.getPackageEntityByFullname(fullname);
    const entities = await this.packageVersionDownloadRepository.query(
      pkg.packageId,
      startDate.toDate(),
      endDate.toDate(),
    );
    const total = this.sumDownloads(entities, startDate, endDate);
    return {
      downloads: total,
      start: startDate.format(DATE_FORMAT),
      end: endDate.format(DATE_FORMAT),
      package: fullname,
    };
  }

  // /downloads/total/point/{period} (all packages, total count)
  @HTTPMethod({
    path: '/downloads/total/point/:range',
    method: HTTPMethodEnum.GET,
  })
  async showTotalDownloadPoint(@HTTPParam() range: string) {
    const [startDate, endDate] = this.checkAndGetRange(range);
    const entities = await this.packageVersionDownloadRepository.query('total', startDate.toDate(), endDate.toDate());
    const total = this.sumDownloads(entities, startDate, endDate);
    return {
      downloads: total,
      start: startDate.format(DATE_FORMAT),
      end: endDate.format(DATE_FORMAT),
    };
  }

  @HTTPMethod({
    path: `/downloads/range/:range/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.GET,
  })
  async showPackageDownloads(@HTTPParam() fullname: string, @HTTPParam() range: string) {
    const [startDate, endDate] = this.checkAndGetRange(range);
    const pkg = await this.getPackageEntityByFullname(fullname);
    const entities = await this.packageVersionDownloadRepository.query(
      pkg.packageId,
      startDate.toDate(),
      endDate.toDate(),
    );
    const days: Record<string, number> = {};
    const versions: Record<string, { day: string; downloads: number }[]> = {};
    for (const entity of entities) {
      const yearMonth = entity.yearMonth as number;
      const yearStr = String(yearMonth).slice(0, 4);
      const monthStr = String(yearMonth).slice(4, 6);
      const prefix = `${yearStr}-${monthStr}`;
      const [fromDay, toDay] = this.getDayRange(yearMonth, startDate, endDate);
      for (let i = fromDay; i <= toDay; i++) {
        const day = String(i).padStart(2, '0');
        const field = `d${day}` as keyof typeof entity;
        const counter = entity[field] as number;
        if (!counter) continue;
        const date = `${prefix}-${day}`;
        days[date] = (days[date] || 0) + counter;
        if (entity.version === '*') {
          // ignore sync data to versions
          continue;
        }
        if (!versions[entity.version]) versions[entity.version] = [];
        versions[entity.version].push({ day: date, downloads: counter });
      }
    }
    const downloads: { day: string; downloads: number }[] = [];
    for (const day of Object.keys(days).sort()) {
      downloads.push({ day, downloads: days[day] });
    }

    return {
      downloads,
      start: startDate.format(DATE_FORMAT),
      end: endDate.format(DATE_FORMAT),
      package: fullname,
      versions,
    };
  }

  @HTTPMethod({
    path: '/downloads/:scope/:range',
    method: HTTPMethodEnum.GET,
  })
  async showTotalDownloads(@HTTPParam() scope: string, @HTTPParam() range: string) {
    const [startDate, endDate] = this.checkAndGetRange(range);
    const entities = await this.packageVersionDownloadRepository.query(scope, startDate.toDate(), endDate.toDate());
    const days: Record<string, number> = {};
    for (const entity of entities) {
      const yearMonth = entity.yearMonth as number;
      const yearStr = String(yearMonth).slice(0, 4);
      const monthStr = String(yearMonth).slice(4, 6);
      const prefix = `${yearStr}-${monthStr}`;
      const [fromDay, toDay] = this.getDayRange(yearMonth, startDate, endDate);
      for (let i = fromDay; i <= toDay; i++) {
        const day = String(i).padStart(2, '0');
        const field = `d${day}` as keyof typeof entity;
        const counter = entity[field] as number;
        if (!counter) continue;
        const date = `${prefix}-${day}`;
        days[date] = (days[date] || 0) + counter;
      }
    }
    const downloads: { day: string; downloads: number }[] = [];
    for (const day of Object.keys(days).sort()) {
      downloads.push({ day, downloads: days[day] });
    }

    return {
      downloads,
      start: startDate.format(DATE_FORMAT),
      end: endDate.format(DATE_FORMAT),
    };
  }

  // Get the valid day range [startDay, endDay] for a given entity's yearMonth
  // considering the requested date range boundaries
  private getDayRange(yearMonth: number, startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): [number, number] {
    const year = Math.floor(yearMonth / 100);
    const month = yearMonth % 100;
    const startYM = startDate.year() * 100 + startDate.month() + 1;
    const endYM = endDate.year() * 100 + endDate.month() + 1;
    const entityYM = year * 100 + month;
    // Days in this month
    const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
    let fromDay = 1;
    let toDay = daysInMonth;
    if (entityYM === startYM) {
      fromDay = startDate.date();
    }
    if (entityYM === endYM) {
      toDay = endDate.date();
    }
    return [fromDay, toDay];
  }

  private sumDownloads(entities: Iterable<Record<string, unknown>>, startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): number {
    let total = 0;
    for (const entity of entities) {
      const yearMonth = entity.yearMonth as number;
      const [fromDay, toDay] = this.getDayRange(yearMonth, startDate, endDate);
      for (let i = fromDay; i <= toDay; i++) {
        const field = `d${String(i).padStart(2, '0')}`;
        const counter = entity[field] as number;
        if (counter) total += counter;
      }
    }
    return total;
  }

  private checkAndGetRange(range: string) {
    // Support npm-compatible period aliases
    // @see https://github.com/npm/registry/blob/master/docs/download-counts.md
    const today = dayjs();
    switch (range) {
      case 'last-day':
        return [today.subtract(1, 'day'), today.subtract(1, 'day')];
      case 'last-week':
        return [today.subtract(7, 'day'), today.subtract(1, 'day')];
      case 'last-month':
        return [today.subtract(30, 'day'), today.subtract(1, 'day')];
      case 'last-year':
        return [today.subtract(365, 'day'), today.subtract(1, 'day')];
      default:
        break;
    }

    // Support single date: YYYY-MM-DD
    const singleDateMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(range);
    if (singleDateMatch) {
      const date = dayjs(singleDateMatch[1], DATE_FORMAT, true);
      if (!date.isValid()) {
        throw new UnprocessableEntityError(
          `range(${range}) format invalid, must be "last-day", "last-week", "last-month", "last-year", "${DATE_FORMAT}" or "${DATE_FORMAT}:${DATE_FORMAT}" style`,
        );
      }
      return [date, date];
    }

    // Support date range: YYYY-MM-DD:YYYY-MM-DD
    const matchs = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(range);
    if (!matchs) {
      throw new UnprocessableEntityError(
        `range(${range}) format invalid, must be "last-day", "last-week", "last-month", "last-year", "${DATE_FORMAT}" or "${DATE_FORMAT}:${DATE_FORMAT}" style`,
      );
    }
    const start = matchs[1];
    const end = matchs[2];
    let startDate = dayjs(start, DATE_FORMAT, true);
    let endDate = dayjs(end, DATE_FORMAT, true);
    if (!startDate.isValid() || !endDate.isValid()) {
      throw new UnprocessableEntityError(
        `range(${range}) format invalid, must be "last-day", "last-week", "last-month", "last-year", "${DATE_FORMAT}" or "${DATE_FORMAT}:${DATE_FORMAT}" style`,
      );
    }
    if (endDate.isBefore(startDate)) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
    // max range for one year
    const maxDate = startDate.add(1, 'year');
    if (endDate.isAfter(maxDate)) {
      throw new UnprocessableEntityError(
        `range(${range}) beyond the processable range, max up to "${maxDate.format(DATE_FORMAT)}"`,
      );
    }
    return [startDate, endDate];
  }
}
