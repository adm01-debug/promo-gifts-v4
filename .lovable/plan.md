Plano

Sobre o "rode `npx playwright test ... --repeat-each=3`"
- A execução local do Playwright neste sandbox não tem as secrets E2E (admin/usuário/Supabase URL/anon key), então rodar o spec aqui terminaria todo em `test.skip` e não validaria flakiness. A validação `--repeat-each=3` será feita pelo próprio CI, em um job dedicado que tem as secrets configuradas.
- Em ambiente local do usuário, basta rodar:
  - `npx playwright test e2e/flows/04ck --repeat-each=3 --project=chromium-authed`

Mudança no CI

Editar `.github/workflows/e2e-discount-approval.yml` (já cobre o glob `04c*`, que inclui `04ck`) adicionando um job dedicado que roda `04ck` com `--repeat-each=3` em cada PR, sem alterar o job atual.

Novo job dentro do mesmo workflow:

```text
discount-widget-badge-live:
  name: Playwright — 04ck (badge pendentes ao vivo) ×3
  runs-on: ubuntu-latest
  timeout-minutes: 25
  env: (mesmas secrets do job atual)
  steps:
    - checkout
    - setup-node 20 + cache npm
    - npm ci
    - npx playwright install --with-deps chromium
    - npm run build
    - npx playwright test e2e/flows/04ck \
        --project=chromium-authed \
        --repeat-each=3 \
        --retries=0 \
        --reporter=html,list,github
    - upload playwright-report-04ck (always)
    - upload test-results + e2e/.evidence (on failure)
```

Observações
- Mantém o job `discount-approval-e2e` existente como está (cobertura de regressão para todos os `04c*`).
- O novo job só roda quando os mesmos `paths` do workflow são tocados; assim toda mudança em hook/widget/spec relacionados aciona a validação ×3.
- Sem alterações em código de aplicação, RLS, schema ou edge functions.

Arquivos afetados
- `.github/workflows/e2e-discount-approval.yml` (editar — adicionar o novo job).