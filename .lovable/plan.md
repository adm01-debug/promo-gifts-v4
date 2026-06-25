## Objetivo
Endurecer o FAB "Novo Orçamento" (`quote-new-button`) com baselines visuais atualizadas, cobertura de foco por teclado (RTL), asserts adicionais de tooltip no E2E e um gate de acessibilidade no CI.

> Observação: este plano já foi implementado no turno anterior (build mode). Reapresentando inalterado para reconfirmar o escopo. Se aprovar novamente, valido o estado atual dos arquivos e aplico apenas o que estiver faltando.

## 1. Baselines visuais (5 viewports)
- Editar `.github/workflows/update-quote-reset-snapshots.yml`:
  - Adicionar `e2e/quotes/quote-new-fab.spec.ts` no comando `npx playwright test ... --update-snapshots`.
  - Adicionar `e2e/quotes/quote-new-fab.spec.ts-snapshots/` no `git add`.
- As 5 baselines (`quote-new-fab-header-<vp>.png`) são geradas pelo job manual e commitadas automaticamente.

## 2. Teste RTL — ordem de foco + tooltip por teclado
Novo arquivo `src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx`:
- Renderizar `QuotesListPage` em `MemoryRouter` (mesmos mocks do `QuotesListPage.fab.test.tsx`).
- `userEvent.setup({ pointerEventsCheck: 0 })` para destravar Radix Tooltip em jsdom.
- Polyfill mínimo de `PointerEvent` / `hasPointerCapture` / `setPointerCapture` / `releasePointerCapture` / `scrollIntoView` em `beforeAll`.
- Casos:
  1. `user.tab()` repetido até `document.activeElement === fab` (com teto `MAX_STEPS`).
  2. Após focar, `findByRole('tooltip')` contém "Criar novo orçamento em segundos".
  3. `user.tab()` move foco para fora e `queryByRole('tooltip')` vira `null`.
  4. `user.tab({ shift: true })` devolve foco ao FAB.

## 3. E2E — asserts extras de tooltip (mobile e desktop)
Editar `e2e/quotes/quote-new-fab.spec.ts`:
- Usar `page.getByRole('tooltip', { name: /Criar novo orçamento em segundos/i })` no lugar de `getByText`.
- Desktop (≥ 640): `fab.hover()` → tooltip visível; `mouse.move(0,0)` → `toBeHidden`.
- Mobile (< 640): `fab.tap()` → tooltip visível; `body.tap({ position: {x:5,y:5} })` → `toBeHidden` (com fallback se o tap já navegar).
- Em todos: `fab.focus()` → tooltip visível; `keyboard.press('Tab')` → `toBeHidden`.
- Mantém asserts de geometria, alinhamento, screenshot do header e navegação ao clicar.

## 4. Gate de acessibilidade do FAB no CI
Novo script `scripts/check-fab-accessibility.mjs` (estático, sem browser) que lê `src/pages/quotes/QuotesListPage.tsx` e valida via regex:
- `data-testid="quote-new-button"`
- `aria-label="Novo orçamento"`
- `rounded-full`, `h-11`, `w-11`, `focus-visible:ring` no `className`
- `<TooltipTrigger asChild>` envolvendo o `Button`
- `<TooltipContent>` com copy "Criar novo orçamento em segundos"

Wire-up:
- `package.json`: `"check:fab-a11y": "node scripts/check-fab-accessibility.mjs"`.
- `.github/workflows/ci.yml`: novo step `FAB accessibility static gate` no job `quality-gate`, entre `Build check` e `Run Unit & Integration Tests`.

## Detalhes técnicos
- Polyfills de Radix Tooltip aplicados só no novo suíte de foco, sem afetar outros testes.
- Não tocar em `client.ts`, schema Supabase ou componentes compartilhados.
- Escopo restrito ao FAB de `/orcamentos`.

## Arquivos
- Editar: `.github/workflows/update-quote-reset-snapshots.yml`
- Editar: `e2e/quotes/quote-new-fab.spec.ts`
- Editar: `.github/workflows/ci.yml`
- Editar: `package.json`
- Criar: `src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx`
- Criar: `scripts/check-fab-accessibility.mjs`
- Geradas pelo workflow manual: 5× `e2e/quotes/quote-new-fab.spec.ts-snapshots/quote-new-fab-header-*.png`

## Fora de escopo
- Mudanças no componente FAB em si.
- Refator de outros botões da página.
- Snapshots de specs não relacionados ao FAB.
