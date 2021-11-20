import { performance } from 'perf_hooks';

const LOGGER = 'logger';

// auto print async function call performance timer log into logger
export function AsyncTimer(prefix: string, loggerMethod = 'info') {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = async function(...args: any[]) {
      const start = performance.now();
      const result = await Reflect.apply(original, this, args);
      const ms = Math.floor((performance.now() - start) * 1000) / 1000;
      this[LOGGER][loggerMethod]('[%s] [%s:%s]', ms, prefix, propertyKey);
      return result;
    };
  };
}
