/**
 * ESLint configuration: code-quality rules, React and accessibility rules, the folder import
 * boundaries (ENGINEERING_STANDARDS.md 3.1) and the security bans. Runs in the pre-commit hook
 * and in CI.
 */

// Type-check this JavaScript file with the TypeScript compiler.
// @ts-check
// ESLint's recommended JavaScript rules.
import js from '@eslint/js'
// Accessibility rules for JSX (missing labels, alt text, roles…).
import jsxA11y from 'eslint-plugin-jsx-a11y'
// Rules of Hooks, and dependency checks for effects.
import reactHooks from 'eslint-plugin-react-hooks'
// Keeps files compatible with fast refresh during development.
import reactRefresh from 'eslint-plugin-react-refresh'
// Lists of built-in global names (window, process…).
import globals from 'globals'
// TypeScript-aware rules.
import tseslint from 'typescript-eslint'

/** Import paths that only `src/app/createServices.ts` may use (ENGINEERING_STANDARDS.md 3.1). */
const SERVICE_IMPLEMENTATIONS = {
  // The mock and Supabase implementation folders.
  group: ['@/services/mock', '@/services/mock/*', '@/services/supabase', '@/services/supabase/*'],
  // Shown when the rule is broken.
  message: 'Use useServices(). Only src/app/createServices.ts may import a service implementation.',
}

/** Relative imports that climb out of a folder hide layer crossings; use the "@/" alias instead. */
const DEEP_RELATIVE = {
  // Any import that climbs two or more folders up.
  group: ['../../*'],
  message: 'Import across folders with the "@/" alias.',
}

/**
 * @param {{ group: string[], message: string }[]} extra
 */
/** Builds the import-restriction rule: the two patterns above plus folder-specific ones. */
function restrictImports(extra = []) {
  return {
    'no-restricted-imports': [
      'error',
      // Always ban implementation imports and deep relative paths, plus any extras.
      { patterns: [SERVICE_IMPLEMENTATIONS, DEEP_RELATIVE, ...extra] },
    ],
  }
}

// The configuration is a list of blocks; later blocks override earlier ones for their files.
export default tseslint.config(
  {
    // Build output, reports and docs are not linted.
    ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'docs'],
  },
  {
    // Base rules for every TypeScript file.
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Core JavaScript mistakes.
      js.configs.recommended,
      // Strict type-aware rules: no `any`, no unsafe calls, no floating promises…
      ...tseslint.configs.strictTypeChecked,
      // Consistent TypeScript style.
      ...tseslint.configs.stylisticTypeChecked,
      // Hooks called correctly, effect dependencies complete.
      reactHooks.configs.flat['recommended-latest'],
      // Fast-refresh compatibility.
      reactRefresh.configs.vite,
      // Accessibility (ENGINEERING_STANDARDS.md 7).
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      // Modern JavaScript syntax.
      ecmaVersion: 2023,
      // Browser globals such as window and document.
      globals: globals.browser,
      parserOptions: {
        // Use the tsconfig files for type information.
        projectService: true,
        // Look for them next to this file.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // SECURITY: no console output in committed code; it can leak student data. Use reportError().
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          // SECURITY: bans raw HTML injection (the XSS entry point) everywhere except SafeHtml.
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render user HTML with <SafeHtml> (ENGINEERING_STANDARDS.md 6.1).',
        },
      ],
      // Type-only imports use `import type`, so they vanish from the built code.
      '@typescript-eslint/consistent-type-imports': 'error',
      // Only strings and numbers inside template strings, so objects never print as "[object Object]".
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Default import boundaries for every file.
      ...restrictImports(),
    },
  },

  // Layer boundaries (ENGINEERING_STANDARDS.md 3.1).
  {
    // Components render props only; no data fetching, pages or app wiring.
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
    // lib/ is pure helpers that depend on nothing else in the app.
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
    // Hooks fetch data and never import UI.
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: restrictImports([
      {
        group: ['@/components/*', '@/pages/*', '@/layouts/*'],
        message: 'Hooks must not depend on UI modules.',
      },
    ]),
  },
  {
    // Services never import UI or app code.
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
    // The factory is the one file allowed to import implementations.
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
    // SECURITY: this file sanitises before injecting, so the HTML ban is lifted here only.
    files: ['src/components/common/SafeHtml.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // Generated shadcn/ui primitives.
  {
    // shadcn files export components and their style helpers together.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Tests may build fixtures more loosely.
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      // Tests may assert a value exists with `!`.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },

  // Node-side config files.
  {
    // Config files and browser tests run in Node, not the browser.
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // This file has no tsconfig project, so skip type-aware rules for it.
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
