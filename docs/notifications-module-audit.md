# Auditoria — Módulo "Notificações de Estoque" (sino do header)

> Status: **corrigido e em produção**. RPCs aplicadas via `execute_sql`,
> frontend religado, testes verdes. Documento de referência da auditoria
> e das decisões.

## 1. Contexto: existem DOIS sinos

| Sino | Componente | `aria-label` / `data-testid` | Fonte de dados |
|------|------------|------------------------------|----------------|
| **Estoque** (este) | `src/components/inventory/StockAlertsIndicator.tsx` | `Alertas de estoque` / `stock-alerts-indicator` | catálogo `products` / `stock_daily_summary` / `product_novelties` |
| Workspace | `src/components/notifications/NotificationDrawer.tsx` (`NotificationBell`) | `Notificações` | `workspace_notifications` |

A suíte histórica `e2e/notifications.spec.ts` mira o sino de **workspace** — o
sino de estoque não tinha cobertura. Por isso o novo
`e2e/flows/31-stock-notifications-bell.spec.ts`.

## 2. Defeitos encontrados

**P0 — aba "Chegou" mostrava o catálogo inteiro como "Reposto".**
A heurística era `updated_at − created_at ≥ 24h`, que captura quase todo
produto que já foi editado alguma vez. Resultado: ~1.350 itens **esgotados**
(ex.: `KT-90451`, 0 un.) apareciam rotulados como "Reposto". Reposição real
(0→positivo) eram ~157.

**P1 — contadores mentiam.** As badges usavam o `length` da lista já truncada
(ex.: "5" quando havia centenas).

**P1 — Novidade pela régua errada.** Usava `created_at ≥ 30d` em vez de
`product_novelties` (a fonte de verdade do badge de novidade).

**P1 — "Zerou" não era zerado.** Query `stock < 50` hardcoded, com rótulo
trocado; ignorava `suppliers.low_stock_threshold` (Asia=50, demais=10) e
`min_quantity`. Misturava "esgotado" com "estoque baixo".

**P2 — UX.** `if (isLoading || total === 0) return null` escondia o sino
inteiro; não havia skeleton nem estado vazio; havia um branch de cor morto
(`new > 0 ? 'bg-primary' : 'bg-primary'`).

## 3. Fontes de verdade (confirmadas no banco)

- **Zerou** → `products.is_stockout = true` (⇒ stock 0).
- **Baixo** → `stock > 0 AND stock <= COALESCE(suppliers.low_stock_threshold,10)`
  — bate exatamente com o badge `#8` de `v_product_active_badge`.
- **Novidade** → `product_novelties` ativas + filtros de qualidade
  (preço > 0, imagem presente, exclui stockout), 1 linha por produto.
- **Chegou** → `stock_daily_summary`, **Cenário A**: `stock_open=0 AND
  stock_close>0 AND restock_detected=true AND summary_date >= hoje-30d`,
  e que **continua disponível** (ativo, stock>0). Mesma semântica de
  `fn_get_replenishment_stats`.

## 4. Correções

### 4.1 Banco — 5 RPCs (`supabase/migrations/20260614220000_stock_notification_rpcs.sql`)
`STABLE SECURITY DEFINER`, `search_path = public`:

- `fn_get_recent_restocks(int=30)` — Chegou
- `fn_get_stockout_alerts(int=50)` — Zerou
- `fn_get_low_stock_alerts(int=50)` — Baixo
- `fn_get_novelty_alerts(int=30)` — Novidade
- `fn_get_stock_notification_counts()` — contadores exatos (jsonb) em 1 round-trip

### 4.2 Frontend
- **NOVO** `src/hooks/products/useStockNotifications.ts`: hooks dedicados por
  categoria + contadores. **Não** altera os hooks compartilhados
  (`useNovelties`/`useReplenishments`/`useStockAlerts`), que servem outros
  módulos.
- **REESCRITO** `StockAlertsIndicator.tsx`: 4 abas (Zerou/Baixo/Novidade/Chegou),
  contadores exatos, cor dominante por severidade
  (`destructive > warning > primary > success`), skeleton, estado vazio,
  footer "Ver todos os N", badges Esgotado/Baixo/Novo/Reposto,
  `data-testid="stock-alerts-indicator"`.

### 4.3 Testes
- **NOVO** `src/components/inventory/__tests__/StockAlertsIndicator.test.tsx` (14 casos).
- **NOVO** `e2e/flows/31-stock-notifications-bell.spec.ts` (alvo correto + invariantes).

## 5. Hardening ACL

`CREATE FUNCTION` concede `EXECUTE` a `PUBLIC` por padrão, o que o gate
`audit_security_definer_acl()` (lints Supabase 0028/0029) sinaliza. Como o sino
só renderiza para usuários autenticados: `REVOKE` de `PUBLIC` e `anon`,
`GRANT EXECUTE` só a `authenticated` (owner/`service_role` mantêm acesso).
**0 violações** para as 5 funções. (As 216 violações legadas do gate são
pré-existentes e fora de escopo deste módulo.)

## 6. Invariantes verificados (simulação read-only, ~7.143 ativos)

| Categoria | Contagem | Verificação |
|-----------|----------|-------------|
| Chegou | 138 | active + stock>0; 29 a menos que o KPI (167) por re-zeragem — corretamente excluídos |
| Zerou | 1.355 | `is_stockout=true` |
| Baixo | 295 | range 1..threshold; == badge `#8` |
| Novidade | 649 | `product_novelties` + qualidade |

Disjunções: `Zerou ∩ Chegou = 0`, `Zerou ∩ Baixo = 0`, `Zerou ∩ Novidade = 0`.
`Chegou ∩ Baixo = 10` (legítimo: "chegou pouco"). Dedup de multi-dia OK,
0 novidade duplicada, 0 `supplier_id` NULL, 0 drift de `is_stockout`.

## 7. Qualidade

`tsc -p tsconfig.app.json` 0 erros · `eslint --max-warnings=0` limpo ·
`prettier --check` limpo · `vitest` 14/14.

## 8. Follow-ups (fora de escopo)

- Endereçar as 216 violações legadas do gate `audit_security_definer_acl`.
- Avaliar migrar a aba "Chegou" para os contadores do KPI semanal
  (`restockedThisWeek`) caso o produto deseje alinhar 1:1 com o dashboard.
