import js from '@eslint/js'
import i18next from 'eslint-plugin-i18next'

/**
 * TSK-018 / TSK-021 guardrail for REQ-009 RN-002 (no visible string literals).
 * Promoted to `error` in TSK-021 once core screens were migrated.
 *
 * Allowlist: punctuation, symbols, brand abbreviations, and decorative
 * glyphs (emoji / chevrons). Those are not copy — see TSK-021 insumos.
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
        'error',
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
            // Each string entry is interpolated into /^…$/ by the plugin with NO
            // escaping, so regex metacharacters must be escaped here:
            //   '+' would throw "Nothing to repeat" and kill the whole lint,
            //   '|' would compile to /^|$/, which matches every string and
            //   silently disables the rule — worse than crashing, because it
            //   reports zero warnings and looks like a finished migration.
            //
            // RegExp instances are accepted as-is (emoji / symbol classes).
            exclude: [
              '•', '–', '—', '…', '·', '/', '×', '%', '-',
              '\\+', '\\|',
              'h', 'OKR', 'WIP', 'AI', 'PDF',
              'T', 'U',
              '\\(', '\\)',
              // Decorative glyphs (emoji, chevrons, arrows). Trimmed by the
              // plugin before matching, so trailing spaces in JSX don't matter.
              /^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*$/u,
              /^[‹›←→⤓↻↳✕⚠ℹ️✨]$/u,
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
