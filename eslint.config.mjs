// @ts-check

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  vi: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/out/**',
      '**/release/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/*.tsbuildinfo',
      '**/.screenshot-temp/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
  },

  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'scripts/**/*.{js,mjs}',
      'native-host/**/*.{js,mjs}',
      'electron.vite.config.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: [
      'src/**/*.{ts,vue}',
      '!src/main/**',
      '!src/preload/**',
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  {
    files: ['extension/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      },
    },
  },

  {
    files: ['design/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        lucide: 'readonly',
      },
    },
  },

  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: vitestGlobals,
    },
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'vue/multi-word-component-names': 'off',
      'vue/component-name-in-template-casing': ['warn', 'PascalCase'],
    },
  },

  {
    files: ['scripts/**/*.{js,mjs}', 'src/main/screenshotMode.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
