# Validação Exaustiva — Calendário shrink + Popover 1:1 com o trigger

**Data:** 2026-07-03
**Escopo:** `src/components/ui/calendar.tsx` (shrink final: `p-1.5`, `text-[11px]`, `text-[10px]`, `space-y-1.5`, `gap-0`) + popover host em `src/pages/quotes/QuoteBuilderPage.tsx` (`w-[var(--radix-popover-trigger-width)]`, `p-2`, sem `min-w`) + trigger "Prazo | Entrega" em `md:w-1/3`.

## Resultado consolidado

| Camada | Arquivo | Testes | Status |
|---|---|---:|---|
| Contract shrink | `calendar.dimensions.test.tsx` | 7 | ✅ |
| Contract iOS redesign | `calendar.redesign.test.tsx` | 9 (+ 50 fuzz meses) | ✅ |
| Contract popover host | `quote-builder-calendar-popover.contract.test.ts` | 1 | ✅ |
| Contract trigger width | `quote-builder-delivery-trigger-width.contract.test.ts` | 1 | ✅ |
| Fuzz tokens iOS | `scripts/qa/fuzz-calendar-tokens.mjs` | 500 iter × 26 checks = **13.000** | ✅ 500/500 |
| Fuzz proporcional | `scripts/qa/fuzz-calendar-proportional.mjs` | 700 iter × 5 = **3.500** | ✅ 700/700 |
| Fuzz popover host | `scripts/qa/fuzz-quote-builder-popover.mjs` | 300 iter × 5 = **1.500** | ✅ 1500/1500 |
| **Total** | — | **~18.068 asserções** | ✅ |

## Invariantes cobertas

### Calendar shrink
- `p-1.5` no root (rejeita `p-2`/`p-4`).
- `caption_label`: `text-[15px]` + `font-bold` + `tracking-tight` + `leading-none`.
- `head_cell`: `text-[10px]` + `flex-1`.
- `day`: `text-[11px]` + `rounded-full`.
- `cell`: `flex-1 aspect-square` (sem `h-N w-N` fixo).
- `nav_button`: `h-6 w-6` + `focus-visible:ring-2`.
- Ícones nav: `h-3.5 w-3.5`.
- `month` com `space-y-1.5`; rows com `gap-0`.

### iOS redesign (mantido)
- Mês pt-BR capitalizado, weekdays de 1 letra, domingo `text-destructive`.
- Hoje: `bg-foreground` + `text-background`.
- Selecionado: `bg-primary` + `text-primary-foreground`.
- Outside: `invisible pointer-events-none`.
- Zero cores hard-coded (`bg-white|bg-black|text-white|#hex`).

### Popover host (QuoteBuilderPage)
- `w-[var(--radix-popover-trigger-width)]` presente.
- `p-2` na mesma linha; **sem** `min-w-[`; **sem** `p-3`.
- Trigger "Prazo | Entrega" em `w-full md:w-1/3` (casa com "Validade | Proposta").
- Rejeita regressões `md:w-2/5` e `md:w-1/2`.

## Gaps encontrados e fechados
1. **Balanceamento de chaves no teste "shrink extra"** (line_replace posicionou o novo `it` antes do fechamento do bloco anterior) → corrigido inserindo `});` explícito antes do novo caso.
2. **REQUIRED do fuzzer de tokens** faltava `p-1.5`, `text-[11px]`, `text-[10px]`, `space-y-1.5`, `gap-0` → adicionado (26 checks agora).
3. **Fuzz popover host inexistente** → criado com 5 invariantes cruzando trigger + popover.

## Não coberto por design
- Pixel-perfect Playwright: browsers indisponíveis no sandbox; delegado a `e2e-quote-conditions-pr-check.yml`.
- Nenhuma alteração em regras de negócio.

## Comandos de reprodução
```bash
bunx vitest run \
  src/components/ui/__tests__/calendar.dimensions.test.tsx \
  src/components/ui/__tests__/calendar.redesign.test.tsx \
  src/pages/quotes/__tests__/quote-builder-calendar-popover.contract.test.ts \
  src/pages/quotes/__tests__/quote-builder-delivery-trigger-width.contract.test.ts
node scripts/qa/fuzz-calendar-tokens.mjs
node scripts/qa/fuzz-calendar-proportional.mjs
node scripts/qa/fuzz-quote-builder-popover.mjs
```
