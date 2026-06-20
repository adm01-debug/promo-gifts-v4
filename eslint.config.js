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
      'jsx-a11y/anchor-is-valid': 'warn',
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
