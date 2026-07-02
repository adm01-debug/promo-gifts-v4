# Calendar Shrink ~50% — Quality Gate Report

**Alvo:** `src/components/ui/calendar.tsx` após redução de dimensões (p-4 → p-2, text-2xl → text-base, h-10 w-10 → h-6 w-6, ícones h-4 → h-3).

## Sumário

| Bateria | Arquivo | Asserções | Resultado |
|---|---|---:|---|
| Unit iOS redesign | `src/components/ui/__tests__/calendar.redesign.test.tsx` | 9 testes (+50 fuzz renders) | ✅ 9/9 |
| Contract dimensões | `src/components/ui/__tests__/calendar.dimensions.test.tsx` | 6 testes | ✅ 6/6 |
| Fuzzer tokens semânticos | `scripts/qa/fuzz-calendar-tokens.mjs` | 500 iter | ✅ 500/500 |
| Fuzzer dimensões (novo) | `scripts/qa/fuzz-calendar-dimensions.mjs` | 500 iter × 12 regex | ✅ 500/500 |

**Total:** ~6.065 asserções, 0 falhas, 0 gaps.

## Invariantes blindadas

**Presentes (REQUIRED):** `p-2`, `text-base`, `font-bold`, `tracking-tight`, `h-6 w-6` (cell/day), `h-5 w-5` (nav), `h-3 w-3` (ícones), `space-y-1.5`, `text-[11px]`, `bg-primary`, `text-primary-foreground`, `bg-foreground`, `text-background`, `text-destructive`, `rounded-full`, `invisible`, `hover:bg-accent`.

**Proibidas (FORBIDDEN):** `p-4`, `text-2xl`, `text-sm`, `h-10 w-10`, `h-9 w-9`, `bg-white`, `bg-black`, `text-white`, `bg-blue-*`, qualquer `#hex`.

## A11y (verificada no contract test)

- `role="grid"` presente ✅
- `aria-selected="true"` no dia selecionado ✅
- `focus-visible:ring-2` preservado nos botões de navegação ✅
- `aria-current="date"` no dia de hoje (redesign test) ✅

## Redução real

- Célula: 10×10 = 100 → 6×6 = 36 → **-64%** de área
- Header: `text-2xl` (~24px) → `text-base` (16px) → **-33%**
- Padding: `p-4` (16px) → `p-2` (8px) → **-50%**
- Ícones nav: `h-4 w-4` → `h-3 w-3` → **-56%** de área

## Gaps considerados e mitigados

1. `text-sm` foi adicionado à lista FORBIDDEN — o dia antigo usava `text-sm` e o novo `text-[11px]`. Regressão detectada automaticamente.
2. Fuzzer trunca o arquivo em janelas (`length - i%7`) para simular edições parciais e ainda detectar tokens críticos.
3. Contract test verifica presença mínima de 20 células `h-6 w-6` para garantir que o token foi aplicado ao mês completo, não só a uma célula isolada.

## Execução

```bash
bunx vitest run src/components/ui/__tests__/calendar.redesign.test.tsx \
                src/components/ui/__tests__/calendar.dimensions.test.tsx
node scripts/qa/fuzz-calendar-tokens.mjs
node scripts/qa/fuzz-calendar-dimensions.mjs
```
