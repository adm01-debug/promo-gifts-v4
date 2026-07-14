-- ============================================================
-- MIGRATION v4: fix_auth_hydration_v4_drop_redundant_index
-- 2026-07-14 — BUG detectado na auditoria exaustiva pós-deploy
--
-- BUG: idx_user_roles_user_id_covering criado em v3 com
--   INDEX ON user_roles (user_id, role)
-- é IDÊNTICO ao user_roles_pkey:
--   UNIQUE INDEX ON user_roles USING btree (user_id, role)
--
-- A PRIMARY KEY em PostgreSQL cria automaticamente um B-tree
-- index nos campos (user_id, role). O índice adicional era
-- 100% redundante — write overhead + 16KB de storage desperdiçados.
--
-- CAUSA: Foi criado sem verificar antes os índices existentes.
-- REGRA ADICIONADA: antes de criar qualquer índice, verificar
-- se a PK ou outro índice existente já cobre os mesmos campos.
-- ============================================================

DROP INDEX IF EXISTS public.idx_user_roles_user_id_covering;

-- Guard: confirma que PK não foi dropada acidentalmente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'user_roles' AND indexname = 'user_roles_pkey'
  ) THEN
    RAISE EXCEPTION 'user_roles_pkey nao encontrado — PK foi dropada acidentalmente!';
  END IF;
  RAISE NOTICE 'OK: user_roles_pkey presente apos drop do indice redundante';
END;
$$;
