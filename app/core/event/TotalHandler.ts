import { Event, Inject } from '@eggjs/tegg';
import { PACKAGE_ADDED, PACKAGE_VERSION_ADDED } from './index.js';
import type { TotalRepository } from '../../repository/TotalRepository.js';

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
