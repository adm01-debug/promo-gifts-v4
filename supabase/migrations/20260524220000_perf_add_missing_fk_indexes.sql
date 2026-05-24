-- Performance: índices faltantes em foreign keys (auditoria MCP — advisor de performance).
--
-- O advisor `unindexed_foreign_keys` apontou 2 FKs sem índice de cobertura, o que
-- degrada JOINs e operações de CASCADE/checagem de FK:
--   - collection_products.product_id (FK collection_products_product_id_fkey1):
--     o índice composto existente (collection_id, product_id) lidera por
--     collection_id e NÃO cobre buscas só por product_id.
--   - system_kill_switches.updated_by (FK system_kill_switches_updated_by_fkey):
--     sem índice algum além da PK em switch_name.
--
-- Os 532 avisos `unused_index` foram deliberadamente IGNORADOS: o sinal do advisor
-- baseia-se em estatísticas de uso recentes (reset de stats) e remover índices é
-- arriscado (pode degradar planos de consultas pouco frequentes mas importantes).
-- Os 6 `multiple_permissive_policies` são todos em system_kill_switches (tabela
-- minúscula, ganho de performance desprezível) e mexer em política de kill switch
-- é sensível em segurança — fora de escopo.

CREATE INDEX IF NOT EXISTS idx_collection_products_product_id
  ON public.collection_products (product_id);

CREATE INDEX IF NOT EXISTS idx_system_kill_switches_updated_by
  ON public.system_kill_switches (updated_by);
