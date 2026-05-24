# Sumário Executivo — Auditoria Front-end ↔ DB (Promo_Gifts)

**Data:** 2026-04-29 | **Relatório completo:** `docs/AUDIT_FRONTEND_DATABASE.md`

## Contagem de achados por severidade

| Severidade | Qtd | Descrição resumida |
|---|---|---|
| 🔴 CRÍTICO | **4** | RLS com "Allow all" jamais removido em `products/categories/suppliers/quotes`; PII de clientes exposto para anônimos; `order_items` e `audit_trail` abertos |
| 🟡 ATENÇÃO | **7** | 12 tabelas sem tipos TS; secrets em texto no banco; subscriptions Realtime sem filtro; select('*') com PII; staleTime ausente em 67% dos hooks |
| 🔵 INFO | **4** | 52 tipos mortos; queryKey sem namespace; 25 migrations em 3 dias; índices possivelmente ausentes |

## Ação imediata necessária

1. ✅ **RESOLVIDO em 2026-05-22** (rodada QA `claude/code-qa-review-UUabl`) — migration `supabase/migrations/20260522001500_drop_allow_all_policies.sql` dropa `Allow all` em `products`, `categories`, `suppliers`, `quotes`. As policies restritivas org-based/role-based pré-existentes (criadas em `20250103020000_rls_organizations.sql` e `20250103100000_rls_no_gamification.sql`) assumem o controle de acesso. Detalhes em `docs/QA_REPORT_2026-05-22.md`.

2. **Regenerar types.ts:** Executar `supabase gen types typescript --project-id nmojwpihnslkssljowjh` para cobrir as 12 tabelas sem tipos.

3. **Restringir `order_items`:** Trocar `USING (true)` por filtro baseado em organização/usuário.

## Inventário resumido

- **Tabelas acessadas pelo front:** 68 únicas
- **Edge functions invocadas:** 28 (de 86 deployadas)
- **RPCs chamados:** 35 únicos
- **Subscriptions Realtime:** 9 canais (6 arquivos)
- **Buckets Storage:** 7 buckets

*Nota: Ferramentas MCP Supabase (execute_sql, list_tables, get_advisors) sem acesso — análise baseada nas 356 migrations locais.*
