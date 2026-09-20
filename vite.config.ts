import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    // Match egg-bin's application setup and shared, sequential test worker.
    include: ['test/**/*.test.ts'],
    exclude: ['**/test/fixtures/**', '**/test/node_modules/**', '**/node_modules/**'],
    globals: true,
    pool: 'threads',
    isolate: false,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    runner: '@eggjs/tegg-vitest/runner',
    setupFiles: ['@eggjs/tegg-vitest/setup', './test/.setup.ts', '@eggjs/mock/setup_vitest'],
    env: {
      EGG_TYPESCRIPT: 'true',
      EGG_VITEST_POOL: 'threads',
      EGG_VITEST_ISOLATE: 'false',
    },
    server: {
      deps: { inline: [/^(?!.*@vitest)/] },
    },
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  fmt: {
    printWidth: 120,
    singleQuote: true,
    ignorePatterns: ['__snapshots__', 'test/fixtures', '**/*.md'],
    sortImports: {
      groups: [['type-import'], ['builtin'], ['external', 'internal'], ['parent', 'sibling', 'index'], ['unknown']],
      newlinesBetween: true,
      order: 'asc',
    },
  },
  lint: {
    env: {
      node: true,
      vitest: true,
    },
    rules: {
      'max-params': ['error', 6],
      'no-console': 'warn',
      'import/no-anonymous-default-export': 'error',
      'no-unassigned-import': 'allow',
      'new-cap': 'allow',
      'class-methods-use-this': 'allow',
      'import/no-named-export': 'allow',
      'unicorn/no-array-sort': 'allow',
      'no-param-reassign': 'allow',
      'unicorn/prefer-at': 'allow',
      'no-process-env': 'allow',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    ignorePatterns: ['index.d.ts'],
    overrides: [
      {
        files: ['benchmark/**'],
        rules: {
          'no-console': 'allow',
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
  staged: {
    '*': ['vp check --fix'],
  },
});
