// EggAppConfig augmentation
// Placed in a .d.ts file to leverage skipLibCheck and avoid
// circular type resolution with PartialDeep<EggAppConfig>
import type { CnpmcoreConfig } from '../port/config.ts';

declare module 'egg' {
  interface EggAppConfig {
    cnpmcore: CnpmcoreConfig;
  }
}
