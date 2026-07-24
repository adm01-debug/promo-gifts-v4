# Branch Protection — Quote Summary (sticky header + action buttons)

Esta proteção exige que o job de Playwright do Quote Summary passe antes de
permitir merge em PRs que alterem `src/components/quotes/**` ou as specs
relacionadas.

## Required check a marcar

Nome **exato** do check (precisa bater com `jobs.<id>.name` do workflow):

```
Quote Summary sticky header — Playwright (e2e + visual)
```

Workflow: `.github/workflows/quote-summary-sticky-header.yml`
Job id: `sticky-header-e2e`

## Como configurar (UI do GitHub)

1. Repo → **Settings** → **Branches** → **Branch protection rules**.
2. Edite (ou crie) a regra para `main` (e `master`, se existir).
3. Marque **Require status checks to pass before merging**.
4. Marque **Require branches to be up to date before merging**.
5. Em **Status checks that are required**, busque e selecione:
   - `Quote Summary sticky header — Playwright (e2e + visual)`
6. Salve.

> O check só aparece na busca depois que o workflow rodou pelo menos uma vez
> em uma PR. Abra uma PR tocando `src/components/quotes/**` para popular.

## Configuração via API (alternativa)

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks.strict=true \
  -f 'required_status_checks.contexts[]=Quote Summary sticky header — Playwright (e2e + visual)' \
  -f enforce_admins=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f restrictions=
```

## Manutenção

- Se renomear `jobs.sticky-header-e2e.name`, atualize o check em Branch
  Protection — caso contrário PRs ficarão eternamente "pending".
- Para registrar como required check oficial do repo, adicionar também em
  `.github/required-checks.json` (se o repo usar esse SSOT).
