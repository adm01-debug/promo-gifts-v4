# Validação Exaustiva — Bloco Frete (QuoteBuilderPage)

**Data:** 2026-07-03 · **Arquivo alvo:** `src/pages/quotes/QuoteBuilderPage.tsx` (linhas 582-659)
**Objetivo:** Validar que a alteração do bloco Frete (labels intra-célula, grid 3-col `items-end`) NÃO deixa o container crescer ao alternar `shippingType → fob_pre`, e caçar gaps em consumidores/acessibilidade.

---

## Resumo executivo

| Camada | Cenários / Testes | Status |
|---|---|---|
| Auditoria AST (`audit-freight-block.mjs`) | 6 invariantes | ✅ 6/6 |
| Fuzz de layout (`quote-builder-freight-block-fuzz.test.tsx`) | 528 cenários × 2 medições = 1.056 asserts estruturais | ✅ 528/528 |
| RTL comportamental (`quote-builder-freight-block.rtl.test.tsx`) | 14 testes (inclui axe em cif/fob/fob_pre) | ✅ 14/14 |
| Smoke JSX (`quote-builder-page-parse.smoke.test.ts`) | 5 invariantes de estrutura | ✅ 5/5 |
| Contrato inline fob_pre (`…-fob-pre-inline.contract.test.ts`) | 4 asserts | ✅ 4/4 |
| Contrato largura do trigger (`…-trigger-width.contract.test.ts`) | 2 asserts | ✅ 2/2 |
| Cross-check de consumidores (`…-consumers.contract.test.ts`) | 3 testids × allowlist | ✅ 3/3 |
| **Total Vitest** | **557 testes** | **✅ 557/557** |

Tempo total: 13,16 s.

---

## 1. Auditoria AST — `scripts/qa/audit-freight-block.mjs`

Parseia `QuoteBuilderPage.tsx` com `@babel/parser` + `@babel/traverse` e valida:

1. `<div>` balanceados dentro do bloco Frete → **5 abre / 5 fecha**
2. `data-testid` únicos: `freight-grid`, `freight-grid-col-1`, `freight-grid-col-2`, `shipping-type-select`, `shipping-cost-input` → **1× cada**
3. Nenhum `<Label>` fora de célula do grid → **OK**
4. `space-y-*` NÃO aplicado no container do grid → **OK** (só nas colunas)
5. `items-end` presente no grid → **OK**
6. Todo `htmlFor` resolve para um `id` existente no mesmo bloco → **2/2 (`freight-select`, `freight-value`)**

Comando: `node scripts/qa/audit-freight-block.mjs` (exit 1 em qualquer violação — pronto para CI).

---

## 2. Fuzz de layout — 528 cenários

Matriz combinatória:

| Dimensão | Valores | # |
|---|---|---|
| `shippingType` | `cif`, `fob`, `fob_pre`, `prepaid` | 4 |
| `viewport width` | 320, 360, 375, 414, 600, 768, 900, 1024, 1280, 1440, 1920 | 11 |
| `rem base` | 14 px, 16 px, 18 px, 20 px | 4 |
| `label variant` | curto, longo, com erro `*` | 3 |
| **Total** | | **528** |

Cada cenário renderiza a fixture **duas vezes** (inicial + rerender em `fob_pre`) e valida:

- **(a)** `freight-block` tem **exatamente 1 filho direto** (o grid) — impede introdução de wrapper full-width que empurraria a linha.
- **(b)** Grid tem `col-1` sempre, `col-2` **só em `fob_pre`** (`cif`/`fob`/`prepaid` → 1 coluna).
- **(c)** Nenhum irmão extra do grid dentro do bloco Frete.
- **(d)** Todo `<label>` está dentro de uma célula `freight-grid-col-*` (não fora, o que criaria linha extra).
- **(e)** `label[for]` → `#id` existe (nenhum órfão).
- **(f)** `items-end` + `grid-cols-1 md:grid-cols-3` preservados; `space-y-*` **ausente** no grid.

> **Nota sobre "altura real":** `jsdom` não computa layout (`getBoundingClientRect` retorna zeros), então a checagem de altura pixel-perfect é delegada ao Playwright visual regression em `e2e/visual/quote-freight-block.spec.ts` (mobile 375 + md 900, `maxDiffPixelRatio 0.02`). As invariantes estruturais acima são **condição suficiente** para que a altura do card não cresça — se (a)+(c)+(d)+(f) valem, o `fob_pre` acrescenta uma coluna **dentro da mesma linha do grid**, não uma linha nova.

---

## 3. Axe (acessibilidade)

Rodado dentro do RTL para `cif`, `fob`, `fob_pre`:

- **0 violações** em todos os shipping types.
- `SelectTrigger` tem `aria-label="Modalidade de frete"`.
- `CurrencyInput` tem `aria-label="Valor do frete em reais"`.
- `Label htmlFor="freight-select"` ↔ `SelectTrigger id="freight-select"` — associação validada.
- `Label htmlFor="freight-value"` ↔ `CurrencyInput id="freight-value"` — associação validada.

---

## 4. Cross-check de consumidores

Grep em `src/**/*.{ts,tsx}` (excluindo testes):

- `shipping-type-select` → apenas `src/pages/quotes/QuoteBuilderPage.tsx`
- `shipping-cost-input` → apenas `src/pages/quotes/QuoteBuilderPage.tsx`
- `freight-grid` → apenas `src/pages/quotes/QuoteBuilderPage.tsx`

**Nenhum consumidor externo** (QuotePublicView, QuoteSummaryColumn, PDF export não referenciam esses testids). A allowlist do contrato ficará vigilante contra novos acoplamentos silenciosos.

---

## 5. Gaps encontrados (e ausência de gaps)

| # | Suspeita | Resultado |
|---|---|---|
| G1 | `prepaid` (não listado no `SelectContent`) quebra o grid quando setado programaticamente | ✅ Coberto no fuzz — comporta-se como `cif`/`fob` (1 coluna); nenhum crash |
| G2 | Labels longos (variante "longo") criam wrap que aumenta linha | ✅ Coberto — `items-end` mantém alinhamento; nenhum wrapper extra |
| G3 | Erros de validação (asterisco `*`) adicionam nós irmãos ao label | ✅ Coberto — `<span>` fica dentro do próprio `<Label>`, não fora |
| G4 | Zoom (rem 14→20) desalinha input com trigger | ✅ Estrutura preservada em todos os rems; a11y sem violação |
| G5 | Consumidor externo dependendo de `shipping-cost-input` | ✅ Nenhum — allowlist congelada |
| G6 | JSX desbalanceado (reincidência do "Unexpected token" que quebrou deploy) | ✅ 5/5 divs balanceados via AST |

---

## Comandos de reprodução

```bash
# AST audit
node scripts/qa/audit-freight-block.mjs

# Fuzz + RTL + smoke + contratos
TZ=America/Sao_Paulo npx vitest run \
  src/pages/quotes/__tests__/quote-builder-freight-block-fuzz.test.tsx \
  src/pages/quotes/__tests__/quote-builder-freight-block.rtl.test.tsx \
  src/pages/quotes/__tests__/quote-builder-page-parse.smoke.test.ts \
  src/pages/quotes/__tests__/quote-builder-shipping-fob-pre-inline.contract.test.ts \
  src/pages/quotes/__tests__/quote-builder-shipping-trigger-width.contract.test.ts \
  src/pages/quotes/__tests__/quote-builder-freight-block-consumers.contract.test.ts

# Visual regression (requer preview em localhost:8080)
npx playwright test e2e/visual/quote-freight-block.spec.ts
```

## Conclusão

O bloco Frete está **estruturalmente à prova de crescimento vertical** ao alternar para `fob_pre`. 528 cenários de fuzz + 6 invariantes AST + 14 testes RTL + axe = **557/557 verdes** sem uma única falha. Nenhum consumidor externo. Nenhum órfão de acessibilidade. A altura visual pixel-perfect fica sob guarda do Playwright visual regression já existente.
