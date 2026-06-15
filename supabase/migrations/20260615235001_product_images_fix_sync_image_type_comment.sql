-- ============================================================================
-- Ajuste de documentação (review CodeRabbit, PR #781): o COMMENT de
-- fn_sync_image_type_code ficou desatualizado após a migration ..._close_drift
-- expandir o trigger para disparar também em UPDATE OF image_type. Reescreve o
-- COMMENT refletindo ambos os caminhos (image_type_id e image_type).
-- ============================================================================

COMMENT ON FUNCTION public.fn_sync_image_type_code() IS
'Trigger BEFORE UPDATE OF image_type_id, image_type: mantém image_type (texto) coerente com a FK image_type_id (fonte da verdade), cobrindo também updates parciais só da coluna texto (fix de drift).';
