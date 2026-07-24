-- ============================================================
-- categories.active — DROP COLUMN (campo legado Bitrix24)
-- Data: 2026-06-22
-- Motivo: 100% redundante com is_active. Zero consumidores
--         verificados em 16 dimensões (views, functions, triggers,
--         RLS, cron, indexes, edge functions, 3.257 arquivos TS).
--         Divergências ativas: 0/477 linhas.
-- ============================================================

-- Pré-condição: active == is_active em 100% das linhas
-- (verificado e corrigido em sessão anterior via P2)
-- DROP aplicado em produção em 2026-06-22 após dry-run BEGIN/ROLLBACK

ALTER TABLE public.categories DROP COLUMN IF EXISTS active;

-- Atualizar documentação do campo canônico
COMMENT ON COLUMN public.categories.is_active IS
'CAMPO CANÔNICO de status de categoria. Controla visibilidade no catálogo, filtros e índices.
Ao inativar uma categoria, setar is_active=false e propagar para subcategorias se necessário.
O campo legado "active" (Bitrix24) foi eliminado em 2026-06-22 após verificação de zero consumidores.';
