import { defineConfig } from 'vite-plus';

export default defineConfig({
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
      // Keep e18e rules compatible with ES2022 and Oxlint's JavaScript plugin support.
      'e18e/prefer-array-at': 'error',
      'e18e/prefer-array-fill': 'error',
      'e18e/prefer-includes': 'error',
      'e18e/prefer-nullish-coalescing': 'error',
      'e18e/prefer-object-has-own': 'error',
      'e18e/prefer-url-canparse': 'error',
      'e18e/prefer-array-from-map': 'error',
      'e18e/prefer-timer-args': 'error',
      'e18e/prefer-date-now': 'error',
      'e18e/prefer-regex-test': 'error',
      'e18e/prefer-array-some': 'error',
      'e18e/prefer-static-regex': 'error',
      'e18e/prefer-string-fromcharcode': 'error',
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
        files: ['test/**'],
        rules: {
          'e18e/prefer-static-regex': 'off',
        },
      },
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
      '@e18e/eslint-plugin',
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
