import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
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
