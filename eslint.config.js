import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';


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
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { allowDefaultCaseForExhaustiveSwitch: true }],
      '@typescript-eslint/consistent-generic-constructors': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      'prefer-template': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/method-signature-style': 'error',
      '@typescript-eslint/prefer-regexp-exec': 'error',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/consistent-indexed-object-style': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/no-dynamic-delete': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
      '@typescript-eslint/class-literal-property-style': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/prefer-ts-expect-error': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      // Batch 49: async safety rules
      '@typescript-eslint/return-await': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      // Batch 50: zero-violation strengthening + loop/class rules
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-loss-of-precision': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/no-dupe-class-members': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/no-unsafe-unary-minus': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/prefer-return-this-type': 'error',
      '@typescript-eslint/no-loop-func': 'error',
      '@typescript-eslint/parameter-properties': 'error',
      // Batch 51: type safety + style rules
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/no-unnecessary-template-expression': 'error',
      '@typescript-eslint/prefer-find': 'error',
      '@typescript-eslint/consistent-generic-constructors': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/no-invalid-void-type': 'error',
      // Batch 52: generic/array/enum rules
      '@typescript-eslint/prefer-regexp-exec': 'error',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/consistent-indexed-object-style': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/no-duplicate-type-constituents': 'error',
      '@typescript-eslint/no-unnecessary-type-parameters': 'error',
      // Batch 53: null safety + type purity rules
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      '@typescript-eslint/no-array-delete': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      // Batch 54: template/operator safety + ts-comment rules (8 fixes + 3 zero-violation rules)
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      // Batch 56-59: base ESLint error-prevention rules (7 genuinely new, non-recommended)
      'no-constant-binary-expression': 'error',
      'no-extra-bind': 'error',
      'no-sequences': 'error',
      'no-self-compare': 'error',
      'use-isnan': 'error',
      'no-object-constructor': 'error',
      'no-unexpected-multiline': 'error',
      // Batch 59: no-shadow — rename inner-scope variables to prevent shadowing (36 code fixes across 25 files)
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      // Batch 55: 30 zero-violation base ESLint rules (safety + best practices + cleanliness)
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-with': 'error',
      'no-constructor-return': 'error',
      'no-unreachable-loop': 'error',
      'no-useless-backreference': 'error',
      'no-template-curly-in-string': 'error',
      'no-octal-escape': 'error',
      'no-nonoctal-decimal-escape': 'error',
      'no-setter-return': 'error',
      'no-new-wrappers': 'error',
      'no-prototype-builtins': 'error',
      'no-new': 'error',
      'no-new-object': 'error',
      'symbol-description': 'error',
      'no-var': 'error',
      'no-useless-rename': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-catch': 'error',
      'no-useless-return': 'error',
      'no-extra-boolean-cast': 'error',
      'no-regex-spaces': 'error',
      'grouped-accessor-pairs': ['error', 'getBeforeSet'],
      'prefer-numeric-literals': 'error',
      'prefer-object-has-own': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'radix': 'error',
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
      'no-else-return': 'warn',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-else-return': ['error', { allowElseIf: true }],
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
      yoda: ['error', 'never'],
      'dot-notation': 'error',

      // Quality guardrails — crystallised from Batches 33-39
      'object-shorthand': ['error', 'always'],
      'no-return-assign': ['error', 'except-parens'],
      'no-promise-executor-return': 'error',
      'prefer-exponentiation-operator': 'error',
      'default-case': ['error', { commentPattern: '^no default$' }],
      'operator-assignment': ['error', 'always'],
      'no-implicit-coercion': ['error', { boolean: false, number: true, string: true }],

      // React
      'react/no-danger': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
