## Objetivo
Modernizar o FAB "Novo Orçamento" em `src/pages/quotes/QuotesListPage.tsx` com efeito de pulsação sutil, mantendo 100% dos contratos de a11y validados pelo gate `check-fab-accessibility.mjs`.

## Mudança (apenas o `<Button>` do FAB, ~10 linhas)

```tsx
<TooltipTrigger asChild>
  <Button
    data-testid="quote-new-button"
    aria-label="Novo orçamento"
    onClick={...}  // preservar handler existente
    className="group relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-110 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-ping" />
    <Plus className="relative h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
  </Button>
</TooltipTrigger>
```

## Camadas visuais
1. **Halo:** `<span>` absoluto com `bg-primary/40 animate-ping` (Tailwind nativo — onda expandindo ~1s, respeita `prefers-reduced-motion`).
2. **Botão:** gradiente `from-primary to-primary/80`, `shadow-lg shadow-primary/30`.
3. **Hover:** `scale-110`, `shadow-xl shadow-primary/40`.
4. **Ícone:** `group-hover:rotate-90` (micro-interação).

## A11y (preservada)
- ✅ `data-testid="quote-new-button"`, `aria-label="Novo orçamento"`, `rounded-full h-11 w-11`, `focus-visible:ring-2`.
- ✅ Halo com `aria-hidden` + `pointer-events-none` (SR ignora, clique passa direto).
- ✅ Tap target 44×44 inalterado.
- ✅ Tooltip (`TooltipTrigger asChild` + copy "Criar novo orçamento em segundos") intocado.

## Validação
```bash
node scripts/check-fab-accessibility.mjs   # esperado 8/8
```

## Arquivos
- Editar: `src/pages/quotes/QuotesListPage.tsx` (somente o bloco `<Button>` do FAB).

## Fora de escopo
- Componente `Tooltip*`, handler de click, testes, gate, workflow, E2E.
- Keyframes custom em `tailwind.config.ts` (built-in `animate-ping` basta).
- Tokens hardcoded — uso exclusivo de `primary`/`primary-foreground`/`ring`.
