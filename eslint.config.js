// @ts-check
import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** Import paths that only `src/app/createServices.ts` may use (ENGINEERING_STANDARDS.md 3.1). */
const SERVICE_IMPLEMENTATIONS = {
  group: ['@/services/mock', '@/services/mock/*', '@/services/supabase', '@/services/supabase/*'],
  message: 'Use useServices(). Only src/app/createServices.ts may import a service implementation.',
}

/** Relative imports that climb out of a folder hide layer crossings; use the "@/" alias instead. */
const DEEP_RELATIVE = {
  group: ['../../*'],
  message: 'Import across folders with the "@/" alias.',
}

/**
 * @param {{ group: string[], message: string }[]} extra
 */
function restrictImports(extra = []) {
  return {
    'no-restricted-imports': [
      'error',
      { patterns: [SERVICE_IMPLEMENTATIONS, DEEP_RELATIVE, ...extra] },
    ],
  }
}

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'docs'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render user HTML with <SafeHtml> (ENGINEERING_STANDARDS.md 6.1).',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      ...restrictImports(),
    },
  },

  // Layer boundaries (ENGINEERING_STANDARDS.md 3.1).
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: restrictImports([
      {
        group: [
          '@/services',
          '@/services/*',
          '@/hooks/*',
          '@/pages/*',
          '@/layouts/*',
          '@/features/*',
          '@/app/*',
        ],
        message: 'Components render props only. Fetch data in a page or hook.',
      },
    ]),
  },
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: restrictImports([
      {
        group: [
          '@/services',
          '@/services/*',
          '@/hooks/*',
          '@/components/*',
          '@/pages/*',
          '@/layouts/*',
          '@/features/*',
          '@/app/*',
        ],
        message: 'lib/ holds pure helpers and may import only from types/.',
      },
    ]),
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: restrictImports([
      {
        group: ['@/components/*', '@/pages/*', '@/layouts/*'],
        message: 'Hooks must not depend on UI modules.',
      },
    ]),
  },
  {
    files: ['src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            DEEP_RELATIVE,
            {
              group: [
                '@/hooks/*',
                '@/components/*',
                '@/pages/*',
                '@/layouts/*',
                '@/features/*',
                '@/app/*',
              ],
              message: 'Services must not depend on UI modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/createServices.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // Test helpers build real implementations to inject as fakes.
  {
    files: ['src/test/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [DEEP_RELATIVE] }] },
  },

  // The one place allowed to inject HTML.
  {
    files: ['src/components/common/SafeHtml.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // Generated shadcn/ui primitives.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Tests may build fixtures more loosely.
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },

  // Node-side config files.
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
