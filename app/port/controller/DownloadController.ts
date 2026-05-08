import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
} from '@eggjs/tegg';
import { UnprocessableEntityError, NotFoundError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING, getScopeAndName } from '../../common/PackageUtil';
import dayjs from '../../common/dayjs';
import { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository';

const DATE_FORMAT = 'YYYY-MM-DD';

@HTTPController()
export class DownloadController extends AbstractController {
  @Inject()
  private packageVersionDownloadRepository: PackageVersionDownloadRepository;

  @HTTPMethod({
    path: `/downloads/range/:range/:fullname(${FULLNAME_REG_STRING})`,
    method: HTTPMethodEnum.GET,
  })
  async showPackageDownloads(@HTTPParam() fullname: string, @HTTPParam() range: string) {
    const [ startDate, endDate ] = this.checkAndGetRange(range);
    const [ scope, name ] = getScopeAndName(fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) throw new NotFoundError(`${fullname} not found`);
    const entities = await this.packageVersionDownloadRepository.query(pkg.packageId, startDate.toDate(), endDate.toDate());
    const days: Record<string, number> = {};
    const versions: Record<string, { day: string, downloads: number }[]> = {};
    for (const entity of entities) {
      const yearMonth = entity.yearMonth as number;
      const yearMonthStr = String(yearMonth);
      const prefix = yearMonthStr.substring(0, 4) + '-' + yearMonthStr.substring(4, 6);
      const [ fromDay, toDay ] = this.getDayRange(yearMonth, startDate, endDate);
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
      versions,
    };
  }

  @HTTPMethod({
    path: '/downloads/:scope/:range',
    method: HTTPMethodEnum.GET,
  })
  async showTotalDownloads(@HTTPParam() scope: string, @HTTPParam() range: string) {
    const [ startDate, endDate ] = this.checkAndGetRange(range);
    const entities = await this.packageVersionDownloadRepository.query(scope, startDate.toDate(), endDate.toDate());
    const days: Record<string, number> = {};
    for (const entity of entities) {
      const yearMonth = entity.yearMonth as number;
      const yearMonthStr = String(yearMonth);
      const prefix = yearMonthStr.substring(0, 4) + '-' + yearMonthStr.substring(4, 6);
      const [ fromDay, toDay ] = this.getDayRange(yearMonth, startDate, endDate);
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
    const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
    let fromDay = 1;
    let toDay = daysInMonth;
    if (entityYM === startYM) {
      fromDay = startDate.date();
    }
    if (entityYM === endYM) {
      toDay = endDate.date();
    }
    return [ fromDay, toDay ];
  }

  private checkAndGetRange(range: string) {
    const matchs = /^(\d{4}\-\d{2}\-\d{2}):(\d{4}\-\d{2}\-\d{2})$/.exec(range);
    if (!matchs) {
      throw new UnprocessableEntityError(`range(${range}) format invalid, must be "${DATE_FORMAT}:${DATE_FORMAT}" style`);
    }
    const start = matchs[1];
    const end = matchs[2];
    let startDate = dayjs(start, DATE_FORMAT, true);
    let endDate = dayjs(end, DATE_FORMAT, true);
    if (!startDate.isValid() || !endDate.isValid()) {
      throw new UnprocessableEntityError(`range(${range}) format invalid, must be "${DATE_FORMAT}:${DATE_FORMAT}" style`);
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
        `range(${range}) beyond the processable range, max up to "${maxDate.format(DATE_FORMAT)}"`);
    }
    return [ startDate, endDate ];
  }
}
