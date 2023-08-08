import { ContextCnpmcore } from "./app/core/typing";

declare module "egg" {
  export interface EggContextModule {
    cnpmcoreCore: ContextCnpmcore;
  }
};
