-- ============================================================
-- Migration: Corrige policy perigosa na tabela ai_description_queue
-- Auditoria 2026-06-02 — RISCO-1 identificado
--
-- Problema: Policy "ai_queue_service_all" com USING(true) permite
-- que QUALQUER usuário autenticado leia/escreva/delete filas de IA,
-- criando risco de IDOR (Insecure Direct Object Reference).
--
-- Solução: Substituir por políticas granulares de mínimo privilégio:
--   - SELECT: owner OR admin
--   - INSERT: owner (auth.uid() = requested_by)
--   - UPDATE: somente admins
--   - DELETE: somente admins
-- ============================================================

-- Remove a policy permissiva original
DROP POLICY IF EXISTS "ai_queue_service_all" ON ai_description_queue;

-- SELECT: usuário vê apenas suas próprias filas, admins veem tudo
CREATE POLICY "ai_queue_read_own_or_admin"
  ON ai_description_queue
  FOR SELECT
  USING (
    auth.uid() = requested_by
    OR is_admin_or_above(auth.uid())
  );

-- INSERT: usuário pode inserir somente como ele mesmo
CREATE POLICY "ai_queue_insert_own"
  ON ai_description_queue
  FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by
  );

-- UPDATE: somente admins podem atualizar status de fila
CREATE POLICY "ai_queue_update_admin_only"
  ON ai_description_queue
  FOR UPDATE
  USING (
    is_admin_or_above(auth.uid())
  )
  WITH CHECK (
    is_admin_or_above(auth.uid())
  );

-- DELETE: somente admins podem remover entradas de fila
CREATE POLICY "ai_queue_delete_admin_only"
  ON ai_description_queue
  FOR DELETE
  USING (
    is_admin_or_above(auth.uid())
  );

-- Garantir RLS habilitado (já deve estar, mas garantia)
ALTER TABLE ai_description_queue ENABLE ROW LEVEL SECURITY;
