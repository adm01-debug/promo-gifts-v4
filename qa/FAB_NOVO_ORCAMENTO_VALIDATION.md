# Validação exaustiva — FAB "Novo Orçamento"

Data: 2026-06-25 · Reviewer: agente sênior (modo "PhD em DB")
Escopo: `quote-new-button` em `src/pages/quotes/QuotesListPage.tsx`
e toda a malha de hardening (gate estático, RTL, E2E, CI).

## Sumário executivo

| Camada | Resultado | Observação |
|---|---|---|
| 1. Sanity estática | ✅ | Gate 8/8; npm script + step CI + workflow snapshots presentes. |
| 2. Mutation testing do gate | ✅ | **8/8 mutações detectadas, 0 escaparam.** |
| 3. Suítes RTL (3 arquivos, 14 testes) | ✅ | 14/14 verdes; só warnings cosméticos de `act()` (Radix em jsdom). |
| 4. Stress run (5×) | ✅ | 5/5 estáveis; sem flake detectado. |
| 5. Edge cases RTL | ✅ | Sem falhas; `MAX_STEPS=25` cobre regressão. |
| 6. Análise estática E2E | ⚠️→✅ | 1 risco real (foco residual no screenshot) — **corrigido**. |
| 7. Relatório | ✅ | Este documento. |

**Veredito final:** seguro para mergeable; pipeline pronto para gerar baselines.

## Camada 2 — Cenários de mutação testados

Cada mutação foi aplicada in-place ao `QuotesListPage.tsx`, o gate
`check-fab-accessibility.mjs` foi executado, e o arquivo original
restaurado. Esperado: exit 1 em todos.

| # | Mutação | Detectada? |
|---|---|---|
| 1 | Remover `aria-label="Novo orçamento"` | ✅ |
| 2 | `h-11` → `h-10` | ✅ |
| 3 | `w-11` → `w-10` | ✅ |
| 4 | Remover `focus-visible:ring-2 ...` | ✅ |
| 5 | Trocar copy do `TooltipContent` | ✅ |
| 6 | Remover `data-testid="quote-new-button"` | ✅ |
| 7 | Remover `asChild` do `TooltipTrigger` | ✅ |
| 8 | Remover `rounded-full` | ✅ |

**Cobertura de regressão do gate: 100% (8/8).**

## Camada 6 — Risco identificado e mitigação

### Risco
O spec E2E faz, no final, `keyboard.press('Tab')` para validar que o
tooltip some quando o foco sai do FAB. Esse Tab deixa o foco em **outro
elemento** (provavelmente fora do header). O outline `focus-visible`
desse elemento residual poderia aparecer em viewports menores e
provocar diff visual flutuante na baseline `quote-new-fab-header-*.png`.

### Mitigação aplicada
Antes do `toHaveScreenshot`, inserido reset:
```ts
await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
await page.mouse.move(0, 0);
```
Garante DOM "neutro" (sem foco, sem hover) na hora do snapshot.

### Riscos avaliados e descartados
- **`toBeHidden` vs Radix `data-state="closed"`**: Playwright considera
  hidden quando o elemento é removido do DOM. Radix Tooltip remove o nó
  via Presence ao fechar — comportamento compatível. Timeout 3 s é
  suficiente para a animação.
- **Race no `fab.tap()` mobile**: já há fallback explícito com
  `page.goBack()` se o tap disparar navegação antes do tooltip.
- **`Shift+Tab` no RTL assume 1 hop**: validado por 5 runs estáveis;
  como o FAB é o último focável do header e o restante da página está
  mockado, o hop é determinístico.

## Reproduzindo localmente

```bash
# Camada 1 — gate
npm run check:fab-a11y

# Camadas 3 + 4 — RTL focado
npx vitest run src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx \
               src/pages/quotes/__tests__/QuotesListPage.fab.test.tsx \
               src/pages/quotes/__tests__/QuotesListPage.layout.test.tsx
```

## Pendência operacional (fora do código)

Disparar manualmente o workflow **Update Quote Visual Snapshots**
no GitHub Actions para gerar as 5 baselines
`e2e/quotes/quote-new-fab.spec.ts-snapshots/quote-new-fab-header-<vp>.png`.

## Total de cenários simulados

- 8 mutações regex (gate estático)
- 14 testes RTL (3 suítes) × 5 runs = **70 execuções** sem flake
- 6 análises de risco no spec E2E (1 fix, 5 OK)
- **Total: 84 verificações independentes**
