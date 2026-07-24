# 🔍 Relatório de Auditoria Exaustiva de Integrações

**Data:** 26/05/2026  
**Executor:** Claude Sonnet 4.6 (TIPROMO/Abner)  
**Total de bugs:** 17 (1 crítico · 5 altos · 7 médios · 4 baixo/info)  
**PR:** `fix/integration-audit-20260526`

---

## Metodologia

Análise estática completa de 4.153 arquivos (src, supabase/functions, migrations, e2e, tests):
- `src/integrations/supabase/client.ts`, `src/lib/external-db/bridge.ts`
- `supabase/functions/external-db-bridge/index.ts` (86.6KB)
- Todas as migrations de 26/05/2026 (fix_001 a fix_005 + bugfix_audit)
- `.env.example`, `vercel.json`, `package.json`

---

## 🚨 BUG-001 — CRÍTICO — anon key real exposta no .env.example

**Arquivo:** `.env.example` linha 28 — `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tjH5qAbZ0e5HTTd872NijQ_s9m6JvYU`  
**Fix neste PR:** Substituído por placeholder `sb_publishable_<your-anon-key-here>`

**Ação IMEDIATA obrigatória (antes do merge):**
1. Dashboard → Settings → API → Regenerate anon key
2. Atualizar nova key: Vercel → Environment Variables → `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Comunicar devs para atualizar `.env.local`

---

## 🔴 BUG-002 — ALTO — IDOR: app.current_org_id forgeable

**Migration pendente:** `20260526_fix_004_current_org_id_forgeable.sql`  
**Tabelas afetadas:** color_groups, color_nuances, color_variations, material_groups, product_materials (12 políticas)

Um usuário autenticado pode forjar `app.current_org_id` para acessar dados de outra organização.

**Fix:** Trocar `current_setting()` por `user_belongs_to_org()` — valida via `auth.uid()`.  
**Comando:** `supabase db push`

---

## 🔴 BUG-003 — ALTO — Privilege escalation: manager pode conceder role dev

**Migration pendente:** `20260526_fix_005_user_roles_privilege_escalation.sql`

`is_admin_or_above()` incluía `manager`, que podia inserir `{role: 'dev'}` em `user_roles`.

**Fix:** `CASE WHEN role = 'dev' THEN is_dev(auth.uid()) ELSE is_admin_or_above(auth.uid()) END`

---

## 🔴 BUG-004 — ALTO — markup_configurations sem políticas de escrita

**Migration pendente:** `20260526_fix_001_markup_configurations_write_policies.sql`

Admin/owner não conseguia criar, editar ou deletar markup configurations. Falha silenciosa (0 rows affected).

---

## 🔴 BUG-005 — ALTO — step_up_tokens e step_up_challenges sem políticas

**Migrations pendentes:** `fix_002_step_up_tokens_policies.sql` e `fix_003_step_up_challenges_policies.sql`

Tokens MFA/step-up potencialmente acessíveis por usuários não-autorizados.

---

## 🟡 BUG-006 — MÉDIO — negotiation_markup_percent zerado em 3 cotações

**Cotações:** ORC-2026-001, ORC-2026-002, ORC-2026-003  
**Impacto:** Relatórios de margem mostram 0% onde há markup real  
**Causa raiz:** Fluxo de aprovação atualizava `total` mas não recalculava `negotiation_markup_percent`  
**Fix:** Backfill via `20260526_bugfix_audit_db_full.sql`

---

## 🟡 BUG-007 — MÉDIO — 4 produtos ativos sem preço

**Fornecedor:** Asia Import  
**IDs:** c31e3eae, aa01c9c1, 6dce7b4f, e36c0717 (Mochilas e Canetas Metálicas)  
**Fix:** Desativados via migration de auditoria

---

## 🟡 BUG-008 — MÉDIO — Tabelas duplicadas: smoke tests

**smoke_test_runs** (0 registros, deprecated) vs **smoke_tests_runs** (28 registros, ativa)  
Risco: workers podem gravar na tabela errada, tornando dados invisíveis no monitoramento.

---

## 🟡 BUG-009 — MÉDIO — Tabelas duplicadas: login attempts

**login_attempts** (203 registros) vs **auth_login_attempts** (0 registros, mais nova)  
Risco: rate limiting pode consultar tabela errada → brute force não detectado.  
Ação: verificar qual tabela as edge functions `log-login-attempt` e `rate-limit-check` usam.

---

## 🟡 BUG-010 — MÉDIO — Tabelas duplicadas: audit log

**audit_log** (3 registros, legada) vs **admin_audit_log** (18k+, principal) vs **audit_logs** (vazia)  
`audit_logs` pode ser descontinuada.

---

## 🟡 BUG-011 — MÉDIO — quote_items sem CHECK constraint de subtotal

**Fix:** `CHECK (subtotal >= 0)` adicionado via migration de auditoria

---

## 🟡 BUG-012 — MÉDIO — 136 produtos com category_id != main_category_id sem documentação

Semanticamente correto (subcategoria vs raiz), mas não documentado.  
**Fix:** `COMMENT ON COLUMN` adicionado em ambos os campos.

---

## 🟢 BUG-013 — BAIXO — CSP: unsafe-eval desnecessário

**Fix neste PR:** Removido `'unsafe-eval'` do `script-src` em vercel.json  
**Validar após deploy:** PDF generation, recharts, voice agent

---

## 🟢 BUG-014 — BAIXO — Estado do kill-switch edge_external_db_bridge

Verificar:
```sql
SELECT name, enabled FROM kill_switches WHERE name = 'edge_external_db_bridge';
```
Esperado: `enabled = false` (Caminho B ativo).

---

## 🟢 BUG-015 — BAIXO — Cache TTL curto vs warm-up

`CACHE_TTL_MS = 60_000ms` vs cron de warm-up a cada 4min. Considerar aumentar para 120s em revisão futura.

---

## 🟢 BUG-016 — BAIXO — Schema cache após personalization migration

Verificar que `20260525_232003_fix_339_personalization_missing_columns.sql` foi aplicada:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'print_area_techniques';
```

---

## 🟢 BUG-017 — INFO — View de monitoramento v_db_health_audit

Uso contínuo:
```sql
SELECT * FROM public.v_db_health_audit ORDER BY severidade DESC;
-- Deve retornar 0 issues CRITICAL após aplicação das migrations
```

---

## 📋 Checklist Pós-Merge

- [ ] **IMEDIATO** — Revogar anon key: Dashboard → Settings → API → Regenerate
- [ ] **IMEDIATO** — Atualizar nova anon key: Vercel + .env.local dos devs
- [ ] **URGENTE** — `supabase db push` para aplicar fix_001 a fix_005 + bugfix_audit
- [ ] Testar CSP sem unsafe-eval em produção (PDF, charts, voice)
- [ ] Confirmar kill-switch edge_external_db_bridge ativo
- [ ] Executar `SELECT * FROM v_db_health_audit` — validar 0 issues críticos
- [ ] Revisar consolidação de tabelas duplicadas na próxima sprint

---

*Gerado por Claude Sonnet 4.6 (TIPROMO) em 26/05/2026*
