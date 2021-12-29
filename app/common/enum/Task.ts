export enum TaskType {
  SyncPackage = 'sync_package',
  ChangesStream = 'changes_stream',
  SyncBinary = 'sync_binary',
}

export enum TaskState {
  Waiting = 'waiting',
  Processing = 'processing',
  Success = 'success',
  Fail = 'fail',
  Timeout = 'timeout',
}
