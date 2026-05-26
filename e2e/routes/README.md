# Suíte E2E por rota

Cobertura por rota crítica do app, organizada em 4 áreas:

| Pasta                  | Auth?      | Project Playwright   |
|------------------------|------------|----------------------|
| `routes/public/`       | Não        | `routes-public`      |
| `routes/app/`          | Sim        | `routes-authed`      |
| `routes/quotes/`       | Sim        | `routes-authed`      |
| `routes/admin/`        | Sim+admin  | `routes-authed`      |

## Convenção oficial (arquivo + describe/it + tags)

### 1) Arquivo
- Padrão: `e2e/routes/<modulo>/<slug-da-rota>.spec.ts`.
- `slug-da-rota` em kebab-case (sem acentos).
- 1 arquivo por rota funcional (evitar agrupar múltiplas rotas no mesmo spec).

### 2) `describe`
- Gerado pela factory com metadados:  
  ` [module:<modulo>] [component:<componente>] [owner:<time>] @regression route:<path>`
- Exemplo: `[module:app] [component:dashboard] [owner:team-growth] @regression route:/dashboard`.

### 3) `it`/`test`
- Cada caso começa com os mesmos metadados + tags.
- Ordem fixa dos casos: render, happy, auth/token fail, payload inválido, timeout, 5xx, a11y, mobile.

### 4) Tags suportadas
- `@critical`: quebra fluxo de negócio principal.
- `@smoke`: valida disponibilidade básica da rota.
- `@regression`: evita retorno de bug conhecido/comportamento quebrado.
- `@edge`: cenário limite/erro controlado (401, 404, 410, 400).
- `@fuzz`: variações de resiliência/latência/timeout.

## Ownership por módulo

| Módulo | Prefixo de rota | Owner padrão |
|---|---|---|
| public | `/approve`, `/proposta`, `/kit`, `/dossie`, `/login` etc | `team-growth` |
| app | `/`, `/dashboard`, `/produtos`, `/filtros`, etc | `team-growth` |
| quotes | `/orcamentos/**` | `team-growth` |
| admin | `/admin/**`, `/status` | `team-growth` |

> Se necessário, sobrescrever owner por rota no spec/factory para refletir responsável real.

## Filtro por rota e componente

```bash
# por módulo
npx playwright test -g "module:quotes"

# por componente
npx playwright test -g "component:dashboard"

# por owner
npx playwright test -g "owner:team-growth"

# por tags de criticidade
npx playwright test -g "@critical"
npx playwright test -g "@smoke"
npx playwright test -g "@edge"
```

## Padrão por rota (8 casos)

Cada spec contém os mesmos casos nominais para fácil leitura:

1. **render** — rota carrega sem erros JS, elementos chave visíveis
2. **happy path** — fluxo principal funciona com mocks de sucesso
3. **auth fail** — sessão inválida / 401 → redireciona ou exibe erro
4. **payload inválido** — 400 do backend é tratado com mensagem legível
5. **timeout** — chamada lenta não trava UI (loading visível, botão recupera)
6. **5xx** — erro de infraestrutura mostra alerta acionável
7. **a11y básico** (`@smoke`) — sem H1 duplicado, inputs com label, botões com nome
8. **mobile** (`@smoke`) — layout 390×844 sem overflow horizontal, CTAs visíveis

Rotas públicas substituem "auth fail" por "token inválido / expirado".

## Mocks

Tudo via `e2e/routes/_shared.ts` com `page.route()` (sem rede real). Helpers:
`mockEdgeFn`, `mockRestTable5xx`, `mockRestTable401`, `mockSessionExpired`,
`basicA11yChecks`, `setMobileViewport`.

## Como rodar

```bash
# Tudo
npx playwright test --project=routes-public --project=routes-authed

# Só pública
npx playwright test e2e/routes/public

# Só mobile
npx playwright test --project=routes-mobile
```
