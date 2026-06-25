## Objetivo
Desacelerar a pulsação do FAB "Novo Orçamento" — `animate-ping` padrão é 1s, queremos ~3s para um efeito mais sutil e elegante.

## Mudança (1 linha)

Em `src/pages/quotes/QuotesListPage.tsx` linha 137, trocar `animate-ping` pela versão com duração customizada via arbitrary value do Tailwind:

```diff
- className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-ping"
+ className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"
```

**Por que arbitrary value:** Tailwind permite redefinir `animation` inline sem precisar adicionar keyframes em `tailwind.config.ts` — `ping` já está registrado pelo preset, só sobrescrevemos a duração.

## Resultado
- Halo expande a cada 3s (era 1s) — pulso mais zen.
- Respeita `prefers-reduced-motion` (mesmo comportamento do `animate-ping`).

## Arquivos
- Editar: `src/pages/quotes/QuotesListPage.tsx` (1 linha).

## Fora de escopo
- Mudar cor, escala do halo, gradiente, sombra, hover.
- Gate, testes, workflow.

## Validação
```bash
node scripts/check-fab-accessibility.mjs   # esperado 8/8 (inalterado)
```
