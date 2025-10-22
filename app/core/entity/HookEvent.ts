import { HookEventType } from '../../common/enum/Hook.ts';

export interface PublishChangePayload {
  'dist-tag'?: string;
  version: string;
}

export interface UnpublishChangePayload {
  'dist-tag'?: string;
  version?: string;
}

export interface DistTagChangePayload {
  'dist-tag': string;
}

export interface PackageOwnerPayload {
  maintainer: string;
}

export interface DeprecatedChangePayload {
  deprecated: string;
}

export class HookEvent<T = object> {
  readonly changeId: string;
  readonly event: HookEventType;
  readonly fullname: string;
  readonly type: 'package';
  readonly version: '1.0.0';
  readonly change: T;
  readonly time: number;

  constructor(event: HookEventType, changeId: string, fullname: string, change: T) {
    this.changeId = changeId;
    this.event = event;
    this.fullname = fullname;
    this.type = 'package';
    this.version = '1.0.0';
    this.change = change;
    this.time = Date.now();
  }

  static createPublishEvent(fullname: string, changeId: string, version: string, distTag?: string): HookEvent<PublishChangePayload> {
    return new HookEvent(HookEventType.Publish, changeId, fullname, {
      'dist-tag': distTag,
      version,
    });
  }

  static createUnpublishEvent(fullname: string, changeId: string, version?: string, distTag?: string): HookEvent<UnpublishChangePayload> {
    return new HookEvent(HookEventType.Unpublish, changeId, fullname, {
      'dist-tag': distTag,
      version,
    });
  }

  static createOwnerEvent(fullname: string, changeId: string, maintainer: string): HookEvent<PackageOwnerPayload> {
    return new HookEvent(HookEventType.Owner, changeId, fullname, {
      maintainer,
    });
  }

  static createOwnerRmEvent(fullname: string, changeId: string, maintainer: string): HookEvent<PackageOwnerPayload> {
    return new HookEvent(HookEventType.OwnerRm, changeId, fullname, {
      maintainer,
    });
  }

  static createDistTagEvent(fullname: string, changeId: string, distTag: string): HookEvent<DistTagChangePayload> {
    return new HookEvent(HookEventType.DistTag, changeId, fullname, {
      'dist-tag': distTag,
    });
  }

  static createDistTagRmEvent(fullname: string, changeId: string, distTag: string): HookEvent<DistTagChangePayload> {
    return new HookEvent(HookEventType.DistTagRm, changeId, fullname, {
      'dist-tag': distTag,
    });
  }

  static createDeprecatedEvent(fullname: string, changeId: string, deprecated: string): HookEvent<DeprecatedChangePayload> {
    return new HookEvent(HookEventType.Deprecated, changeId, fullname, {
      deprecated,
    });
  }

  static createUndeprecatedEvent(fullname: string, changeId: string, deprecated: string): HookEvent<DeprecatedChangePayload> {
    return new HookEvent(HookEventType.Undeprecated, changeId, fullname, {
      deprecated,
    });
  }
}
