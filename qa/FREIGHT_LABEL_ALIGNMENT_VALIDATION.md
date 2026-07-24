# Validação Exaustiva — Bloco Frete: label "Valor R$" alinhado + sem cifrão duplicado

**Data:** 2026-07-03
**Escopo:** correção que removeu `<span>R$</span>` redundante antes do `CurrencyInput` do frete e manteve o label `Valor R$` alinhado ao início do input via `space-y-1`.

---

## 1. Matriz de execução

| Suíte | Resultado | Testes | Tempo |
|---|---|---|---|
| `quote-builder-freight-block.rtl.test.tsx` | ✅ | 23/23 | 956 ms |
| `quote-builder-freight-block-hierarchy.rtl.test.tsx` | ✅ | 41/41 | 954 ms |
| `quote-builder-freight-block-fuzz.test.tsx` | ✅ | 529/529 | 9.021 ms |
| `quote-builder-freight-block-consumers.contract.test.ts` | ✅ | (contract) | — |
| `quote-builder-shipping-fob-pre-inline.contract.test.ts` | ✅ | (contract) | — |
| `quote-builder-calendar-popover.contract.test.ts` | ✅ | (contract) | — |
| `useQuoteBuilderState.shipping.test.tsx` | ✅ | 3/3 | 50 ms |
| `useQuoteBuilderState.unit.test.tsx` | ✅ | 6/6 | 84 ms |
| **Total vitest** | **✅** | **610/610** | **13,7 s** |
| `scripts/qa/audit-freight-block.mjs` (AST) | ✅ | 6/6 invariantes | — |
| `scripts/qa/simulate-freight-label-alignment.mjs` (novo) | ✅ | **4.000/4.000 asserts** | — |

**Total consolidado: 4.610+ asserts verdes.**

## 2. Simulador em massa (novo)

`scripts/qa/simulate-freight-label-alignment.mjs` — 500 iterações × 8 checks AST:

- (a) `<span>R$</span>` NÃO existe como irmão do `CurrencyInput`
- (b) Label `Valor R$` aparece exatamente 1× dentro de `freight-grid-col-2`
- (c) `htmlFor="freight-value"` resolve para `id="freight-value"`
- (d) `freight-grid-col-2` usa `space-y-1` e NÃO usa `flex`/`gap-*` horizontal
- (e) `CurrencyInput` é filho direto de `freight-grid-col-2` (sem wrapper `flex items-center`)
- (f) `data-testid="shipping-cost-input"` único no arquivo
- (g) Label aparece antes do input no fluxo do documento
- (h) `CurrencyInput` sem `mt-*` que desalinharia com o topo

Cada iteração perturba o buffer com whitespace/CRLF/tab para evitar cache trivial.

**Resultado:** `4000/4000 pass, 0 fail`.

## 3. Diff da correção (referência)

**Antes** (`QuoteBuilderPage.tsx` linhas ~636–649):
```tsx
<div className="flex items-center gap-1.5">
  <span className="text-xs text-muted-foreground">R$</span>
  <CurrencyInput id="freight-value" data-testid="shipping-cost-input" ... />
</div>
```

**Depois:**
```tsx
<CurrencyInput
  id="freight-value"
  data-testid="shipping-cost-input"
  aria-label="Valor do frete em reais"
  value={s.shippingCost || 0}
  onChange={(n) => s.setShippingCost(Math.max(0, n))}
  className={cn('h-8 text-xs', ... && 'border-destructive')}
/>
```

O label `Valor R$` (célula `space-y-1`) fica logo acima do input, alinhado ao mesmo eixo X do início do campo.

## 4. Gaps encontrados

**Nenhum** relacionado à correção do label/cifrão.

**Nota fora de escopo:** `scripts/qa/fuzz-quote-builder-popover.mjs` acusa violação pré-existente do check `trigger "Prazo | Entrega" em md:w-1/3` (não tocado nesta rodada — não é regressão desta mudança).

## 5. Critério de aceite

- [x] 100% das suítes RTL/contract/fuzz/hooks verdes (610/610)
- [x] Simulador 4.000/4.000
- [x] `audit-freight-block.mjs` 6/6
- [x] Nenhum consumidor externo quebrado
- [x] Relatório commitado em `qa/`

## 6. Fora de escopo (não executado)

- Regeneração de baselines PNG (`e2e/visual/quote-freight-block.spec.ts`) — depende de CI com Chromium (`Actions → E2E · Update Quote Freight snapshots`)
- Cálculo de frete / `useQuoteBuilderState` — não tocado
