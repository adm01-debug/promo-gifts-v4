# Auditoria de cobertura — Smoke E2E

> **Gerado automaticamente** por `scripts/e2e-smoke-coverage-doc.mjs` em 2026-07-16.
> **Não edite à mão** — a fonte de verdade é `e2e/routes/_catalog.ts` + `SMOKE_COVERAGE` em `e2e/flows/20-all-features-smoke.spec.ts`.

## Resumo

| Métrica | Valor |
|---|---|
| Rotas no catálogo | **58** |
| Rotas `smoke: true` | **30** |
| Features autenticadas cobertas | **30** |
| Smoke público (sem auth) | **0** |

Suíte: [`e2e/flows/20-all-features-smoke.spec.ts`](../e2e/flows/20-all-features-smoke.spec.ts) · Project Playwright: `chromium-smoke` (workers=1, retries=0).

## Smoke autenticado — features × rotas

Ordem do array `SMOKE_COVERAGE`. Numeração bate com os títulos `NN · Nome` no relatório do Playwright.

| # | Feature | Descrição | Rota | Restrição |
|---|---|---|---|---|
| `01` | `dashboard-home` | Dashboard inicial | `/` | — |
| `02` | `dashboard-custom` | Dashboard customizável | `/dashboard` | — |
| `03` | `catalog` | Catálogo de produtos | `/produtos` | — |
| `04` | `catalog-filters` | Filtros avançados | `/filtros` | — |
| `05` | `news` | Novidades | `/novidades` | — |
| `06` | `trends` | Tendências | `/tendencias` | — |
| `07` | `favorites` | Favoritos | `/favoritos` | — |
| `08` | `collections` | Coleções | `/colecoes` | — |
| `09` | `comparison` | Comparador de produtos | `/comparar` | — |
| `10` | `carts` | Carrinhos do vendedor | `/carrinhos` | — |
| `11` | `quotes-list` | Lista de orçamentos | `/orcamentos` | — |
| `12` | `quotes-dashboard` | Dashboard de orçamentos | `/orcamentos/dashboard` | — |
| `13` | `quotes-kanban` | Funil (Kanban) de orçamentos | `/orcamentos/kanban` | — |
| `14` | `quotes-templates` | ⚠ **ausente no catálogo** | — | — |
| `15` | `quote-new` | Criar novo orçamento (wizard) | `/orcamentos/novo` | — |
| `16` | `simulator` | Simulador (wizard) | `/simulador` | — |
| `17` | `price-simulator` | Simulador de preços | `/simulador-precos` | — |
| `18` | `price-search` | Busca avançada de preço | `/busca-preco` | — |
| `19` | `stock` | Estoque | `/estoque` | — |
| `20` | `restock` | Reposição | `/reposicao` | — |
| `21` | `kit-builder` | Kit Builder | `/montar-kit` | — |
| `22` | `my-kits` | Meus Kits | `/meus-kits` | — |
| `23` | `mockup-generator` | Gerador de Mockup | `/mockup-generator` | — |
| `24` | `mockup-history` | Histórico de Mockups | `/mockups/historico` | — |
| `25` | `magic-up` | Magic Up (publicidade IA) | `/magic-up` | — |
| `26` | `commercial-intel` | Inteligência comercial | `/inteligencia-comercial` | — |
| `27` | `bi` | Business Intelligence | `/ferramentas/bi` | — |
| `28` | `bi-compare` | BI — Comparador de clientes | `/ferramentas/bi/comparar` | — |
| `29` | `match` | Match de produtos | `/match` | — |
| `30` | `dropbox` | Dropbox browser | `/dropbox` | — |

## Smoke público (sem auth)

| # | Feature | Descrição | Rota |
|---|---|---|---|


## Governança

### ⚠ Features marcadas `smoke: true` no catálogo MAS ausentes em `SMOKE_COVERAGE`

- `magazine-templates-gallery` → `/magazine/templates` (`APP_ROUTES`)

### ⚠ Features em `SMOKE_COVERAGE` MAS ausentes (ou `smoke:false`) no catálogo

- `quotes-templates`

---
_Para regenerar:_ `node scripts/e2e-smoke-coverage-doc.mjs`
_Para validar no CI:_ `node scripts/e2e-smoke-coverage-doc.mjs --check`
