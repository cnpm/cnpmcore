// Type declarations for vitest test globals
// These are injected by vitest with `globals: true` at runtime
// `before`/`after` are set on globalThis by @eggjs/mock/setup_vitest

type VitestTestFunction = (name: string | Function, fn?: () => void | Promise<void>, timeout?: number) => void;

interface VitestSuiteAPI {
  (name: string | Function, fn: () => void | Promise<void>, timeout?: number): void;
  only: VitestTestFunction;
  skip: VitestTestFunction;
  todo: VitestTestFunction;
}

interface VitestTestAPI {
  (name: string | Function, fn: () => void | Promise<void>, timeout?: number): void;
  only: VitestTestFunction;
  skip: VitestTestFunction;
  todo: VitestTestFunction;
}

type VitestHookFunction = (fn: () => void | Promise<void>, timeout?: number) => void;

declare var describe: VitestSuiteAPI;
declare var it: VitestTestAPI;
declare var beforeAll: VitestHookFunction;
declare var afterAll: VitestHookFunction;
declare var beforeEach: VitestHookFunction;
declare var afterEach: VitestHookFunction;
declare var before: VitestHookFunction;
declare var after: VitestHookFunction;
