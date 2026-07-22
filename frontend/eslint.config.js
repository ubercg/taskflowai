import js from '@eslint/js'
import i18next from 'eslint-plugin-i18next'

/**
 * TSK-018 guardrail for REQ-009 RN-002 (no visible string literals).
 * Starts as `warn`; promote to `error` when closing TSK-020.
 *
 * Allowlist: punctuation, symbols, units, and attributes that are not copy.
 */
export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { i18next },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        process: 'readonly',
        import: 'readonly',
      },
    },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          markupOnly: true,
          ignoreAttribute: [
            'className',
            'class',
            'style',
            'type',
            'role',
            'data-testid',
            'data-theme',
            'viewBox',
            'fill',
            'stroke',
            'strokeWidth',
            'strokeLinecap',
            'strokeLinejoin',
            'width',
            'height',
            'd',
            'cx',
            'cy',
            'r',
            'x1',
            'y1',
            'x2',
            'y2',
            'points',
            'to',
            'href',
            'src',
            'alt',
            'htmlFor',
            'id',
            'name',
            'autoComplete',
            'placeholder',
            'title',
            'aria-label',
            'aria-pressed',
          ],
          words: {
            // Non-copy tokens: punctuation, icons, units, brand abbreviations.
            //
            // Each entry is interpolated into /^…$/ by the plugin with NO
            // escaping, so regex metacharacters must be escaped here:
            //   '+' would throw "Nothing to repeat" and kill the whole lint,
            //   '|' would compile to /^|$/, which matches every string and
            //   silently disables the rule — worse than crashing, because it
            //   reports zero warnings and looks like a finished migration.
            exclude: [
              '•', '–', '—', '…', '·', '/', '×', '%', '-',
              '\\+', '\\|',
              'h', 'OKR', 'WIP', 'AI', 'PDF',
            ],
          },
        },
      ],
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'src/**/__tests__/**', 'src/test/**'],
  },
]
