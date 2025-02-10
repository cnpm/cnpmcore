export type ValueType = 'string' | 'boolean' | 'number';

export function env(key: string, valueType: ValueType, defaultValue: string): string;
export function env(key: string, valueType: ValueType, defaultValue: boolean): boolean;
export function env(key: string, valueType: ValueType, defaultValue: number): number;
export function env(key: string, valueType: ValueType, defaultValue: string | boolean | number): string | boolean | number {
  let value = process.env[key];
  if (typeof value === 'string') {
    value = value.trim();
  }
  if (!value) {
    return defaultValue;
  }

  if (valueType === 'string') {
    return value;
  }

  if (valueType === 'boolean') {
    let booleanValue = false;
    if (value === 'true' || value === '1') {
      booleanValue = true;
    } else if (value === 'false' || value === '0') {
      booleanValue = false;
    } else {
      throw new TypeError(`Invalid boolean value: ${value} on process.env.${key}`);
    }
    return booleanValue;
  }

  if (valueType === 'number') {
    const numberValue = Number(value);
    if (isNaN(numberValue)) {
      throw new TypeError(`Invalid number value: ${value} on process.env.${key}`);
    }
    return numberValue;
  }

  throw new TypeError(`Invalid value type: ${valueType}`);
}
