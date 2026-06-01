# RLS Rewrite Plan — `user_roles` / `order_items` / `admin_audit_log`

**Status:** ⏸️ **POSTERGADO** (migration 141234 está como NO-OP)
**Criado em:** 26/05/2026
**Trigger:** Migration `20260526141234_31aaa458-1bc1-476f-bca6-8152907d7a99.sql` proposta pelo Lovable

---

## Por que foi postergado

A migration original do Lovable propunha um rewrite agressivo das policies de RLS em três tabelas críticas, mas a auditoria identificou três problemas que impediriam ela de ser aplicada com segurança:

### 1. DROP POLICY em massa sem revisão de impacto

A migration removia 10 policies funcionais sem rationale documentado:

- `user_roles_delete_guarded` (DELETE, lógica `CASE` baseada em role)
- `user_roles_insert_guarded` (INSERT, lógica `CASE` que valida hierarquia)
- `user_roles_update_guarded` (UPDATE, mesma lógica)
- `Users read own roles` (SELECT, `is_coord_or_above OR self`)
- `order_items_select` (EXISTS via `orders.organization_id` + `user_is_org_member`)
- `order_items_insert`, `order_items_update`, `order_items_delete` (mesma estrutura)
- `Admins or above can insert audit entries` (`is_admin_or_above` + `user_id = auth.uid()`)
- `Devs can read audit logs` (`can_view_audit_logs(auth.uid())`)

Todas estavam em produção e funcionando.

### 2. Função inexistente referenciada

A migration chamava `can_view_all_sales(auth.uid())` (1 argumento), mas a função no banco tem assinatura `can_view_all_sales()` (0 argumentos). A migration **falharia em runtime** no `CREATE POLICY`.

### 3. Modelo de segregação divergente

O rewrite assumia `organization_members` como modelo de pertencimento, mas o sistema atual usa:

- `user_roles.role` (enum `app_role`: `dev`, `supervisor`, `admin`, `coord`, etc.)
- Funções helper `is_admin_or_above(uuid)`, `is_dev(uuid)`, `is_coord_or_above(uuid)`, `can_view_audit_logs(uuid)`, `is_admin_strict(uuid)`, `is_supervisor_or_above(uuid)`
- Para `orders`/`order_items`: `user_is_org_member(uuid)` + `is_org_owner_or_admin(uuid)` (usa `organization_members` de fato, mas nem todas as tabelas seguem esse modelo)

Aplicar a migration teria criado inconsistência entre as três tabelas e o resto do sistema.

---

## Snapshot das policies atuais (26/05/2026)

### `user_roles`

| Policy | Cmd | Lógica |
|---|---|---|
| `user_roles_delete_guarded` | DELETE | `CASE role = 'dev' THEN is_dev(auth.uid()) ELSE is_admin_or_above(auth.uid()) END` |
| `user_roles_insert_guarded` | INSERT | `CASE role = 'dev' THEN is_dev(auth.uid()) ELSE EXISTS(user_roles ur WHERE ur.user_id=auth.uid() AND ur.role IN ('dev','supervisor','admin'))` |
| `user_roles_update_guarded` | UPDATE | USING `is_admin_or_above(auth.uid())` + WITH CHECK igual ao insert |
| `Users read own roles` | SELECT | `is_coord_or_above(auth.uid()) OR auth.uid() = user_id` |

### `order_items`

Todas as 4 operações: `EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND user_is_org_member(o.organization_id))`. Delete tem `is_org_owner_or_admin` ao invés.

### `admin_audit_log`

| Policy | Cmd | Lógica |
|---|---|---|
| `Admins or above can insert audit entries` | INSERT | `is_admin_or_above(auth.uid()) AND user_id = auth.uid()` |
| `Devs can read audit logs` | SELECT | `can_view_audit_logs(auth.uid())` |

---

## Se o rewrite for retomado

Antes de criar uma nova migration, o autor deve:

1. **Validar o problema real.** O que o rewrite resolveria que o modelo atual não resolve? Vazamento de dados conhecido? Performance? Compliance? Sem motivo documentado, NÃO mexer.

2. **Decidir o modelo de segregação.** Manter `user_roles.role` + funções helper (atual) OU migrar para `organization_members` + RLS por org? Os dois modelos coexistem hoje em tabelas diferentes; unificar é uma decisão de produto.

3. **Validar todas as funções referenciadas.** `SELECT proname, pronargs FROM pg_proc WHERE proname IN ('can_view_all_sales', 'is_admin_or_above', 'can_view_audit_logs', 'is_dev', 'is_coord_or_above', 'user_is_org_member', 'is_org_owner_or_admin');` antes de escrever a migration. Se faltar overload, criar antes.

4. **Testes de regressão por persona.** Pelo menos: dev, admin, supervisor, coord, vendedor comum. Validar que cada um lê/escreve o que deve e nada além.

5. **Backup.** `CREATE TABLE _backup_user_roles_policies_YYYYMMDD AS SELECT * FROM pg_policies WHERE tablename = 'user_roles'` (idem para as outras duas) antes de qualquer DROP.

6. **Janela controlada + rollback plan.** Aplicar fora de horário de pico com SQL de rollback pronto.

7. **PR humano.** **Não delegar este trabalho ao Lovable ou similar.** É lógica de segurança de produção; precisa de revisão humana ponta a ponta.

---

## Referências

- Migration NO-OP: `supabase/migrations/20260526141234_31aaa458-1bc1-476f-bca6-8152907d7a99.sql`
- PR #460 (auditoria que detectou o problema): https://github.com/adm01-debug/promo-gifts-v4/pull/460
- Banco: `doufsxqlfjyuvxuezpln`
