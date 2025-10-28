import { Event, Inject } from 'egg';

import { PACKAGE_ADDED, PACKAGE_VERSION_ADDED } from './index.ts';
import type { TotalRepository } from '../../repository/TotalRepository.ts';

class TotalHandlerEvent {
  @Inject()
  protected readonly totalRepository: TotalRepository;
}

@Event(PACKAGE_ADDED)
export class PackageAddedTotalHandlerEvent extends TotalHandlerEvent {
  async handle() {
    await this.totalRepository.incrementPackageCount();
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAddedTotalHandlerEvent extends TotalHandlerEvent {
  async handle() {
    await this.totalRepository.incrementPackageVersionCount();
  }
}
