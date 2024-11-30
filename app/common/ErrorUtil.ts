const TimeoutErrorNames = [
  'HttpClientRequestTimeoutError',
  'HttpClientConnectTimeoutError',
  'ConnectionError',
  'ConnectTimeoutError',
  'BodyTimeoutError',
  'ResponseTimeoutError',
];

export function isTimeoutError(err: Error) {
  if (TimeoutErrorNames.includes(err.name)) {
    return true;
  }
  if (err instanceof AggregateError && err.errors) {
    for (const subError of err.errors) {
      if (TimeoutErrorNames.includes(subError.name)) {
        return true;
      }
    }
  }
  if (err.cause instanceof Error) {
    if (TimeoutErrorNames.includes(err.cause.name)) {
      return true;
    }
  }
  return false;
}
