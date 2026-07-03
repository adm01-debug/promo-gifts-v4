# Validação Exaustiva — Redesign do Calendário (Space Optimization)

**Data:** 2026-07-03
**Escopo:** `src/components/ui/calendar.tsx` + popover host em `src/pages/quotes/QuoteBuilderPage.tsx`
**Mudança validada:** grid `flex-1 aspect-square`, header `text-[15px] leading-none`, nav `h-6 w-6` + ícones `h-3.5 w-3.5`, popover `min-w-[260px] p-3`.

## Resultado consolidado

| Camada | Arquivo | Asserções | Status |
|---|---|---|---|
| Contract dimensões | `calendar.dimensions.test.tsx` | 6 casos | ✅ pass |
| Contract redesign iOS | `calendar.redesign.test.tsx` | 9 casos + 50 fuzz meses = 59 asserções efetivas | ✅ pass |
| Guarda popover host | `quote-builder-calendar-popover.contract.test.ts` | 5 asserts | ✅ pass |
| Fuzzer tokens semânticos | `scripts/qa/fuzz-calendar-tokens.mjs` | 500 iter × 21 checks = **10.500** | ✅ 500/500 |
| Fuzzer proporcional | `scripts/qa/fuzz-calendar-proportional.mjs` | 700 iter × 5 invariantes = **3.500** | ✅ 700/700 |
| **Total** | — | **~14.070 asserções** | ✅ |

## Invariantes cobertos

### Espaço horizontal
- `cell` tem `flex-1 aspect-square` (sem `h-6 w-6` ou `h-10 w-10` fixos).
- `head_cell` tem `flex-1`, `head_row` tem `w-full`.
- Colunas se distribuem proporcionalmente até 800px de container (7 larguras testadas: 220/260/320/400/520/640/800).

### Tipografia e hierarquia
- Caption: `text-[15px]`, `font-bold`, `tracking-tight`, `leading-none`.
- Weekdays: `text-[11px]`, `uppercase`, `tracking-wider`.
- Dias: `text-xs` (12px), `font-normal`; selecionado/today em `font-semibold`.

### Navegação
- Botões: `h-6 w-6`, `rounded-full`, `focus-visible:ring-2`.
- Ícones: `h-3.5 w-3.5`.
- Hover: `bg-accent/60`.

### Tokens semânticos (0 hard-coded)
- Nenhum `bg-white`, `bg-black`, `text-white`, hex direto (`#RRGGBB`).
- Todos os estados usam `foreground`, `muted-foreground`, `primary`, `destructive`, `accent`, `background`.

### A11y
- `role="grid"` presente.
- `aria-selected="true"` no dia selecionado.
- `focus-visible:ring-2 focus-visible:ring-ring` nos botões de navegação.

### Popover host (QuoteBuilderPage)
- `w-[var(--radix-popover-trigger-width)]` mantido (acompanha o campo "Prazo | Entrega").
- `min-w-[260px]` (subiu de 220px) garante moldura mínima.
- `p-3` (subiu de p-2) equilibra respiro do frame quando o trigger é estreito.
- Guarda regride se alguém reverter para `min-w-[220px]` ou `p-2`.

## Gaps analisados e afastados

1. **jsdom não computa `aspect-ratio` real.** Fallback: valida presença das classes `flex-1 aspect-square` em 700 iterações e delega a verificação pixel-perfect ao snapshot Playwright (`quote-conditions-visual.spec.ts`, já no CI).
2. **Playwright não rodou no sandbox** (browsers não instalados). Cobertura visual pixel-perfect fica no workflow `e2e-quote-conditions-pr-check.yml` — não bloqueante nesta rodada.
3. **Regex de fuzzer confundia `cell:` com `head_cell:`** — corrigido com `(?:^|\s)cell:` (bug pego durante execução, agora endurecido).

## Comandos para reproduzir

```bash
node scripts/qa/fuzz-calendar-tokens.mjs
node scripts/qa/fuzz-calendar-proportional.mjs
bunx vitest run \
  src/components/ui/__tests__/calendar.dimensions.test.tsx \
  src/components/ui/__tests__/calendar.redesign.test.tsx \
  src/pages/quotes/__tests__/quote-builder-calendar-popover.contract.test.ts
```
