import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import unusedImports from 'eslint-plugin-unused-imports';


// ─────────────────────────────────────────────────────────────────────────────
// STUB: @next/next — este projeto usa Vite, não Next.js.
// O bot Lovable escreve "// eslint-disable-next-line @next/next/no-img-element"
// sempre que toca em <img>. Sem este stub, ESLint reporta
// "Definition for rule not found" e estoura o baseline (0→1), quebrando produção.
//
// Solução: registrar @next/next como plugin com a regra como no-op e desabilitada.
// O disable comment passa a ser um "suppress de regra conhecida mas off" — silencioso.
// reportUnusedDisableDirectives: 'off' garante que nenhum warning extra aparece.
// ─────────────────────────────────────────────────────────────────────────────
const nextPluginStub = {
  rules: {
    'no-img-element': {
      meta: { type: 'suggestion', docs: { description: 'Stub no-op — next/image não se aplica em Vite' } },
      create: () => ({}),
    },
  },
};

// Parser options compartilhados — apontam para o tsconfig.eslint.json que
// inclui src/, e2e/, tests/ e scripts/.
const tsParserOptions = {
  ecmaFeatures: { jsx: true },
  ecmaVersion: 'latest',
  sourceType: 'module',
  project: ['./tsconfig.eslint.json'],
  tsconfigRootDir: import.meta.dirname,
};

export default [
  {
    ignores: [
      'dist',
      'build',
      'node_modules',
      'coverage',
      'playwright-report',
      'test-results',
      'supabase/functions/**',
      '*.config.js',
      '*.config.ts',
      '.eslintrc.cjs',
      '.eslintrc.json',
    ],
  },

  // ──────────────────────────────────────────────────────────────────────
  // src/** — código de aplicação React (browser globals)
  // ──────────────────────────────────────────────────────────────────────

  // ── Stub @next/next ── evita "Definition for rule not found" em disable comments do Lovable
  {
    plugins: { '@next/next': nextPluginStub },
    rules:   { '@next/next/no-img-element': 'off' },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: tsParserOptions,
      globals: {
        ...globals.browser,
        React: 'readonly',
        process: 'readonly',
        NodeJS: 'readonly',
        global: 'readonly',
        SpeechRecognition: 'readonly',
        webkitSpeechRecognition: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@typescript-eslint': typescript,
      'jsx-a11y': jsxA11y,
      // ── Autoheal: imports não utilizados com auto-fix ──────────────────────
      'unused-imports': unusedImports,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      'no-undef': 'off',
      'no-redeclare': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // TypeScript strict rules
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        {
          selector: 'variable',
          modifiers: ['const', 'exported'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
      ],

      // General strict rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      // AUTO-FIXÁVEL: remove import declarations não utilizados (--fix remove a linha inteira).
      // Complementa @typescript-eslint/no-unused-vars (que detecta mas não auto-fixa imports).
      // Usado pelo workflow lovable-autoheal.yml para correção automática de commits do Lovable.
      'unused-imports/no-unused-imports': 'error',
      'no-else-return': 'warn',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],

      // React
      'react/no-danger': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── ESLint Batches 59-64: zero-violation quality rules ──────────────
      // Batch 64: 7 zero-violation base ESLint rules
      'no-lone-blocks': 'error',
      'no-label-var': 'error',
      'no-labels': 'error',
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
      'no-floating-decimal': 'error',
      'no-multi-str': 'error',
      'no-extra-label': 'error',
      // Batch 59: inner-scope shadowing
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      // Batch 65: 2 rules — no-alert (3 code fixes) + no-div-regex (1 auto-fix)
      'no-alert': 'error',
      'no-div-regex': 'error',
      // Batch 66: 1 rule — no-multi-assign (1 code fix in theme-presets.test.ts)
      'no-multi-assign': 'error',
      // Batch 67: 1 rule — no-script-url (4 code fixes: 1 prod + 3 test eslint-disable)
      'no-script-url': 'error',
      // Batch 68: 7 zero-violation rules (no code changes needed)
      'no-octal': 'error',
      'no-proto': 'error',
      'no-sequences': 'error',
      'no-template-curly-in-string': 'error',
      'no-throw-literal': 'error',
      'no-useless-catch': 'error',
      'prefer-const': 'error',
      // Batch 69: 3 rules — no-useless-concat (1 fix), no-var (1 fix), no-useless-return (4 fixes)
      'no-useless-concat': 'error',
      'no-var': 'error',
      'no-useless-return': 'error',
      // Batch 70: 1 rule — prefer-template (19 fixes in 15 files)
      'prefer-template': 'error',
      // Batch 71: 1 rule — prefer-arrow-callback (59 fixes, auto-fixed)
      'prefer-arrow-callback': 'error',
      // Batch 72: 1 rule — no-void allowAsStatement (24 fixes in 17 files)
      'no-void': ['error', { allowAsStatement: true }],
      // Batch 73: 2 rules — no-lonely-if (5 fixes in 4 files), object-shorthand (1 fix)
      'no-lonely-if': 'error',
      'object-shorthand': 'error',
      // Batch 74: 1 rule — prefer-exponentiation-operator (20 fixes, auto-fixed in 17 files)
      'prefer-exponentiation-operator': 'error',
      // Batch 75: 1 rule — dot-notation (24 fixes, auto-fixed in 7 files)
      'dot-notation': 'error',
      // Batch 76: 1 rule — operator-assignment (7 fixes in 7 files, mixed auto/manual)
      'operator-assignment': 'error',
      // Batch 77: 4 rules — zero violations (no code changes needed)
      'yoda': 'error',
      'no-useless-rename': 'error',
      'no-unneeded-ternary': 'error',
      // Batch 77: 6 zero-violation rules — logical operators + TS type-safety extensions
      'logical-assignment-operators': 'error',
      'no-unmodified-loop-condition': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      // Batch 78: 1 rule with violations + 12 zero-violation safety rules
      // no-promise-executor-return: 37 fixes in 25 files (block-form setTimeout)
      'no-promise-executor-return': 'error',
      'no-array-constructor': 'error',
      'no-new-object': 'error',
      'prefer-object-spread': 'error',
      'no-useless-rename': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-useless-call': 'error',
      'no-self-compare': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'symbol-description': 'error',
      // Batch 79: standard code quality rules (zero-violation confirmed)
      'no-extra-boolean-cast': 'error',
      'guard-for-in': 'error',
      'eqeqeq': 'error',
      'default-case-last': 'error',
      'default-param-last': 'error',
      'grouped-accessor-pairs': 'error',
      // Batch 80: 7 zero-violation standard rules
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-new-wrappers': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-escape': 'error',
      'prefer-numeric-literals': 'error',
      'no-regex-spaces': 'error',
      // Batch 81: 10 zero-violation security/correctness rules
      'no-new-func': 'error',
      'no-iterator': 'error',
      'no-proto': 'error',
      'no-extend-native': 'error',
      'no-global-assign': 'error',
      'no-octal': 'error',
      'no-with': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-sequences': 'error',
      // Batch 82: 5 zero-violation rules
      'no-multi-assign': 'error',
      'no-restricted-globals': 'error',
      'operator-assignment': 'error',
      'no-useless-catch': 'error',
      'no-unsafe-finally': 'error',
      // Batch 83: 10 zero-violation rules
      'no-label-var': 'error',
      'no-shadow-restricted-names': 'error',
      'no-octal-escape': 'error',
      'no-compare-neg-zero': 'error',
      'no-duplicate-case': 'error',
      'no-empty-character-class': 'error',
      'no-ex-assign': 'error',
      'no-inner-declarations': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      // Batch 84: 9 zero-violation rules
      'no-obj-calls': 'error',
      'no-prototype-builtins': 'error',
      'no-sparse-arrays': 'error',
      'no-template-curly-in-string': 'error',
      'no-unexpected-multiline': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'dot-notation': 'error',
      // Batch 85: 11 zero-violation rules
      'no-constant-condition': 'error',
      'no-constructor-return': 'error',
      'no-new': 'error',
      'no-return-assign': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error',
      'no-unused-labels': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      // Batch 86: 11 zero-violation TypeScript + standard rules
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
      'no-fallthrough': 'error',
      // Batch 87: 11 zero-violation rules
      'no-object-constructor': 'error',
      'no-promise-executor-return': 'error',
      'no-unreachable-loop': 'error',
      'logical-assignment-operators': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-find-dom-node': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      // Batch 88: 11 zero-violation rules
      'react/no-deprecated': 'error',
      'react/no-is-mounted': 'error',
      'react/jsx-key': 'error',
      'no-loss-of-precision': 'error',
      'no-nonoctal-decimal-escape': 'error',
      '@typescript-eslint/no-loss-of-precision': 'error',
      '@typescript-eslint/no-array-constructor': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-else-if': 'error',
      'no-import-assign': 'error',
      'no-setter-return': 'error',
      // Batch 89: 10 zero-violation rules (no-redeclare removed — 9 violations)
      'no-class-assign': 'error',
      'no-const-assign': 'error',
      'no-control-regex': 'error',
      'no-debugger': 'error',
      'no-delete-var': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-func-assign': 'error',
      'no-var': 'error',
      'no-shadow': 'error',
      // Batch 90: 12 zero-violation rules
      'no-alert': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-script-url': 'error',
      'no-self-compare': 'error',
      'symbol-description': 'error',
      'no-extra-label': 'error',
      'no-empty-static-block': 'error',
      'no-new-native-nonconstructor': 'error',
      'yoda': 'error',
      'no-throw-literal': 'error',
      'no-eq-null': 'error',
      // Batch 91: 8 zero-violation rules (require-unicode-regexp 999 violations, no-await-in-loop 11 violations)
      'for-direction': 'error',
      'getter-return': 'error',
      'no-async-promise-executor': 'error',
      'no-misleading-character-class': 'error',
      'no-implicit-globals': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-unsafe-optional-chaining': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      // Batch 92: 6 zero-violation rules (also removed: no-useless-constructor 1v)
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      'no-div-regex': 'error',
      // Batch 93: 9 zero-violation rules (no-import-type-side-effects 48v, no-duplicate-type-constituents 1v, void-dom-elements-no-children 1v)
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/prefer-ts-expect-error': 'error',
      'no-multi-str': 'error',
      'no-unused-private-class-members': 'error',
      'react/no-children-prop': 'error',
      'react/no-namespace': 'error',
      'react/no-typos': 'error',
      'no-constant-binary-expression': 'error',
      // Batch 94: 7 zero-violation rules (also removed: display-name 42v, self-closing-comp 8v)
      'react/no-access-state-in-setstate': 'error',
      'react/no-unused-state': 'error',
      'react/jsx-no-comment-textnodes': 'error',
      'react/no-adjacent-inline-elements': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'error',
      'no-empty': 'error',
      'no-extra-semi': 'error',
      // Batch 95: 8 zero-violation rules (no-empty-function 38v, method-signature-style 7v, jsx-boolean-value 5v)
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/scope': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      'react/prefer-stateless-function': 'error',
      // Batch 96: 6 zero-violation rules (also removed: no-autofocus 1v)
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'no-extra-bind': 'error',
      '@typescript-eslint/no-array-delete': 'error',
      'prefer-arrow-callback': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      // Batch 97: 4 zero-violation rules (also removed: role-supports-aria-props 1v)
      'jsx-a11y/role-has-required-aria-props': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-floating-decimal': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
      // Batch 98: 3 zero-violation rules (removed: react/button-has-type 21v, @typescript-eslint/array-type 14v, @typescript-eslint/consistent-type-definitions 9v, react/jsx-no-useless-fragment 2v, no-multi-spaces 2v, @typescript-eslint/prefer-optional-chain 2v, consistent-indexed-object-style 5v)
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      'no-negated-in-lhs': 'error',
      // Batch 99: 20 zero-violation rules
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      'no-loss-of-precision': 'error',
      'no-unreachable-loop': 'error',
      'no-unsafe-finally': 'error',
      'no-new-symbol': 'error',
      'no-prototype-builtins': 'error',
      'no-template-curly-in-string': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      'no-proto': 'error',
      'no-octal': 'error',
      // Batch 216: 5 zero-violation rules (saved: @typescript-eslint/prefer-optional-chain 0v✓, @typescript-eslint/no-this-alias 0v✓, @typescript-eslint/no-extraneous-class 0v✓ — Batch 217+)
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-dupe-class-members': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      // Batch 215: 5 zero-violation rules (saved: @typescript-eslint/no-wrapper-object-types 0v✓, @typescript-eslint/prefer-as-const 0v✓, @typescript-eslint/no-explicit-any 0v✓ — Batch 216+)
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-loss-of-precision': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      // Batch 214: 5 zero-violation rules (saved: @typescript-eslint/no-require-imports 0v✓, @typescript-eslint/prefer-namespace-keyword 0v✓ — Batch 215+)
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      // Batch 213: 5 zero-violation rules (saved: @typescript-eslint/no-useless-empty-export 0v✓, @typescript-eslint/prefer-enum-initializers 0v✓, @typescript-eslint/prefer-literal-enum-member 0v✓ — Batch 214+)
      '@typescript-eslint/no-invalid-this': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/parameter-properties': 'error',
      // Batch 212: 5 zero-violation rules (saved: @typescript-eslint/no-invalid-this 0v✓ — Batch 213+)
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/no-invalid-void-type': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/ban-tslint-comment': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      // Batch 211: 5 zero-violation rules (saved: @typescript-eslint/no-meaningless-void-operator 0v✓ — Batch 212+)
      '@typescript-eslint/prefer-regexp-exec': 'error',
      '@typescript-eslint/no-unsafe-unary-minus': 'error',
      '@typescript-eslint/class-literal-property-style': 'error',
      '@typescript-eslint/consistent-generic-constructors': 'error',
      '@typescript-eslint/prefer-return-this-type': 'error',
      // Batch 210: 5 zero-violation rules (saved: @typescript-eslint/prefer-regexp-exec 0v✓ — Batch 211+)
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/prefer-find': 'error',
      // Batch 209: 5 zero-violation rules (saved: @typescript-eslint/no-confusing-non-null-assertion 0v✓, @typescript-eslint/no-unnecessary-boolean-literal-compare 0v✓ — Batch 210+)
      '@typescript-eslint/triple-slash-reference': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      // Batch 208: 5 zero-violation rules (saved: @typescript-eslint/triple-slash-reference 0v✓, @typescript-eslint/unified-signatures 0v✓ — Batch 209+)
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      // Batch 207: 5 zero-violation rules (saved: @typescript-eslint/no-non-null-asserted-optional-chain 0v✓, @typescript-eslint/no-require-imports 0v✓ — Batch 208+)
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      // Batch 206: 5 zero-violation rules (saved: @typescript-eslint/prefer-namespace-keyword 0v✓ — Batch 207+)
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      // Batch 205: 5 zero-violation rules (saved: @typescript-eslint/no-mixed-enums 0v✓, @typescript-eslint/no-non-null-asserted-nullish-coalescing 0v✓, @typescript-eslint/no-unnecessary-type-constraint 0v✓, @typescript-eslint/no-unsafe-declaration-merging 0v✓, @typescript-eslint/no-useless-empty-export 0v✓, @typescript-eslint/prefer-namespace-keyword 0v✓ — Batch 206+)
      'no-compare-neg-zero': 'error',
      'no-dupe-else-if': 'error',
      'no-import-assign': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      // Batch 204: 5 zero-violation rules (saved: no-compare-neg-zero 0v✓, no-dupe-else-if 0v✓, no-import-assign 0v✓ — Batch 205+)
      'no-setter-return': 'error',
      'no-sparse-arrays': 'error',
      'for-direction': 'error',
      'getter-return': 'error',
      'no-async-promise-executor': 'error',
      // Batch 203: 5 zero-violation rules (saved: no-setter-return 0v✓, no-sparse-arrays 0v✓ — Batch 204+)
      'no-array-constructor': 'error',
      'no-loss-of-precision': 'error',
      'no-nonoctal-decimal-escape': 'error',
      'no-prototype-builtins': 'error',
      'no-useless-escape': 'error',
      // Batch 202: 5 zero-violation rules (saved: no-array-constructor 0v✓ — Batch 203+)
      'no-unreachable-loop': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-useless-backreference': 'error',
      'array-callback-return': 'error',
      'default-param-last': 'error',
      // Batch 201: 5 zero-violation rules (saved: no-unreachable-loop 0v✓, no-unsafe-optional-chaining 0v✓, no-useless-backreference 0v✓ — Batch 202+)
      'no-shadow-restricted-names': 'error',
      'prefer-object-has-own': 'error',
      'no-extra-semi': 'error',
      'no-regex-spaces': 'error',
      'no-unexpected-multiline': 'error',
      // Batch 200: 5 zero-violation rules (saved: no-shadow-restricted-names 0v✓, prefer-object-has-own 0v✓ — Batch 201+)
      'vars-on-top': 'error',
      'prefer-exponentiation-operator': 'error',
      'no-constant-binary-expression': 'error',
      'no-unused-private-class-members': 'error',
      'no-lonely-if': 'error',
      // Batch 199: 5 zero-violation rules
      'no-object-constructor': 'error',
      'no-restricted-exports': 'error',
      'no-restricted-globals': 'error',
      'no-restricted-properties': 'error',
      'no-unneeded-ternary': 'error',
      // Batch 198: 5 zero-violation rules (saved: no-object-constructor 0v✓ — Batch 199+)
      'no-extra-label': 'error',
      'no-floating-decimal': 'error',
      'no-iterator': 'error',
      'no-label-var': 'error',
      'no-multi-assign': 'error',
      // Batch 197: 5 zero-violation rules (saved: no-extra-label 0v✓, no-floating-decimal 0v✓, no-iterator 0v✓ — Batch 198+)
      'grouped-accessor-pairs': 'error',
      'no-div-regex': 'error',
      'no-else-return': 'error',
      'no-empty-static-block': 'error',
      'no-eq-null': 'error',
      // Batch 196: 5 zero-violation rules
      'no-promise-executor-return': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'accessor-pairs': 'error',
      'default-case-last': 'error',
      // Batch 195: 5 zero-violation rules (saved: no-promise-executor-return 0v✓, no-template-curly-in-string 0v✓, no-unmodified-loop-condition 0v✓ — Batch 196+)
      'prefer-template': 'error',
      'symbol-description': 'error',
      'yoda': 'error',
      'no-alert': 'error',
      'no-constructor-return': 'error',
      // Batch 194: 5 zero-violation rules (saved: prefer-template 0v✓, symbol-description 0v✓, yoda 0v✓ — Batch 195+)
      'object-shorthand': 'error',
      'prefer-numeric-literals': 'error',
      'prefer-object-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      // Batch 193: 5 zero-violation rules (saved: object-shorthand 0v✓, prefer-numeric-literals 0v✓, prefer-object-spread 0v✓ — Batch 194+)
      'no-new-func': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-rename': 'error',
      // Batch 192: 5 zero-violation rules (saved: no-new-func 0v✓, no-return-assign 0v✓ — Batch 193+)
      'prefer-promise-reject-errors': 'error',
      'no-implicit-globals': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-new': 'error',
      // Batch 191: 5 zero-violation rules (saved: prefer-promise-reject-errors 0v✓ — Batch 192+)
      'no-throw-literal': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-warning-comments': 'warn',
      // Batch 190: 5 zero-violation rules (saved: no-throw-literal 0v✓, no-useless-call 0v✓ — Batch 191+)
      'no-multi-str': 'error',
      'no-new-wrappers': 'error',
      'no-proto': 'error',
      'no-script-url': 'error',
      'no-sequences': 'error',
      'no-octal-escape': 'error',
      'no-with': 'error',
      'no-setter-return': 'error',
      // Batch 189: 5 zero-violation rules (saved: no-multi-str 0v✓, no-new-wrappers 0v✓, no-proto 0v✓, no-script-url 0v✓ — Batch 190+)
      '@typescript-eslint/consistent-indexed-object-style': 'error',
      'no-caller': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      // Batch 188: 5 zero-violation rules (saved: consistent-indexed-object-style 0v✓ — Batch 189+; excluded: method-signature-style 50v, require-await 119v, prefer-destructuring 201v)
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      // Batch 187: 5 zero-violation rules (saved: prefer-readonly 0v✓, await-thenable 0v✓ — Batch 188+; excluded: no-redeclare 8v, no-deprecated 134v)
      '@typescript-eslint/typedef': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      // Batch 186: 5 zero-violation rules (saved: typedef 0v✓, prefer-for-of 0v✓ — Batch 187+; excluded: sort-type-constituents 746v, switch-exhaustiveness-check 34v)
      '@typescript-eslint/parameter-properties': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-duplicate-type-constituents': 'error',
      '@typescript-eslint/no-loss-of-precision': 'error',
      '@typescript-eslint/default-param-last': 'error',
      // Batch 185: 5 zero-violation rules (saved: parameter-properties 0v✓, consistent-type-exports 0v✓ — Batch 186+; excluded: no-loop-func 7v)
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/no-dupe-class-members': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
      // Batch 184: 5 zero-violation rules (saved: no-var-requires 0v✓ — Batch 185+; excluded: non-nullable-type-assertion-style 38v)
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      // Batch 183: 5 zero-violation rules (saved from probe 182A)
      '@typescript-eslint/prefer-return-this-type': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/class-literal-property-style': 'error',
      '@typescript-eslint/ban-tslint-comment': 'error',
      '@typescript-eslint/no-shadow': 'error',
      // Batch 182: 5 zero-violation rules (excluded: promise-function-async 504v)
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/consistent-generic-constructors': 'error',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      // Batch 181: 5 zero-violation rules (saved: no-require-imports 0v✓, prefer-namespace-keyword 0v✓, triple-slash-reference 0v✓, no-this-alias 0v✓, consistent-generic-constructors 0v✓ — Batch 182+)
      '@typescript-eslint/no-array-delete': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-invalid-this': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      // Batch 180: 5 zero-violation rules (excluded: no-unnecessary-type-arguments 15v, no-unnecessary-type-assertion 385v)
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      // Batch 179: 5 zero-violation rules (saved: @typescript-eslint/no-unnecessary-boolean-literal-compare 0v✓, @typescript-eslint/unified-signatures 0v✓ — Batch 180)
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-regexp-exec': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/prefer-ts-expect-error': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      // Batch 178: 5 zero-violation rules (saved: @typescript-eslint/prefer-includes 0v✓, @typescript-eslint/prefer-regexp-exec 0v✓ — Batch 179)
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'error',
      '@typescript-eslint/prefer-find': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      // Batch 177: 5 zero-violation rules (excluded: no-confusing-void-expression 2937v, no-import-type-side-effects 102v)
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/no-unsafe-unary-minus': 'error',
      // Batch 176: 5 zero-violation rules (saved: @typescript-eslint/no-mixed-enums 0v✓, @typescript-eslint/no-useless-empty-export 0v✓ — Batch 177)
      'no-promise-executor-return': 'error',
      'no-unreachable-loop': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-invalid-void-type': 'error',
      // Batch 175: 5 zero-violation rules (saved: no-promise-executor-return 0v✓ — Batch 176)
      'no-unsafe-finally': 'error',
      'no-useless-backreference': 'error',
      'no-nonoctal-decimal-escape': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-loss-of-precision': 'error',
      // Batch 174: 5 zero-violation rules (excluded: no-void 84v — saved: no-unsafe-finally 0v✓ — Batch 175)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-global-assign': 'error',
      'no-native-reassign': 'error',
      // Batch 173: 5 zero-violation rules (saved: no-eval 0v✓, no-implied-eval 0v✓ — Batch 174)
      'no-floating-decimal': 'error',
      'no-implicit-globals': 'error',
      'no-labels': 'error',
      'no-extra-label': 'error',
      'no-caller': 'error',
      // Batch 172: 5 zero-violation rules (excluded: no-implicit-coercion 443v — saved: no-floating-decimal 0v✓, no-implicit-globals 0v✓ — Batch 173)
      'no-extend-native': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      'no-constructor-return': 'error',
      'no-label-var': 'error',
      'no-div-regex': 'error',
      // Batch 171: 5 zero-violation rules (saved: no-extend-native 0v✓, no-unsafe-declaration-merging 0v✓, no-constructor-return 0v✓ — Batch 172)
      '@typescript-eslint/prefer-as-const': 'error',
      'no-useless-concat': 'error',
      'no-useless-constructor': 'error',
      'no-proto': 'error',
      'no-iterator': 'error',
      // Batch 170: 5 zero-violation rules (excluded: no-throw-literal already in Batch 163 — saved: prefer-as-const 0v✓, no-useless-concat 0v✓, no-useless-constructor 0v✓ — Batch 171)
      'no-new-wrappers': 'error',
      'no-object-constructor': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      'no-self-compare': 'error',
      // Batch 169: 5 zero-violation rules (saved: no-new-wrappers 0v✓, no-object-constructor 0v✓, no-empty-object-type 0v✓, no-wrapper-object-types 0v✓ — Batch 170)
      'no-sequences': 'error',
      'no-shadow-restricted-names': 'error',
      'no-sparse-arrays': 'error',
      'no-unexpected-multiline': 'error',
      'no-new': 'error',
      // Batch 168: 5 zero-violation rules (excluded: no-console 10v — saved: no-sequences 0v✓, no-shadow-restricted-names 0v✓, no-sparse-arrays 0v✓, no-unexpected-multiline 0v✓ — Batch 169)
      'no-alert': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      'no-lone-blocks': 'error',
      'no-script-url': 'error',
      // Batch 167: 5 zero-violation rules (excluded: no-plusplus 360v, no-continue 111v, no-bitwise 191v, no-param-reassign 21v, prefer-destructuring 201v)
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      'no-useless-escape': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      'no-multi-assign': 'error',
      'no-restricted-syntax': 'error',
      // Batch 166: 5 zero-violation rules (excluded: @typescript-eslint/no-unsafe-enum-comparison 0v✓ — saved Batch 167)
      'yoda': 'error',
      'no-template-curly-in-string': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      'react/jsx-no-target-blank': 'error',
      'no-irregular-whitespace': 'error',
      // Batch 165: 5 zero-violation rules (excluded: yoda 0v✓, no-template-curly-in-string 0v✓, @typescript-eslint/prefer-namespace-keyword 0v✓, react/jsx-no-target-blank 0v✓, no-irregular-whitespace 0v✓, @typescript-eslint/no-unsafe-enum-comparison 0v✓ — saved Batch 166)
      'no-useless-catch': 'error',
      'wrap-iife': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      // Batch 164: 5 zero-violation rules
      'no-extra-bind': 'error',
      'no-useless-rename': 'error',
      'prefer-object-spread': 'error',
      'no-useless-computed-key': 'error',
      'operator-assignment': 'error',
      // Batch 163: 5 zero-violation rules (excluded: no-extra-bind 0v✓, no-useless-rename 0v✓, prefer-object-spread 0v✓, no-useless-computed-key 0v✓, operator-assignment 0v✓ — saved Batch 164)
      'no-return-assign': 'error',
      'no-throw-literal': 'error',
      'prefer-regex-literals': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      // Batch 162: 5 zero-violation rules (excluded: no-return-assign 0v✓, no-throw-literal 0v✓, prefer-regex-literals 0v✓, no-unneeded-ternary 0v✓ — saved Batch 163)
      'jsx-a11y/aria-role': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      '@typescript-eslint/no-array-delete': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      // Batch 161: 5 zero-violation rules (excluded: jsx-a11y/aria-role 0v✓, @typescript-eslint/no-non-null-asserted-nullish-coalescing 0v✓ — saved Batch 162)
      'no-div-regex': 'error',
      'grouped-accessor-pairs': 'error',
      'default-case-last': 'error',
      'jsx-a11y/autocomplete-valid': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      // Batch 160: 5 zero-violation rules (excluded: no-div-regex 0v✓, grouped-accessor-pairs 0v✓, default-case-last 0v✓, jsx-a11y/autocomplete-valid 0v✓, jsx-a11y/aria-proptypes 0v✓ — saved Batch 161)
      'jsx-a11y/aria-props': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-constructor-return': 'error',
      'no-self-compare': 'error',
      // Batch 159: 5 zero-violation rules (excluded: jsx-a11y/aria-props 0v✓, @typescript-eslint/no-duplicate-enum-values 0v✓, @typescript-eslint/no-useless-constructor 0v✓ — saved Batch 160)
      'no-lone-blocks': 'error',
      'react/no-namespace': 'error',
      'react/no-is-mounted': 'error',
      'react/no-unused-class-component-methods': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      // Batch 158: 5 zero-violation rules (excluded: no-lone-blocks 0v✓, react/no-namespace 0v✓, react/no-is-mounted 0v✓, react/no-unused-class-component-methods 0v✓, jsx-a11y/iframe-has-title 0v✓ — saved Batch 159)
      'no-multi-str': 'error',
      'no-extend-native': 'error',
      'no-global-assign': 'error',
      'no-extra-label': 'error',
      'no-label-var': 'error',
      // Batch 157: 5 zero-violation rules (excluded: no-multi-str 0v✓, no-extend-native 0v✓, no-global-assign 0v✓, no-extra-label 0v✓, no-label-var 0v✓ — saved Batch 158)
      'jsx-a11y/mouse-events-have-key-events': 'error',
      'no-caller': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-script-url': 'error',
      // Batch 156: 5 zero-violation rules (excluded: jsx-a11y/mouse-events-have-key-events 0v✓ — saved Batch 157)
      'jsx-a11y/scope': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/no-distracting-elements': 'error',
      // Batch 155: 5 zero-violation rules (excluded: jsx-a11y/scope 0v✓, jsx-a11y/tabindex-no-positive 0v✓ — saved Batch 156; no-abstract-roles invalid rule)
      'jsx-a11y/heading-has-content': 'error',
      'jsx-a11y/html-has-lang': 'error',
      'jsx-a11y/lang': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-aria-hidden-on-focusable': 'error',
      // Batch 154: 5 zero-violation rules (excluded: jsx-a11y/heading-has-content 0v✓ — saved Batch 155; also: prefer-tag-over-role 177v)
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      // Batch 153: 5 zero-violation rules (excluded: jsx-a11y/no-interactive-element-to-noninteractive-role 0v✓ — saved Batch 154; also: jsx-handler-names 204v, jsx-no-bind 3666v, no-noninteractive-element-interactions 55v)
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/parameter-properties': 'error',
      'react/no-multi-comp': 'error',
      'jsx-a11y/media-has-caption': 'error',
      // Batch 152: 5 zero-violation rules (excluded: no-set-state 12v, jsx-sort-props 17658v, jsx-max-depth 9467v, consistent-type-definitions 98v)
      'react/sort-comp': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-did-mount-set-state': 'error',
      'react/no-did-update-set-state': 'error',
      'react/no-will-update-set-state': 'error',
      // Batch 151: 5 zero-violation rules (excluded: react/sort-comp 0v✓ — saved Batch 152; also: no-unstable-nested-components 29v)
      'react/jsx-fragments': 'error',
      'react/no-access-state-in-setstate': 'error',
      'react/no-redundant-should-component-update': 'error',
      'react/no-this-in-sfc': 'error',
      'react/prefer-stateless-function': 'error',
      // Batch 150: 5 zero-violation rules (excluded: react/jsx-fragments 0v✓, react/no-access-state-in-setstate 0v✓, react/no-redundant-should-component-update 0v✓ — saved Batch 151; also: no-array-index-key 206v)
      'jsx-a11y/anchor-is-valid': 'error',
      'react/no-children-prop': 'error',
      'react/jsx-boolean-value': 'error',
      'react/jsx-no-useless-fragment': 'error',
      'react/self-closing-comp': 'error',
      // Batch 149: 5 zero-violation rules (excluded: jsx-a11y/anchor-is-valid 0v✓, react/no-children-prop 0v✓, react/jsx-boolean-value 0v✓ — saved for Batch 150; also: method-signature-style 50v, no-bitwise 191v, no-continue 111v)
      'prefer-numeric-literals': 'error',
      'symbol-description': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      'logical-assignment-operators': 'error',
      'react/no-danger': 'error',
      // Batch 148: 5 zero-violation rules (excluded: prefer-numeric-literals 0v✓, symbol-description 0v✓, @typescript-eslint/no-extraneous-class 0v✓, logical-assignment-operators 0v✓ — saved for next batches)
      'no-iterator': 'error',
      'no-proto': 'error',
      'no-sequences': 'error',
      'prefer-object-has-own': 'error',
      'no-useless-call': 'error',
      // Batch 147: 5 zero-violation rules (excluded: restrict-template-expressions 8v, no-loop-func 7v)
      'no-alert': 'error',
      'no-implied-eval': 'error',
      'no-promise-executor-return': 'error',
      'prefer-exponentiation-operator': 'error',
      'no-useless-concat': 'error',
      // Batch 146: 1 rule (9v auto-fixed; excluded: unbound-method 64v, no-loop-func 7v, restrict-template-expressions 8v, require-await 119v, no-unnecessary-type-assertion 385v, sort-type-constituents 746v, use-unknown-in-catch-callback-variable 18v, no-autofocus 36v, no-noninteractive-tabindex 12v, no-unnecessary-type-parameters 16v, prefer-reduce-type-parameter 10v, no-nested-ternary 709v, jsx-no-constructed-context-values 14v)
      '@typescript-eslint/no-useless-default-assignment': 'error',
      // Batch 145: 4 rules (all zero-violation; excluded: no-useless-default-assignment 9v, no-loop-func 7v, no-unsafe-type-assertion 1535v)
      '@typescript-eslint/return-await': 'error',
      'jsx-a11y/no-aria-hidden-on-focusable': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      // Batch 144: 9 rules (all zero-violation)
      'no-empty-static-block': 'error',
      'no-new-native-nonconstructor': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      'prefer-object-has-own': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      'react/no-danger': 'error',
      'react/prefer-stateless-function': 'error',
      'react/no-access-state-in-setstate': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      // Batch 143: 3 rules (wrap-iife:0v with 'inside' matches Prettier, jsx-a11y/no-noninteractive-element-to-interactive-role:1v, react/require-optimization:5v)
      'wrap-iife': ['error', 'inside'],
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'react/require-optimization': 'error',
      // Batch 142: 7 rules (all zero-violation)
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'error',
      '@typescript-eslint/prefer-find': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      'no-label-var': 'error',
      'no-useless-call': 'error',
      'prefer-exponentiation-operator': 'error',
      // Batch 141: 5 rules (3 zero-violation + 2 with manual fixes — removed: no-redundant-type-constituents 53v, no-base-to-string 58v)
      '@typescript-eslint/unified-signatures': 'error',
      '@typescript-eslint/parameter-properties': 'error',
      'no-new-wrappers': 'error',
      'no-proto': 'error',
      'no-iterator': 'error',
      // Batch 140: 7 rules (all zero-violation)
      'no-lone-blocks': 'error',
      'no-useless-concat': 'error',
      'no-useless-escape': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      // Batch 139: 6 rules (all zero-violation)
      'no-constructor-return': 'error',
      'no-promise-executor-return': 'error',
      'no-unreachable-loop': 'error',
      'no-useless-backreference': 'error',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      // Batch 138: 6 rules (all zero-violation — removed: prefer-named-capture-group 148v)
      'no-implicit-globals': 'error',
      'no-extend-native': 'error',
      'no-multi-assign': 'error',
      'no-sequences': 'error',
      'logical-assignment-operators': 'error',
      '@typescript-eslint/consistent-generic-constructors': 'error',
      // Batch 137: 4 rules (2 zero-violation + 2 with manual fixes)
      'array-callback-return': 'error',
      'prefer-object-has-own': 'error',
      'no-restricted-properties': 'error',
      'no-restricted-imports': 'error',
      // Batch 136: 5 rules (2 zero-violation + 3 with manual fixes)
      'no-undef-init': 'error',
      'vars-on-top': 'error',
      'no-warning-comments': ['error', { terms: ['fixme', 'xxx'], location: 'start' }],
      'max-classes-per-file': 'error',
      'react/no-multi-comp': ['error', { ignoreStateless: true }],
      // Batch 135: 5 rules (2 zero-violation + 3 with manual fixes — removed: no-loop-func 7v, no-autofocus 36v)
      'spaced-comment': ['error', 'always', { markers: ['/'] }],
      'consistent-this': 'error',
      '@typescript-eslint/return-await': 'error',
      'jsx-a11y/no-aria-hidden-on-focusable': 'error',
      'jsx-a11y/no-onchange': 'error',
      // Batch 134: 7 rules (all zero-violation — skipped: react/prefer-stateless-function 0v complex-refactor, react/static-property-placement 0v, @typescript-eslint/no-unnecessary-qualifier 0v, react/prefer-es6-class 0v, react/no-this-in-sfc 0v, no-continue 111v, no-bitwise 191v, no-plusplus 360v, no-void 84v, no-console 10v)
      'react/no-danger': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-did-update-set-state': 'error',
      'react/no-find-dom-node': 'error',
      'react/no-is-mounted': 'error',
      'operator-assignment': 'error',
      'no-alert': 'error',
      // Batch 133: 7 rules (all zero-violation — removed: react/require-optimization 5v, return-await 6v, no-aria-hidden-on-focusable 6v, no-onchange 6v, no-loop-func 7v, no-console 10v, no-void 84v, no-continue 111v, no-bitwise 191v, no-plusplus 360v)
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-shadow': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-string-refs': 'error',
      // Batch 132: 7 rules (5 zero-violation + 2 with manual fixes — removed: return-await 6v, no-aria-hidden-on-focusable 6v, no-onchange 6v, no-loop-func 7v, restrict-template-expressions 8v, no-redeclare 8v, no-useless-default-assignment 9v, prefer-reduce-type-parameter 10v, no-unnecessary-type-arguments 15v, no-dynamic-delete 15v, no-unnecessary-type-parameters 16v, no-object-type-as-default-prop 23v, destructuring-assignment 53v, hook-use-state 31v, jsx-curly-newline 209v, no-unused-prop-types 55v, no-use-before-define 409v, init-declarations 142v, no-confusing-void-expression 2932v, jsx-handler-names 204v, no-array-index-key 206v, jsx-no-leaked-render 2013v, no-unnecessary-type-conversion 182v)
      'react/jsx-props-no-multi-spaces': 'error',
      'react/jsx-wrap-multilines': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'jsx-a11y/media-has-caption': 'error',
      'react/sort-comp': 'error',
      // Batch 131: 7 rules (5 zero-violation + 2 auto-fix — removed: return-await 6v, no-aria-hidden-on-focusable 6v, no-loop-func 7v, restrict-template-expressions 8v, no-useless-default-assignment 9v, prefer-reduce-type-parameter 10v, no-unnecessary-type-parameters 16v, switch-exhaustiveness-check 34v, no-base-to-string 58v, display-name 61v, no-unsafe-return 106v, no-unnecessary-type-conversion 182v, prefer-destructuring 201v, no-floating-promises 588v, strict-void-return 920v, no-unnecessary-condition 2223v)
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      'react/jsx-curly-spacing': 'error',
      'react/jsx-first-prop-new-line': 'error',
      'react/jsx-closing-bracket-location': 'error',
      '@typescript-eslint/consistent-indexed-object-style': 'error',
      // Batch 130: 7 rules (2 zero-violation + 5 with manual fixes — removed: return-await 6v, no-invalid-void-type 5v→2v with allowInGenericTypeArguments, array-type 212v, consistent-type-definitions 98v, no-unnecessary-type-arguments 16v, no-noninteractive-element-interactions 54v, label-has-associated-control 63v, no-array-index-key 206v, no-param-reassign 21v, no-unsafe-return 106v, switch-exhaustiveness-check 34v, no-base-to-string 58v, promise-function-async 504v, prefer-reduce-type-parameter 10v, consistent-return 132v, no-multi-comp 620v, no-aria-hidden-on-focusable 6v, prefer-readonly 2v—FIXED, require-array-sort-compare 1v—FIXED)
      'jsx-a11y/anchor-is-valid': 'error',
      'react/jsx-fragments': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      'react/jsx-closing-tag-location': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      '@typescript-eslint/no-invalid-void-type': ['error', { allowInGenericTypeArguments: true }],
      // Batch 129: 5 rules (1 zero-violation + 4 with manual fixes — removed: return-await 6v, no-onchange 6v, no-redeclare 8v, no-object-type-as-default-prop 23v, accessible-emoji 88v, no-empty-function 112v, prefer-tag-over-role 178v)
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      'react/iframe-missing-sandbox': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      // Batch 128: 9 rules (1 zero-violation + 8 with ≤2 fixes each — removed: consistent-indexed-object-style 6v, no-useless-default-assignment 9v, jsx-no-constructed-context-values 14v, no-unnecessary-type-parameters 16v, no-unstable-nested-components 29v, non-nullable-type-assertion-style 38v, method-signature-style 50v, no-unnecessary-type-conversion 182v)
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-duplicate-type-constituents': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      'react/no-unknown-property': ['error', { ignore: ['cmdk-input-wrapper'] }],
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/heading-has-content': 'error',
      // Batch 127: 4 zero-violation rules + 1 rule with 1 fix (removed: no-implicit-coercion 443v, no-negated-condition 289v, jsx-a11y/no-autofocus 36v)
      'react/void-dom-elements-no-children': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/no-array-delete': 'error',
      '@typescript-eslint/no-unsafe-unary-minus': 'error',
      // Batch 126: 3 zero-violation rules + 1 rule with 5 auto-fixes (removed: no-unnecessary-type-arguments 16v, no-deprecated 134v, no-import-type-side-effects 102v)
      '@typescript-eslint/consistent-generic-constructors': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-rename': 'error',
      'prefer-object-spread': 'error',
      // Batch 125: 3 rules with 1 fix each (removed: no-unnecessary-type-assertion 388v, no-confusing-void-expression 2935v, require-await 119v, no-dynamic-delete 15v)
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      // Batch 124: 3 auto-fixable rules (removed: no-base-to-string manual, no-redundant-type-constituents Radix UI patterns, switch-exhaustiveness-check manual, prefer-nullish-coalescing many, no-unnecessary-condition many)
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-regexp-exec': 'error',
      // Batch 123: 6 zero-violation rules (removed: no-misused-promises many, button-has-type many, no-unescaped-entities many, no-import-type-side-effects 2v+, no-noninteractive-tabindex intentional a11y patterns, no-noninteractive-element-to-interactive-role intentional a11y patterns)
      'react/jsx-boolean-value': 'error',
      'react/self-closing-comp': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      // Batch 119: 3 zero-violation rules (removed: jsx-newline many, forbid-component-props many, jsx-max-props-per-line many, jsx-closing-tag-location 3v)
      'react/jsx-equals-spacing': 'error',
      'react/jsx-tag-spacing': 'error',
      'react/forbid-elements': 'error',
      // Batch 118: 6 zero-violation rules (removed: no-unsafe-member-access many, method-signature-style many, destructuring-assignment many, jsx-child-element-spacing many, jsx-props-no-multi-spaces 1v, jsx-boolean-value 5v)
      'constructor-super': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-sort-default-props': 'error',
      'react/sort-prop-types': 'error',
      'react/prefer-exact-props': 'error',
      'react/forbid-dom-props': 'error',
      // Batch 117: 6 zero-violation rules (removed: no-unassigned-vars was NEW ✓, no-useless-assignment many, preserve-caught-error 1v, no-redundant-type-constituents many, consistent-this 1v, role-supports-aria-props 1v, void-dom-elements-no-children 1v, prefer-tag-over-role many, no-aria-hidden-on-focusable 2v, no-unnecessary-boolean-literal-compare 2v, consistent-type-exports many, class-methods-use-this 6v, prefer-readonly 3v, no-onchange 4v, iframe-has-title 1v, use-unknown-in-catch-callback-variable many, no-unsafe-enum-comparison 1v)
      'no-unassigned-vars': 'error',
      'react/no-invalid-html-attribute': 'error',
      'react/forward-ref-uses-ref': 'error',
      'react/forbid-foreign-prop-types': 'error',
      'react/jsx-filename-extension': ['error', { extensions: ['.tsx', '.jsx'] }],
      'react/jsx-uses-vars': 'error',
      // Batch 116: 4 zero-violation rules (removed: multiline-comment-style many, new-cap many, no-inline-comments many, no-mixed-operators many, prefer-named-capture-group many, no-continue many, no-negated-condition many, no-underscore-dangle many, sort-vars many, spaced-comment 1v, jsx-fragments many, no-noninteractive-element-interactions many, no-noninteractive-element-to-interactive-role many, etc.)
      'block-scoped-var': 'error',
      'func-name-matching': 'error',
      'react/boolean-prop-naming': 'error',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
      // Batch 115: 5 zero-violation rules (removed: parameter-properties many, prefer-function-type many, prefer-object-has-own many, no-unused-prop-types many, require-atomic-updates many, sort-type-constituents many, no-loop-func 1v, require-optimization 1v, vars-on-top 1v)
      '@typescript-eslint/default-param-last': 'error',
      'react/require-render-return': 'error',
      'react/default-props-match-prop-types': 'error',
      'react/state-in-constructor': 'error',
      'react/static-property-placement': 'error',
      // Batch 114: 4 zero-violation rules (removed: no-redeclare 1v, no-var-requires 1v, prefer-promise-reject-errors many, prefer-regexp-exec many, return-await 1v)
      '@typescript-eslint/no-misused-spread': 'error',
      '@typescript-eslint/related-getter-setter-pairs': 'error',
      '@typescript-eslint/no-dupe-class-members': 'error',
      '@typescript-eslint/no-invalid-this': 'error',
      // Batch 113: 7 zero-violation rules (removed: prefer-nullish-coalescing many, prefer-optional-chain 1v, prefer-for-of 1v, consistent-generic-constructors 1v, no-unnecessary-type-conversion many, no-useless-default-assignment many, no-unnecessary-type-parameters many, jsx-a11y rule-set many, react/button-has-type many, react/no-multi-comp many, etc.)
      'jsx-a11y/anchor-ambiguous-text': 'error',
      'react/no-unused-class-component-methods': 'error',
      'react/jsx-props-no-spread-multi': 'error',
      'require-yield': 'error',
      '@typescript-eslint/ban-tslint-comment': 'error',
      '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
      '@typescript-eslint/no-unused-private-class-members': 'error',
      // Batch 112: 4 zero-violation rules (removed: react/no-unescaped-entities many, react/no-unstable-nested-components many, unicode-bom many, no-undef-init 1v, plus many duplicates from earlier batches)
      'react/prefer-es6-class': 'error',
      '@typescript-eslint/no-unsafe-unary-minus': 'error',
      'no-cond-assign': 'error',
      'no-this-before-super': 'error',
      // Batch 111: 6 zero-violation rules (removed: no-void 9v+, no-unnecessary-type-arguments many, no-unnecessary-template-expression 3v)
      'react/no-adjacent-inline-elements': 'error',
      'react/no-arrow-function-lifecycle': 'error',
      'react/no-typos': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      'no-nonoctal-decimal-escape': 'error',
      'jsx-a11y/html-has-lang': 'error',
      // Batch 110: 7 zero-violation rules (removed: no-set-state 11v, no-noninteractive-tabindex 9v, alt-text 1v)
      'react/no-did-mount-set-state': 'error',
      'react/no-did-update-set-state': 'error',
      'react/no-unsafe': 'error',
      'react/style-prop-object': 'error',
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'no-empty': 'error',
      'no-constant-condition': 'error',
      // Batch 109: 8 zero-violation rules (removed: no-plusplus massive, jsx-pascal-case 15v, no-redundant-roles 2v)
      'no-caller': 'error',
      'no-case-declarations': 'error',
      'react/jsx-no-script-url': 'error',
      'react/no-namespace': 'error',
      'jsx-a11y/lang': 'error',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/scope': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      // Batch 108: 7 zero-violation rules (removed: radix 16v, no-dynamic-delete many, wrap-iife 2v, heading-has-content 2v)
      'jsx-a11y/aria-role': 'error',
      'no-extra-label': 'error',
      'react/jsx-no-undef': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      'react/no-access-state-in-setstate': 'error',
      'react/no-redundant-should-component-update': 'error',
      'react/no-this-in-sfc': 'error',
      // Batch 107: 5 zero-violation rules (removed: camelcase massive, no-confusing-void-expression 55v, no-redundant-type-constituents 18v+, no-unnecessary-type-assertion many, consistent-return 3v, no-base-to-string 3v, prefer-regexp-exec 24v, prefer-for-of 1v)
      'no-useless-backreference': 'error',
      'no-constant-binary-expression': 'error',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      'no-implicit-globals': 'error',
      // Batch 106: 7 zero-violation rules (removed: no-extra-parens 50v, consistent-generic-constructors 1v, no-unnecessary-boolean-literal-compare 1v)
      '@typescript-eslint/dot-notation': 'error',
      'prefer-template': 'error',
      'accessor-pairs': 'error',
      'no-iterator': 'error',
      'no-label-var': 'error',
      'no-unused-labels': 'error',
      'no-restricted-syntax': 'error',
      // Batch 105: 11 zero-violation rules (removed: react/jsx-handler-names 38v, react/jsx-no-constructed-context-values 7v, no-implicit-coercion 3v, jsx-a11y/media-has-caption 2v)
      '@typescript-eslint/no-unsafe-unary-minus': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/class-literal-property-style': 'error',
      '@typescript-eslint/prefer-return-this-type': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      'operator-assignment': 'error',
      'object-shorthand': 'error',
      'no-else-return': 'error',
      'no-unused-expressions': 'error',
      'react/no-danger': 'error',
      // Batch 104: 3 zero-violation rules (removed: jsx-no-leaked-render 28v, no-bitwise 12v, control-has-associated-label 23v, switch-exhaustiveness-check 13v, react/hook-use-state 8v, react/no-multi-comp 3v, no-unnecessary-type-parameters 3v, prefer-reduce-type-parameter 2v, no-nested-ternary 2v, no-unnecessary-template-expression 1v, promise-function-async 5v, require-array-sort-compare 1v)
      '@typescript-eslint/prefer-find': 'error',
      'jsx-a11y/autocomplete-valid': 'error',
      'no-restricted-globals': 'error',
      // Batch 103: 8 zero-violation rules (removed: click-events-have-key-events 16v, no-static-element-interactions 15v, label-has-associated-control 14v, react/no-unstable-nested-components 4v, react/iframe-missing-sandbox 1v, array-callback-return 1v, anchor-has-content 1v, react/sort-comp 1v, interactive-supports-focus 1v)
      'no-promise-executor-return': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      'react/checked-requires-onchange-or-readonly': 'error',
      'react/jsx-curly-brace-presence': 'error',
      'react/no-will-update-set-state': 'error',
      'jsx-a11y/mouse-events-have-key-events': 'error',
      // Batch 102: 6 zero-violation rules (removed: react/no-array-index-key 21v, jsx-a11y/prefer-tag-over-role 16v, no-void 9v, no-return-await 1v, no-param-reassign 1v, jsx-a11y/no-aria-hidden-on-focusable 1v, @typescript-eslint/no-invalid-void-type 1v, only-throw-error 1v, react/no-object-type-as-default-prop 1v, react/void-dom-elements-no-children 1v)
      'no-implied-eval': 'error',
      'no-new': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-target-blank': 'error',
      // Batch 101: 18 zero-violation rules (removed: no-redundant-type-constituents 18v, react/no-unknown-property 1v)
      'no-compare-neg-zero': 'error',
      'no-duplicate-case': 'error',
      'no-empty-character-class': 'error',
      'no-ex-assign': 'error',
      'no-empty-pattern': 'error',
      'no-sequences': 'error',
      'no-cond-assign': 'error',
      'no-return-assign': 'error',
      'no-new-object': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-find-dom-node': 'error',
      'react/no-is-mounted': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      'prefer-regex-literals': 'error',
      // Batch 100: 19 zero-violation rules (removed: no-undef-init 2v)
      'no-sparse-arrays': 'error',
      'no-obj-calls': 'error',
      'no-inner-declarations': 'error',
      'no-irregular-whitespace': 'error',
      'no-unexpected-multiline': 'error',
      'no-unreachable': 'error',
      'no-unsafe-negation': 'error',
      'no-invalid-regexp': 'error',
      'no-dupe-else-if': 'error',
      'no-import-assign': 'error',
      'no-constructor-return': 'error',
      'no-fallthrough': 'error',
      'no-regex-spaces': 'error',
      'no-shadow-restricted-names': 'error',
      'no-multi-assign': 'error',
      'no-global-assign': 'error',
      'no-extend-native': 'error',
      'no-eval': 'error',
      '@typescript-eslint/no-this-alias': 'error',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  // src/**/__tests__/** e src/**/*.test.* — testes unitários dentro de src/
  // Relaxa regras de produção (idem ao bloco tests/**)
  // ──────────────────────────────────────────────────────────────────────
  {
    files: [
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'src/tests/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',

      // ──────────────────────────────────────────────────────────────
      // T-FIX-5 (follow-up de T-FIX-4 + bug do "Rose Quartz visível,
      // 3 idênticos escondidos" no CI run 26303752735).
      //
      // Anti-padrão A: forEach() declarando casos de teste
      //   data.forEach(item => it(item.name, () => { ... }))
      //
      // Funciona no Vitest (cada it() é registrado individualmente),
      // mas é menos idiomático que it.each / describe.each, e variações
      // próximas (forEach com asserts dentro de it) MASCARAM falhas:
      // a primeira asserção falha aborta o forEach silenciosamente,
      // escondendo todas as iterações seguintes. Foi assim que 3 bugs
      // de contraste WCAG idênticos a Rose Quartz (Hackerman, Frutti di
      // Mare, Razer) ficaram invisíveis no CI até o T-FIX-4.
      //
      // Preferir it.each() / test.each() / describe.each(), que registram
      // cada caso como teste isolado — todas as falhas surfaceiam na
      // mesma execução.
      //
      // Documentação completa: docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md
      // ──────────────────────────────────────────────────────────────
      //
      // T-FIX-5b: Anti-padrão B — forEach() com expect() dentro de it()
      // Array vazio → nenhuma asserção roda → teste verde falso.
      // Correção: adicione expect(array).not.toHaveLength(0) antes do forEach.
      // ──────────────────────────────────────────────────────────────
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='forEach'] CallExpression[callee.name=/^(it|test|describe)$/]",
          message:
            'Anti-padrão T-FIX-4: forEach() declarando it()/test()/describe() — use it.each(), test.each() ou describe.each() para registrar cada caso como teste isolado e evitar que falhas mascarem umas às outras. Veja docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md',
        },
        {
          selector:
            "CallExpression[callee.property.name='forEach']:has(CallExpression[callee.name='expect'])",
          message:
            'Anti-padrão T-FIX-5b: forEach() com expect() — array vazio faz o teste passar silenciosamente. Adicione expect(array).not.toHaveLength(0) antes do forEach, ou use it.each() para expor cada caso como teste isolado. Veja docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md',
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  // e2e/** — Playwright specs (Node + browser globais via Playwright)
  // ──────────────────────────────────────────────────────────────────────
  {
    files: ['e2e/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: tsParserOptions,
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { '@typescript-eslint': typescript },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      // E2E tem fixtures, helpers e selectors — relaxar regras de produção:
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'no-empty-pattern': 'off', // Playwright fixtures: ({}, testInfo) => ...
    },
  },

  // Guard-rails de anti-flake — proíbe padrões conhecidos por causar
  // instabilidade nas specs E2E. Helpers (e2e/helpers/**) podem usar.
  {
    files: ['e2e/**/*.spec.{ts,tsx}'],
    rules: {
      // Severity 'warn' nesta primeira fase — promova para 'error' após
      // migrar todas as ~17 specs legadas (auditoria via:
      // `rg "page\.goto|waitForTimeout|networkidle" e2e/**/*.spec.ts`).
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            'Proibido `page.waitForTimeout(...)` em specs — use `waitForTestIdHidden`, `waitForTestIdVisible`, `pollUntil` ou `waitForRouteIdle` (e2e/helpers/waits.ts | nav.ts).',
        },
        {
          selector: "Literal[value='networkidle']",
          message:
            'Proibido `networkidle` em specs — use `waitForRouteIdle(page)` ou esperas por testid de estado terminal (e2e/helpers/nav.ts).',
        },
        {
          selector: "MemberExpression[object.name='page'][property.name='goto']",
          message:
            'Proibido `page.goto(...)` direto em specs — use `gotoAndSettle(page, path)` ou `loginAs(page)` (e2e/helpers/nav.ts | auth.ts).',
        },
        {
          // page.fill(<sel>, "literal-sem-prefixo-E2E")
          // Detecta literais que NÃO começam com "[E2E" (cobre "[E2E]" global e "[E2E:slug]" escopado).
          selector: "CallExpression[callee.property.name='fill'] > Literal[value=/^(?!\\[E2E).+/]",
          message:
            'Proibido `.fill("literal")` em campos de specs — use `resources.createX()` (fixture) ou `e2eName(label, { prefix })` para garantir cleanup escopado por spec.',
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  // tests/** — Vitest (unit + integration). Globals = vitest + node + browser.
  // ──────────────────────────────────────────────────────────────────────
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: tsParserOptions,
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@typescript-eslint': typescript,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      // Tests podem usar mocks/stubs com nomes não convencionais
      '@typescript-eslint/naming-convention': 'off',

      // T-FIX-5: mesmo guard de src/ — aplicado também em tests/** para
      // cobertura completa. Veja docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md
      //
      // T-FIX-5b: Anti-padrão B — forEach() com expect() dentro de it()
      // Array vazio → nenhuma asserção roda → teste verde falso.
      // Correção: adicione expect(array).not.toHaveLength(0) antes do forEach.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='forEach'] CallExpression[callee.name=/^(it|test|describe)$/]",
          message:
            'Anti-padrão T-FIX-4: forEach() declarando it()/test()/describe() — use it.each(), test.each() ou describe.each() para registrar cada caso como teste isolado e evitar que falhas mascarem umas às outras. Veja docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md',
        },
        {
          selector:
            "CallExpression[callee.property.name='forEach']:has(CallExpression[callee.name='expect'])",
          message:
            'Anti-padrão T-FIX-5b: forEach() com expect() — array vazio faz o teste passar silenciosamente. Adicione expect(array).not.toHaveLength(0) antes do forEach, ou use it.each() para expor cada caso como teste isolado. Veja docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md',
        },
      ],
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  // scripts/** — utilitários CLI Node (.mjs/.ts). Sem TS project para .mjs.
  // ──────────────────────────────────────────────────────────────────────
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: tsParserOptions,
      globals: globals.node,
    },
    plugins: { '@typescript-eslint': typescript },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      // Scripts .mjs não passam pelo parser TS — globals Node + parser default.
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];