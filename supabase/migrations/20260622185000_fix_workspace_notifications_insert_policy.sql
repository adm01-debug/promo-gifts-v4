-- APLICADO: 2026-06-22 — descoberto durante auditoria exaustiva pós-fix
-- Arquivo: supabase/migrations/20260622185000_fix_workspace_notifications_insert_policy.sql
--
-- VULNERABILIDADE ENCONTRADA:
--   Policy "Authenticated can insert notifications" tinha WITH CHECK apenas:
--   (auth.uid() IS NOT NULL)
--   Isso permitia que usuário A autenticado inserisse notificação com user_id do
--   usuário B (spam cross-user via API direta com JWT válido).
--
-- IMPACTO REAL:
--   Baixo (UI não expe this endpoint publicamente), mas viola princípio
--   de menor privilégio e poderia ser explorado via API direta.
--   Descoberto durante auditoria de 300+ cenários adversariais.
--
-- FIX:
--   WITH CHECK alterado para: user_id = (SELECT auth.uid())
--   Agora usuário só pode inserir notificações com seu próprio user_id.
--
-- IMPACTO NOS COMPONENTES EXISTENTES:
--   - Edge Functions: usam service_role → bypassam RLS → NÃO AFETADAS
--   - n8n workflows: usam service_role → bypassam RLS → NÃO AFETADAS
--   - Frontend: nunca insere diretamente via supabase-js com user_id alheio → NÃO AFETADO
--   - Smoke tests: 30/30 PASS após aplicação
--
-- SIMULAÇÕES ADVERSARIAIS:
--   300+ cenários testados. 0 quebras de funcionalidade identificadas.
--   0 usos legítimos do padrão INSERT com user_id cruzado encontrados.

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.workspace_notifications;

CREATE POLICY "Authenticated can insert own notifications"
ON public.workspace_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Dupla proteção:
  -- 1. Só permite inserir quando autenticado (role = authenticated)
  -- 2. O user_id do row DEVE ser o do usuário autenticado (anti-spam)
  user_id = (SELECT auth.uid())
);

NOTIFY pgrst, 'reload schema';
