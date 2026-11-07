export interface SyncRecheckConfig {
  enabled: boolean;
  minWeeklyDownloads: number;
  maxPendingPackages: number;
  /** Elapsed milliseconds after the first change, not delays between attempts. */
  delays: number[];
  maxAttemptsPerHour: number;
  dispatchInterval: number;
}

export interface SyncRecheckState {
  fullname: string;
  registryId: string;
  seq: string;
  generation: number;
  firstSeenAt: number;
  nextCheckAt: number;
  pending: boolean;
  step: number;
  attempts: number[];
  expectedVersions: Record<string, true>;
  unknownTarget: boolean;
  lastTaskId: string;
  lease?: string;
  dispatchTaskId?: string;
  dispatchGeneration?: number;
}
