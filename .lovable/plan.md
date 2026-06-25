## Objetivo
Validação exaustiva ("PhD em DB" mode) dos artefatos do FAB Novo Orçamento implementados nos turnos anteriores: testes unitários, RTL de foco, gate estático, spec E2E e wire-up em CI/workflow. Encontrar falhas reais antes que cheguem em produção.

## Plano de validação em 7 camadas

### Camada 1 — Sanity check estático (rápido)
- Rodar `node scripts/check-fab-accessibility.mjs` — esperado 8/8.
- Conferir que `npm run check:fab-a11y` está em `package.json` e o step existe em `.github/workflows/ci.yml`.
- Conferir que `update-quote-reset-snapshots.yml` referencia `quote-new-fab.spec.ts` no `playwright test` e no `git add`.

### Camada 2 — Mutation testing manual do gate de a11y
Para garantir que o regex NÃO dá falso-positivo, simular regressões temporárias em cópia do `QuotesListPage.tsx`:
1. Remover `aria-label="Novo orçamento"` → gate deve falhar.
2. Trocar `h-11` por `h-10` → gate deve falhar.
3. Remover `focus-visible:ring-2` → gate deve falhar.
4. Trocar copy do `TooltipContent` → gate deve falhar.
5. Remover `data-testid` → gate deve falhar.
6. Remover `asChild` do `TooltipTrigger` → gate deve falhar.
Execução: copiar arquivo para `/tmp/QuotesListPage.mutated.tsx`, apontar o script para ele via variável de ambiente OU patch in-place + revert. Confirmar exit code 1 em todos os 6 casos e exit 0 no original.

### Camada 3 — Suítes RTL existentes (vitest run focado)
- `npm run test -- src/pages/quotes/__tests__/QuotesListPage.fab.test.tsx`
- `npm run test -- src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx`
- `npm run test -- src/pages/quotes/__tests__/QuotesListPage.layout.test.tsx`
Verificar: 0 falhas, sem warnings de `act()`, sem ref warning, sem vazamento de listener (`afterEach cleanup`).

### Camada 4 — Stress run (detectar flake)
- Rodar o suíte `QuotesListPage.fab.focus.test.tsx` 20× em sequência (`for i in $(seq 1 20); do npx vitest run --no-color src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx || exit 1; done`).
- Qualquer falha intermitente → instabilidade do polyfill de Radix Tooltip em jsdom; corrigir aumentando `asyncUtilTimeout` local ou usando `findByRole` com timeout explícito.

### Camada 5 — Edge cases do RTL
Auditar manualmente o teste de foco contra cenários:
- Loop infinito de `user.tab()` se houver nenhum elemento focável depois do FAB → confirmar `MAX_STEPS` está com teto baixo (25) e o teste falha cedo.
- `document.activeElement` pode ser `<body>` no início → confirmar reset explícito com `document.body.focus()`.
- Shift+Tab pode mover para um elemento entre o FAB e o foco anterior (não diretamente o FAB) se o Select do Radix injetar elementos focáveis no portal → revisar e ajustar para "voltar até encontrar o FAB" em vez de assumir 1 hop.

### Camada 6 — Análise estática do E2E spec
Sem rodar Playwright real (sandbox não tem auth Supabase), revisar `quote-new-fab.spec.ts` para:
- Race conditions: `fab.tap()` em mobile pode disparar navegação ANTES do tooltip aparecer (já há fallback com `page.goBack()`); validar lógica.
- `expect(tooltip).toBeHidden({ timeout: 3000 })` falha se Radix mantiver o nó no DOM com `data-state="closed"` — `toBeHidden` da Playwright trata `visibility:hidden`/`display:none`, mas Radix usa `data-state` + animação. Risco real: substituir por `.not.toBeVisible()` que aceita `display:none` E elemento removido.
- Screenshot do header (`xpath=ancestor::div[1]`) pode capturar o FAB com tooltip aberto se o `Tab` final deixou foco residual. Adicionar `await page.locator('body').click({ position: { x: 1, y: 1 } })` antes do screenshot.

### Camada 7 — Relatório final
Gerar `qa/FAB_NOVO_ORCAMENTO_VALIDATION.md` com:
- Resultado de cada camada (pass/fail + evidências).
- Gaps encontrados + mitigação aplicada (ou recomendação de follow-up).
- Lista de cenários simulados e contadores.

## Correções condicionais (só se a validação encontrar falhas)
- Se Camada 2 mostrar regex frouxo → tightening do `check-fab-accessibility.mjs`.
- Se Camada 4 mostrar flake → ajustar polyfills + timeouts.
- Se Camada 5 mostrar problema no `Shift+Tab` → trocar por loop com teto.
- Se Camada 6 mostrar risco real em `toBeHidden` → trocar por `not.toBeVisible` + reset de foco antes do screenshot.

## Fora de escopo
- Rodar Playwright contra o app real (sandbox não tem credenciais Supabase autenticadas para `chromium-authed`).
- Alterar o componente FAB em si.
- Validar contratos de outros botões/headers.

## Arquivos potencialmente tocados (só se validação falhar)
- `scripts/check-fab-accessibility.mjs` — endurecimento de regex.
- `src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx` — robustez de polyfills.
- `e2e/quotes/quote-new-fab.spec.ts` — `not.toBeVisible` + reset de foco antes do screenshot.
- Criar: `qa/FAB_NOVO_ORCAMENTO_VALIDATION.md` — relatório.
