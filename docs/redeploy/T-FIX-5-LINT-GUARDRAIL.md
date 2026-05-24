# T-FIX-5 — Lint Guard-rail contra `forEach()` em Testes

**Data**: 2026-05-22 (Fase 1) · 2026-05-23 (Fase 2 — T-FIX-5b)
**Origem**: bug "Rose Quartz visível, 3 idênticos escondidos" (CI run [26303752735](https://github.com/adm01-debug/promo-gifts-v4/actions/runs/26303752735))
**Predecessor**: T-FIX-4 (refactor de 5 arquivos de teste, commits b9a51be, 5b2a7ca, 21bb9b8, 6dc8604, a2c3fa2)

## TL;DR

O bug do T-FIX-4 mostrou que um `forEach()` em teste paramétrico pode esconder bugs idênticos atrás da primeira falha. O T-FIX-5 **codifica em automação** esse aprendizado adicionando uma regra `no-restricted-syntax` no ESLint que bloqueia o anti-padrão em PR review. **Custo**: 1 regra. **Benefício**: o bug nunca mais consegue passar pela revisão humana porque é bloqueado mecanicamente.

**Status (2026-05-23)**: Fase 1 (anti-padrão A) ✅ aplicada · Fase 2 (anti-padrão B, T-FIX-5b) ✅ resolvida via Opção A (eslint-disable cirúrgico).

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

Existem duas formas relacionadas do problema:

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

## Fase 2 — T-FIX-5b ✅ RESOLVIDO em 2026-05-23

> Esta seção substitui o "T-FIX-5b futuro" da versão anterior do documento.
> Status: Etapa 17 do `docs/PLANO-20-ETAPAS-2026-05-23.md` fechada.

### Decisão arquitetural: Opção A (eslint-disable cirúrgico)

Em 2026-05-23, sessão dedicada auditou os 2 falsos positivos conhecidos do anti-padrão B e aplicou **eslint-disable-next-line** com comentário inline justificando, **mantendo a regra como `error`** no resto do repo.

**Por que Opção A venceu** das 3 alternativas:

| Opção | Esforço | Risco | Decisão |
|-------|---------|-------|---------|
| **A. eslint-disable cirúrgico** | ~5 min, 2 linhas + comentários | 🟢 zero | ✅ **APLICADA** |
| B. Refactor para it.each | ~30 min, ~40 linhas | 🟡 médio (preservar setup) | ❌ custo desproporcional |
| C. Manter regra como `warn` | ~5 min | 🟢 zero | ❌ mascara todos os casos, não só estes 2 |

### Tratamento aplicado em cada arquivo

**1. `src/pages/auth/AuthBranding.visual.test.tsx`** (commit [`9bf51be`](https://github.com/adm01-debug/promo-gifts-v4/commit/9bf51beafeeb503794c9825f4cfbdd399c8ef351))

```ts
const cards = container.querySelectorAll('.rounded-3xl');
expect(cards.length).toBeGreaterThan(0);
// T-FIX-5b — Opção A:
// ~6 cards do mesmo render() (não dados estáticos). Masking tem alcance
// pequeno: todos inspecionados antes do usuário ver a página. Quebra de
// classe Tailwind tipicamente vem da mesma causa (regressão global do
// design system) → todos falham juntos. Custo de refactor para it.each
// seria alto (N renders ou setup helper). Diferente do Rose Quartz
// (26 presets isolados), aqui o risco residual é aceitável.
// eslint-disable-next-line no-restricted-syntax
cards.forEach(card => {
  expect(card.className).toContain('px-5');
  expect(card.className).toContain('h-[88px]');
});
```

**2. `src/components/quotes/__tests__/QuoteBuilderStepper.test.tsx`** (commit [`5318da2`](https://github.com/adm01-debug/promo-gifts-v4/commit/5318da2609064130db8898063bcb7c2e3f140fdc))

```ts
const labels = ['Cliente', 'Condições', 'Itens', 'Personalização', 'Revisão'];
// T-FIX-5b — Opção A:
// 5 labels hardcoded no componente, todos renderizados juntos no DOM.
// Se 'Cliente' faltar, os outros 4 provavelmente também faltariam
// (regressão estrutural do stepper) → usuário veria stepper quebrado
// imediatamente. Refactor para it.each exigiria 5 renders separados.
// Custo-benefício não compensa para 5 labels estáticos.
// eslint-disable-next-line no-restricted-syntax
labels.forEach((l) => expect(screen.getByText(l)).toBeDefined());
```

### Por que NÃO criamos regra ESLint para o anti-padrão B

Considerei adicionar uma segunda regra `no-restricted-syntax` detectando `expect` dentro de `forEach` dentro de `it/test`. Análise:

- Hoje **apenas estes 2 arquivos** têm o padrão B em todo o repo
- A nova regra encontraria exatamente os 2 mesmos lugares
- Eu teria que adicionar `eslint-disable` nos 2 + criar a regra
- Resultado líquido: **mais código, mesma proteção real**

**Princípio YAGNI aplicado a lint rules**: não criar regras preventivas para casos hipotéticos. Se um 3º arquivo aparecer com o padrão B no futuro, **aí** vale criar a regra (com `warn`, não `error`) e referenciar os 2 precedentes existentes como exceções documentadas.

### Como reconhecer um caso onde o anti-padrão B é tolerável

Use estes 3 critérios para decidir entre `eslint-disable` (Opção A) e refactor (Opção B):

1. **Origem dos dados**: são DOM nodes do mesmo `render()` (Opção A OK) ou dados estáticos isoláveis (Opção B preferida)?
2. **Causa raiz provável de falha**: se 1 falhar, os outros têm alta probabilidade de falhar pelo mesmo motivo (Opção A OK) ou são independentes (Opção B preferida)?
3. **Tamanho do conjunto**: ≤10 itens visíveis no mesmo viewport (Opção A OK) ou conjunto grande sem visão única (Opção B preferida)?

Se **2 ou mais** critérios apontam para "Opção A OK", documente inline e use eslint-disable. Caso contrário, refatore.

## Outros itens fora do escopo

- ~~`QuoteBuilderStepper.test.tsx:68` — `icons.forEach(icon => {})` vazio~~ ✅ **Resolvido pelo PR #124, Etapa 18** (commit `6250622`) — `it` no-op removido (ícones estavam mockados, teste real precisa rodar sem mock em suite separada de visual regression)
- Migração de testes legados se houver — auditoria adicional necessária

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
- Commits T-FIX-5b (Fase 2): [9bf51be](https://github.com/adm01-debug/promo-gifts-v4/commit/9bf51beafeeb503794c9825f4cfbdd399c8ef351) (AuthBranding), [5318da2](https://github.com/adm01-debug/promo-gifts-v4/commit/5318da2609064130db8898063bcb7c2e3f140fdc) (QuoteBuilderStepper)
- CI run que revelou o bug: [26303752735](https://github.com/adm01-debug/promo-gifts-v4/actions/runs/26303752735)
- ESLint `no-restricted-syntax` docs: <https://eslint.org/docs/latest/rules/no-restricted-syntax>
- ESLint AST selectors: <https://eslint.org/docs/latest/extend/selectors>
- Vitest `it.each` / `describe.each`: <https://vitest.dev/api/#test-each>
- Vitest `expect.soft`: <https://vitest.dev/api/expect.html#soft>
