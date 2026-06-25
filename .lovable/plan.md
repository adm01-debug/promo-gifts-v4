## Status: já implementado e validado

Todo o escopo do plano foi aplicado no turno anterior e revalidado agora. Não há mudanças adicionais a fazer no código — o gate estático do FAB está verde (8/8 contratos).

## Estado atual dos artefatos

| Item | Arquivo | Status |
|---|---|---|
| 1. Baselines visuais | `.github/workflows/update-quote-reset-snapshots.yml` | ✅ inclui `quote-new-fab.spec.ts` no `--update-snapshots` e no `git add` |
| 2. RTL foco/teclado | `src/pages/quotes/__tests__/QuotesListPage.fab.focus.test.tsx` | ✅ criado com polyfills Radix + 3 casos (tab até FAB, tooltip por foco, Shift+Tab) |
| 3. E2E tooltip extras | `e2e/quotes/quote-new-fab.spec.ts` | ✅ usa `getByRole('tooltip')`, cobre hover/foco/tap, valida open + close |
| 4a. Script de a11y | `scripts/check-fab-accessibility.mjs` | ✅ 8 asserts regex; saída atual: `✅ FAB Novo Orçamento OK (8/8)` |
| 4b. npm script | `package.json` | ✅ `"check:fab-a11y"` registrado |
| 4c. Step no CI | `.github/workflows/ci.yml` | ✅ `FAB accessibility static gate` entre Build e Tests |

## Próximas ações (operacionais, fora do código)

1. Disparar manualmente o workflow **Update Quote Visual Snapshots** no GitHub Actions para gerar e commitar as 5 baselines `quote-new-fab-header-<vp>.png`.
2. Localmente: `npm run test -- QuotesListPage.fab.focus` para confirmar o suíte RTL.
3. Localmente: `npm run check:fab-a11y` para sanity check do gate.

## Se quiser ir além

Posso, em um próximo turno, adicionar **um** destes (escolha apenas se desejar):
- Suite `jest-axe` rodando contra o FAB isolado (a11y dinâmica além do regex estático).
- Asserção extra no spec E2E garantindo `role="tooltip"` no DOM acessível (já parcialmente coberto via `getByRole`).
- Documentação curta em `docs/` resumindo os contratos do FAB.

Nada disso é necessário para fechar o plano original — só sinalize se quiser que eu acrescente.
