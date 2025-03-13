const TimeoutErrorNames = new Set([
  'HttpClientRequestTimeoutError',
  'HttpClientConnectTimeoutError',
  'ConnectionError',
  'ConnectTimeoutError',
  'BodyTimeoutError',
  'ResponseTimeoutError',
]);

export function isTimeoutError(err: Error) {
  if (TimeoutErrorNames.has(err.name)) {
    return true;
  }
  if (err instanceof AggregateError && err.errors) {
    for (const subError of err.errors) {
      if (TimeoutErrorNames.has(subError.name)) {
        return true;
      }
    }
  }
  if ('cause' in err && err.cause instanceof Error) {
    if (TimeoutErrorNames.has(err.cause.name)) {
      return true;
    }
  }
  return false;
}
