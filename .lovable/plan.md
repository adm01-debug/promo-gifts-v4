## Escopo

Hardening do FAB "Novo Orçamento" (bola azul `+`) no header de `/orcamentos`: acessibilidade, layout responsivo e cobertura de testes.

## 1. Acessibilidade (código de produção)

Arquivo: `src/pages/quotes/QuotesListPage.tsx` (bloco do FAB ~linhas 126–141).

- `aria-label="Novo orçamento"` já existe — manter.
- Adicionar `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` ao `className` do `Button` para indicador de foco por teclado.
- Tooltip do shadcn (Radix) já abre no `focus` por padrão; garantir que o `TooltipTrigger asChild` envolve diretamente o `Button` (já está). Sem mudanças funcionais.
- Garantir tap target ≥ 44px: subir de `h-10 w-10` para `h-11 w-11` (44×44) e ícone `h-5 w-5`. Mantém alinhamento com `Input`/`Select` (h-10) por `self-center` no contêiner pai já flex `items-center`.

## 2. Layout responsivo (390px e menores)

Mesmo arquivo. O contêiner pai já é `flex … sm:flex-row sm:items-center` com `shrink-0` no FAB. Adicionar:
- Wrapper do FAB com `sm:ml-auto` opcional — não. Manter ordem atual (Buscar → Ordenar → FAB).
- Confirmar `shrink-0` no Button (já presente) para não esmagar.
- Em < sm o layout empilha (`flex-col`) por design — FAB fica em sua própria linha, alinhado à esquerda. Sem quebra.

## 3. Teste unit/RTL de layout

Novo: `src/pages/quotes/__tests__/QuotesListPage.header.test.tsx`.

Renderiza `QuotesListPage` com providers mínimos (Router + QueryClient + TooltipProvider, mock de `useQuotesListPage`) e valida:
- `getByTestId('page-title-orcamentos')` e `getByTestId('quote-new-button')` existem.
- Ambos estão dentro do mesmo header (ancestral comum próximo).
- FAB tem `aria-label="Novo orçamento"` e classe `rounded-full`.
- FAB **não** contém texto "Novo Orçamento".
- Hover dispara tooltip "Criar novo orçamento em segundos" (via `userEvent.hover`).
- Foco por teclado (`userEvent.tab`) também dispara o tooltip.
- Click no FAB chama `navigate('/orcamentos/novo')` (mock).

## 4. E2E responsivo (Playwright)

Novo: `e2e/quotes/quote-new-fab.spec.ts` baseado em `e2e/quotes/quote-number-subtitle.spec.ts` (mesmo padrão `requireAuth` + `QUOTE_BREAKPOINTS` + `gotoQuoteScenario`).

Para cada viewport (mobile-sm 360, mobile 390, tablet 768, laptop 1280, desktop 1536):
- FAB visível, `rounded-full`, dimensões ~44×44.
- Bounding box do FAB e do `page-title-orcamentos` na mesma região do header (mesmo ancestral `<header>` ou container imediato).
- Em ≥ sm: |y_center(title) − y_center(FAB)| ≤ 40px (mesma linha).
- Hover exibe tooltip com texto comercial; foco via teclado também.
- Click → `expect(page).toHaveURL(/\/orcamentos\/novo/)`.
- Screenshot do header `quote-new-fab-header-${vp}.png` com `maxDiffPixelRatio: 0.02`.

Workflow: rodar no project `chromium-authed` (skip nos demais), como o spec referência.

## 5. Snapshots existentes do header

`quote-number-subtitle-*.png` capturam o header — vão acusar diff por causa do novo FAB.
- Atualizar via workflow `update-quote-reset-snapshots.yml` (já existente) OU rodar localmente `npx playwright test e2e/quotes/quote-number-subtitle.spec.ts --update-snapshots` e commitar.
- Listar no PR description que a atualização é esperada (mudança visual aprovada do botão).

## Arquivos

- Editar: `src/pages/quotes/QuotesListPage.tsx` (focus ring + h-11/w-11).
- Criar: `src/pages/quotes/__tests__/QuotesListPage.header.test.tsx`.
- Criar: `e2e/quotes/quote-new-fab.spec.ts`.
- Atualizar (baselines binários): snapshots do `quote-number-subtitle` nos 5 viewports.

## Fora de escopo

- Não tocar em `quote_number`, dados, status ou outros módulos.
- Não criar componente compartilhado de header (fica para rodada futura se aprovado).
