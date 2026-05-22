# T-FIX-5 — Lint Guard-rail contra `forEach()` em Testes

**Data**: 2026-05-22
**Origem**: bug "Rose Quartz visível, 3 idênticos escondidos" (CI run [26303752735](https://github.com/adm01-debug/promo-gifts-v4/actions/runs/26303752735))
**Predecessor**: T-FIX-4 (refactor de 5 arquivos de teste, commits b9a51be, 5b2a7ca, 21bb9b8, 6dc8604, a2c3fa2)

## TL;DR

O bug do T-FIX-4 mostrou que um `forEach()` em teste paramétrico pode esconder bugs idênticos atrás da primeira falha. O T-FIX-5 **codifica em automação** esse aprendizado adicionando uma regra `no-restricted-syntax` no ESLint que bloqueia o anti-padrão em PR review. **Custo**: 1 regra. **Benefício**: o bug nunca mais consegue passar pela revisão humana porque é bloqueado mecanicamente.

## O problema (revisão)

Antes do T-FIX-4, o teste de contraste WCAG estava escrito assim:

```ts
it('should maintain WCAG contrast ratios for key text elements', () => {
  THEME_PRESETS.forEach(preset => {
    // ... 6 expects por preset (light/dark × bg/card/primary)
    expect(primaryContrast).toBeGreaterThanOrEqual(3);
  });
});
```

Quando `gx-rose-quartz` falhou o `primaryContrast >= 3`, o `forEach` foi abortado e os 3 presets seguintes com bugs idênticos (`gx-hackerman`, `gx-frutti-di-mare`, `gx-razer`) **nunca foram testados** naquela execução. Resultado: CI marcou apenas Rose Quartz como falha; merge ocorreu; 3 outros bugs ficaram em produção até alguém abrir o app em outro preset.

## Os 2 anti-padrões

Existem duas formas relacionadas do problema, e o T-FIX-5 cobre apenas a primeira:

### Anti-padrão A — `forEach()` declarando casos de teste

```ts
// ❌ Proibido pela regra T-FIX-5
data.forEach(item => {
  it(`case for ${item.name}`, () => {
    expect(...);
  });
});
```

**Por que é problema**: Embora cada `it()` seja registrado individualmente no Vitest (e portanto não mascara falhas entre testes), é menos idiomático e produz labels de teste menos limpos no reporter. Mais importante, dá ao leitor uma sensação errada de "estamos iterando dentro de um teste" — o que é exatamente o que **falsamente** parece estar acontecendo no anti-padrão B abaixo.

**Padrão correto**:

```ts
// ✅ Idiomático Vitest
it.each(data)('case for $name', (item) => {
  expect(...);
});
```

### Anti-padrão B — `forEach()` com asserts dentro de um único `it()`

```ts
// ❌ MASCARA falhas — este foi o bug do Rose Quartz
it('all presets pass WCAG', () => {
  data.forEach(item => {
    expect(item.contrast).toBeGreaterThanOrEqual(3); // ⚠️ aborta forEach no 1º fail
  });
});
```

**Por que é problema crítico**: a primeira asserção falha lança uma exceção que **aborta o forEach silenciosamente**. Todas as iterações seguintes (potencialmente com outros bugs) não rodam. Foi exatamente assim que 3 bugs idênticos a Rose Quartz ficaram invisíveis.

**Padrão correto**:

```ts
// ✅ Cada caso é teste isolado, falhas surfaceiam todas juntas
it.each(data)('preset $name passes WCAG', (item) => {
  expect(item.contrast).toBeGreaterThanOrEqual(3);
});

// ✅ Alternativa: dentro de um único caso, usar expect.soft para
//    coletar TODAS as dimensões falhas (não bailar na primeira)
it.each(data)('preset $name', (item) => {
  expect.soft(item.lightContrast).toBeGreaterThanOrEqual(3);
  expect.soft(item.darkContrast).toBeGreaterThanOrEqual(3);
});
```

## A regra implementada (Fase 1 — Anti-padrão A)

No `eslint.config.js`, aplicada aos blocos `src/**/__tests__/**`, `src/**/*.test.*`, `src/**/*.spec.*`, `src/tests/**` e `tests/**`:

```js
'no-restricted-syntax': [
  'error',
  {
    selector:
      "CallExpression[callee.property.name='forEach'] " +
      "CallExpression[callee.name=/^(it|test|describe)$/]",
    message: 'Anti-padrão T-FIX-4: ...',
  },
],
```

### Por que `error` e não `warn`?

Auditei o repo inteiro antes de promover. Resultado da simulação do seletor contra todos os arquivos `*.test.*` / `*.spec.*` / `__tests__/**`:

| Arquivo | Estado pós-T-FIX-4 | Match do seletor? |
|---------|---------------------|-------------------|
| `theme-presets.test.ts` | `it.each` | ❌ |
| `auth-utils.test.ts` | `it.each` | ❌ |
| `AdminStandardRules.test.tsx` | `describe.each` | ❌ |
| `PriceFreshnessBadge.snapshots.test.tsx` | `it.each` (tuple + %s) | ❌ |
| `SidebarMobileRegression.test.ts` | `it.each` (corpo) + `forEach` utility (sem `it` dentro) | ❌ |
| `AuthBranding.visual.test.tsx` | `forEach(card => expect(...))` dentro de `it` | ❌ (sem `it/test/describe` dentro do forEach) |
| `QuoteBuilderStepper.test.tsx` | `forEach((l) => expect(...))` dentro de `it` | ❌ |
| `SidebarNavGroup.shortcut-carrinhos.test.tsx` | `forEach` em handler builder (código de produção copy) | ❌ |

**0 falsos positivos** → `error` é seguro.

### Mesmo padrão arquitetural do projeto

O bloco `e2e/**/*.spec.*` já usa `no-restricted-syntax` para guardar contra anti-flake (`page.waitForTimeout`, `networkidle`, `page.goto` direto). O T-FIX-5 segue o mesmo modelo, agora aplicado a testes unitários.

## Fora deste escopo (Fase 2 — T-FIX-5b futuro)

### Anti-padrão B com `eslint-disable` cirúrgico

Detectar o anti-padrão B precisa de um seletor que pesque `expect()` dentro de `forEach()` dentro de `it()/test()`:

```js
{
  selector:
    "CallExpression[callee.name=/^(it|test)$/] " +
    "CallExpression[callee.property.name='forEach'] " +
    "CallExpression[callee.name='expect']",
  message: '...',
},
```

Este seletor **tem 2 falsos positivos conhecidos** no repo atual que precisam ser tratados antes:

1. `src/pages/auth/AuthBranding.visual.test.tsx:62` — `cards.forEach(card => expect(card.className).toContain(...))` sobre N cards do mesmo render. Refatorar para `it.each` exigiria N renders separados (custo alto, masking limitado a 1 render).

2. `src/components/quotes/__tests__/QuoteBuilderStepper.test.tsx:44` — `labels.forEach((l) => expect(screen.getByText(l)).toBeDefined())` sobre 5 labels. Custo-benefício baixo.

**Opções para T-FIX-5b**:

- **Opção A** — adicionar `eslint-disable-next-line no-restricted-syntax` cirurgicamente nos 2 pontos, com comentário justificando o motivo (mantém regra como error, exceções explícitas).
- **Opção B** — refatorar os 2 pontos para `it.each` (mais trabalho, mais consistente).
- **Opção C** — manter o anti-padrão B como `warn` em vez de `error` (depende do contador de warnings no `lint:check`).

Decisão de qual opção aplicar fica para a próxima sessão.

### Outros itens fora do escopo

- `QuoteBuilderStepper.test.tsx:68` — `icons.forEach(icon => {})` vazio (sem asserts). Bug separado.
- Migração de testes legados se houver — auditoria adicional necessária.

## Como verificar a regra funciona

```bash
# Cria um arquivo de teste que viola a regra
cat > /tmp/test-violation.test.ts <<'EOF'
import { it, expect } from 'vitest';
const cases = [1, 2, 3];
cases.forEach(c => {
  it(`case ${c}`, () => {
    expect(c).toBeGreaterThan(0);
  });
});
EOF

# Copia para src/ e roda lint
cp /tmp/test-violation.test.ts src/tests/_temp-violation.test.ts
npm run lint:check
# Esperado: erro `no-restricted-syntax` apontando para a linha do forEach
rm src/tests/_temp-violation.test.ts
```

## Referências

- Commit T-FIX-4 motivador: [c7b74a2](https://github.com/adm01-debug/promo-gifts-v4/commit/c7b74a2) (fix WCAG)
- Commits T-FIX-4 refactor: [b9a51be](https://github.com/adm01-debug/promo-gifts-v4/commit/b9a51be), [5b2a7ca](https://github.com/adm01-debug/promo-gifts-v4/commit/5b2a7ca), [21bb9b8](https://github.com/adm01-debug/promo-gifts-v4/commit/21bb9b8), [6dc8604](https://github.com/adm01-debug/promo-gifts-v4/commit/6dc8604), [a2c3fa2](https://github.com/adm01-debug/promo-gifts-v4/commit/a2c3fa2)
- CI run que revelou o bug: [26303752735](https://github.com/adm01-debug/promo-gifts-v4/actions/runs/26303752735)
- ESLint `no-restricted-syntax` docs: <https://eslint.org/docs/latest/rules/no-restricted-syntax>
- ESLint AST selectors: <https://eslint.org/docs/latest/extend/selectors>
- Vitest `it.each` / `describe.each`: <https://vitest.dev/api/#test-each>
- Vitest `expect.soft`: <https://vitest.dev/api/expect.html#soft>
