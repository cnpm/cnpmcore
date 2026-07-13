import { DependencyIsolationPolicy } from './typing';

const GMT8_OFFSET = 8 * 60 * 60 * 1000;

export function createDefaultDependencyIsolationPolicy(duration?: number): DependencyIsolationPolicy | null {
  if (!duration || duration <= 0) return null;

  const expiredAt = new Date(Date.now() + duration);
  const expiredAtGMT8 = `${new Date(expiredAt.getTime() + GMT8_OFFSET).toISOString().slice(0, -1)}+08:00`;
  return {
    expiredAt,
    reason: `[buffer] in dependency isolation zone, release at ${expiredAtGMT8}`,
  };
}
