# ONDA-16 — Modelo de Roles: `agente` == `vendedor` (fonte da verdade)

> Status: aplicado em 2026-05-30. Substitui orientacoes anteriores que tratavam
> `agente` como role distinta. Em caso de conflito com docs mais antigos
> (ANALISE_BACKEND_SENIOR_2026-05-22, AUDITORIA-BACKEND-2026-05-25, ONDA-10),
> **este doc prevalece** quanto ao modelo de roles.

## TL;DR

A role `agente` **nunca existiu** na tabela `user_roles`. As roles reais sao:

| Role real (`user_roles.role`) | Tier | Aliases historicos no codigo |
|---|---|---|
| `vendedor` | base (1) | `agente` |
| `admin`    | gestao (2) | `supervisor` |
| `dev`      | topo (3) | — |

`agente` e `supervisor` permanecem **aceitos como sinonimos** no codigo por
retrocompatibilidade, mas o nome canonico e `vendedor` / `admin`.

## O bug que isso causou (403 em massa)

`requireRole(authCtx, 'agente')` gateava varias funcoes. Como `agente` nao
existe em `user_roles` e o `requireRole` antigo nao promovia roles superiores
para um requisito de tier-base, o resultado era:

- `vendedor` → 403 (nao tem literal 'agente')
- `admin`    → 403 (idem)
- `dev`      → 200 (passava pelo short-circuit de dev)

Ou seja, **12 de 13 usuarios** travados. Funcoes afetadas: `categories-api`,
`quote-sync` (P0 — sync de orcamento p/ CRM), `bi-copilot`,
`comparison-ai-advisor`, `kit-ai-builder`, `dropbox-list`.

## Como ficou (a regra)

`requireRole(auth, required)` em `_shared/auth.ts`:

- `dev` passa em qualquer requisito;
- requisito `admin` | `supervisor` → satisfeito por `dev`/`supervisor`/`admin`;
- requisito `agente` | `vendedor` (tier-base) → satisfeito por **qualquer
  usuario interno autenticado** (`vendedor`/`agente`/`coordenador`/`supervisor`/
  `admin`/`dev`);
- qualquer outro nome de role → match exato (comportamento legado).

Nenhuma tier de privilegio alto foi afrouxada.

## Arquivos tocados nesta onda

- `_shared/auth.ts` — novo ramo tier-base em `requireRole` (fix de raiz das 5
  funcoes que mantem `requireRole(authCtx, 'agente')`).
- `categories-api/index.ts` — gate inline por roles internas.
- `_shared/authorize.ts` — `ROLE_RANK` passou a conhecer `vendedor`/`admin`
  (eliminou comparacao NaN latente); helper `rankOf()` trata role desconhecida
  como 0.
- `_shared/createEdge.ts` — `EdgeRole` inclui `vendedor`/`admin`.

## Para novas Edge Functions

Prefira `createEdge({ auth: 'jwt', role: 'vendedor' }, handler)`. Use `'admin'`
para acoes de gestao e `'dev'` para telemetria/operacoes tecnicas. Nao invente
nomes novos de role — use os 3 reais (`vendedor`/`admin`/`dev`).

## Validacao funcional

- `/filtros` → reaplicar filtro de categoria → `categories-api` 200.
- Vendedor sincroniza orcamento → `quote-sync` 200.
