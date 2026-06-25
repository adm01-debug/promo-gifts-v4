## Objetivo
Endurecer o FAB "Novo Orçamento" (`quote-new-button`) com baselines visuais atualizadas, cobertura de foco por teclado (RTL), asserts adicionais de tooltip no E2E e um gate de acessibilidade no CI.

## 1. Baselines visuais (5 viewports)
- Disparar o workflow manual `update-quote-reset-snapshots.yml` ampliando a lista de specs para incluir `e2e/quotes/quote-new-fab.spec.ts`.
- Editar `.github/workflows/update-quote-reset-snapshots.yml`:
  - Adicionar `e2e/quotes/quote-new-fab.spec.ts` no comando `npx playwright test ... --update-snapshots`.
  - Adicionar `e2e/quotes/quote-new-fab.spec.ts-snapshots/` no `git add`.
- As 5 baselines (`quote-new-fab-header-<vp>.png`) são geradas pelo job e commitadas automaticamente.

## 2. Teste RTL — ordem de foco + tooltip por teclado
Novo arquivo `src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx` (separado para não poluir o suíte atual):
- Renderizar `QuotesListPage` em `MemoryRouter` (mesmos mocks do `QuotesListPage.fab.test.tsx`).
- Usar `userEvent.setup({ pointerEventsCheck: 0 })` para destravar o Radix Tooltip em jsdom.
- Polyfill mínimo de `PointerEvent`/`hasPointerCapture` no `beforeAll` (Radix exige).
- Casos:
  1. `await user.tab()` repetido até `document.activeElement === fab` — valida que o FAB é alcançável e registra a quantidade de tabs (regressão se passar de N).
  2. Após focar, `findByRole('tooltip')` deve conter a copy "Criar novo orçamento em segundos".
  3. `await user.tab()` move o foco para fora e o tooltip desmonta (`queryByRole('tooltip')` é `null`).
  4. `await user.keyboard('{Shift>}{Tab}{/Shift}')` retorna o foco ao FAB.

## 3. E2E — asserts extras de tooltip (mobile e desktop)
Editar `e2e/quotes/quote-new-fab.spec.ts` para cada viewport da matriz:
- Após `fab.hover()`, asserir tooltip visível **e** mover mouse para `(0,0)` + asserir `toBeHidden({ timeout: 3000 })`.
- Após `fab.focus()`, asserir tooltip visível, depois `page.keyboard.press('Tab')` e asserir tooltip escondido (foco saiu).
- Em viewports mobile (< 640), usar `fab.tap()` para abrir tooltip; asserir visibilidade e fechamento ao tocar fora (`page.locator('body').tap({ position: { x: 10, y: 10 } })`).
- Usar `getByRole('tooltip')` em vez de `getByText` para evitar match acidental.

## 4. Gate de acessibilidade do FAB no CI
Novo script `scripts/check-fab-accessibility.mjs` (estático, sem browser):
- Lê `src/pages/quotes/QuotesListPage.tsx`.
- Asserções regex obrigatórias no nó do FAB:
  - `data-testid="quote-new-button"` presente.
  - `aria-label="Novo orçamento"` presente.
  - `focus-visible:ring` presente no `className`.
  - `rounded-full`, `h-11`, `w-11` presentes.
  - `<TooltipContent>` com a copy "Criar novo orçamento em segundos" no mesmo arquivo.
- Exit code 1 com mensagem clara em qualquer falha.

Wire-up:
- Adicionar `"check:fab-a11y": "node scripts/check-fab-accessibility.mjs"` ao `package.json`.
- Adicionar step no `.github/workflows/ci.yml` dentro do job `quality-gate`, antes dos testes:
  ```yaml
  - name: FAB accessibility static gate
    run: npm run check:fab-a11y
  ```

## Detalhes técnicos
- Radix Tooltip em jsdom: polyfill em `beforeAll` apenas no novo teste de foco, sem impactar outros suítes.
- Não tocar em `client.ts` nem em schema Supabase (regra SSOT).
- Nenhum componente compartilhado é alterado — escopo restrito ao FAB de `/orcamentos`.

## Arquivos
- Editar: `.github/workflows/update-quote-reset-snapshots.yml`
- Editar: `e2e/quotes/quote-new-fab.spec.ts`
- Editar: `.github/workflows/ci.yml`
- Editar: `package.json`
- Criar: `src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx`
- Criar: `scripts/check-fab-accessibility.mjs`
- Gerado pelo workflow manual: 5× `e2e/quotes/quote-new-fab.spec.ts-snapshots/quote-new-fab-header-*.png`

## Fora de escopo
- Mudanças no componente FAB em si (já está com `h-11/w-11`, `focus-visible:ring`, `aria-label`).
- Refator de outros botões da página.
- Mudanças em snapshots de specs não relacionados ao FAB.
