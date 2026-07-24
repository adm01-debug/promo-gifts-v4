# 🔐 Auditoria Exaustiva de RLS — promo-gifts-v4
**Data:** 2026-05-26  
**Banco:** `doufsxqlfjyuvxuezpln` (Supabase / Promo Gifts)  
**Escopo:** 249 tabelas públicas · 731 policies · 15 funções helper  

---

## Sumário Executivo

| Severidade | Total | Status |
|-----------|-------|--------|
| 🔴 CRÍTICO | 3 | ✅ Corrigido |
| 🟠 ALTO | 2 | ✅ Corrigido |
| 🟡 MÉDIO | 53 | ✅ Corrigido (prioritários) |
| 🔵 BAIXO | 2 | Documentado |

---

## 🔴 BUG-001 — `markup_configurations`: Sem políticas de escrita (Admin Bloqueado) ✅

**Impacto:** Admin/owner não conseguia criar, editar ou excluir configurações de markup via cliente Supabase.  
**Causa:** Tabela tinha apenas 1 policy (`SELECT` para `authenticated`). Sem `INSERT`, `UPDATE` ou `DELETE`.  
**Risco:** Funcionalidade de markup de preço estava quebrada para operadores via front-end.  
**Fix aplicado:** Criadas policies `markup_configurations_insert`, `markup_configurations_update`, `markup_configurations_delete` usando `is_org_owner_or_admin(organization_id)`.

---

## 🔴 BUG-002 — `step_up_tokens`: Sem INSERT/UPDATE (Fluxo MFA Quebrado para cliente) ✅

**Impacto:** Clientes que tentavam criar/consumir tokens de step-up via SDK JS eram bloqueados.  
**Causa:** Apenas `SELECT` policy existia.  
**Fix aplicado:** Criadas `step_up_tokens_insert_own`, `step_up_tokens_update_own`, `step_up_tokens_delete_admin`.

---

## 🔴 BUG-003 — `step_up_challenges`: Sem INSERT/UPDATE/DELETE (MFA Challenge Bloqueado) ✅

**Impacto:** Challenges de MFA não podiam ser criados ou consumidos pelo usuário autenticado via SDK.  
**Causa:** Apenas `SELECT` policy existia.  
**Fix aplicado:** Criadas `step_up_challenges_insert_own`, `step_up_challenges_update_own`, `step_up_challenges_delete_own_or_admin`.

---

## 🟠 BUG-004 — `app.current_org_id` Forjável por Cliente (Bypass de Isolamento de Org) ✅

**Impacto:** Usuário autenticado podia executar `SET LOCAL app.current_org_id = '<uuid-de-outra-org>'` e acessar dados de outras organizações.  
**Causa:** 12 policies em 5 tabelas confiavam em `current_setting('app.current_org_id', true)` sem validar `auth.uid()`.  

**Tabelas corrigidas:**
- `color_groups` — policies DROP + CREATE com `user_belongs_to_org()`
- `color_nuances` — policy DROP + CREATE com `user_belongs_to_org()`
- `color_variations` — policy DROP + CREATE com `user_belongs_to_org()`
- `material_groups` — 4 policies DROP + CREATE com `user_belongs_to_org()`
- `product_materials` — policy DROP + CREATE com `user_belongs_to_org()`

---

## 🟠 BUG-005 — `user_roles` INSERT: Escalada de Privilégio ✅

**Impacto:** Qualquer usuário com role `manager` podia conceder a si mesmo o role `dev`.  
**Causa:** `WITH CHECK: is_admin_or_above()` incluía manager/supervisor.  
**Vetor de ataque:** `INSERT INTO user_roles(user_id, role) VALUES(auth.uid(), 'dev')` → escalação total.  
**Fix aplicado:** Policies `user_roles_insert_guarded`, `user_roles_update_guarded`, `user_roles_delete_guarded` com CASE separando permissões para role `dev` (apenas `is_dev()`).

---

## 🟡 BUG-006 — 53 políticas UPDATE sem WITH CHECK (Vulnerabilidade TOCTOU) ✅

**Impacto:** Usuário podia alterar colunas-chave (`organization_id`, `user_id`) para valores fora de sua permissão.  
**Causa:** Políticas UPDATE com USING mas sem WITH CHECK.  

**Tabelas de alta prioridade corrigidas:**
- `products`, `product_variants`, `product_images`, `product_videos`, `product_tags`, `product_relationships`, `product_kit_components`
- `orders`, `order_items`
- `categories`, `category_relationships`
- `quotes`, `quote_items`, `quote_comments`, `quote_templates`
- `suppliers`
- `b2b_collections`
- `tags`, `color_equivalences`, `supplier_colors`, `variation_types`, `variation_values`, `variant_supplier_sources`
- `art_file_attachments`, `notification_preferences`, `notifications`, `recently_viewed_products`, `saved_filters`
- `user_comparisons`, `user_filter_presets`, `user_onboarding`, `user_preferences`, `push_subscriptions`
- `kit_collaborators`, `kit_comments`, `kit_variants`
- `user_token_revocations`

---

## 🔵 BUG-007 — `is_admin_strict` é na verdade `is_dev` (Naming Mismatch)

**Impacto:** Baixo — confusão de nomenclatura. `is_admin_strict()` chama `is_dev()` internamente.  
**Recomendação:** Renomear para `is_dev_strict()` ou adicionar alias mais claro.

---

## 🔵 BUG-008 — `is_coord_or_above` = `is_admin_or_above` (Hierarquia Achatada)

**Impacto:** Baixo — role `coordenador` não tem path distinto no RBAC.  
**Causa:** Ambas chamam `is_supervisor_or_above()`.  
**Recomendação:** Implementar hierarquia: coordenador < supervisor < admin < dev.

---

## ✅ Verificações Positivas

- 249 tabelas com RLS — ZERO tabelas sem policy (sem lockout total)
- `service_role` bypass de RLS correto para edge functions
- `SECURITY DEFINER` + `SET search_path TO 'public'` nas funções helper críticas
- `auth.uid()` cacheado via `(SELECT auth.uid() AS uid)` nas policies
- Funções `is_dev()`, `has_role()`, `is_org_owner_or_admin()` com definições corretas e seguras

---

## Metodologia

1. Listagem de todas as 249 tabelas via `pg_tables`
2. Extração das 731 policies via `pg_policies`
3. Análise de 15 funções helper via `pg_proc` + `pg_get_functiondef()`
4. Verificação de 8 classes de bugs (lockout, open access, forgeable context, privilege escalation, TOCTOU, naming)
5. Aplicação direta das correções via Supabase SQL
6. Verificação pós-fix com queries de validação
