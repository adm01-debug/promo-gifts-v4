-- content_hash era GENERATED ALWAYS (hash cheio de raw_data) — impossibilitava
-- hash canônico com exclusão de campos voláteis (expressão gerada não pode ler
-- supplier_settings) e tornava a atribuição do trigger CÓDIGO MORTO desde sempre.
-- Converte para coluna comum mantida por fn_spr_before_write.
ALTER TABLE public.supplier_products_raw
  ALTER COLUMN content_hash DROP EXPRESSION;

COMMENT ON COLUMN public.supplier_products_raw.content_hash IS
  'sha256 canônico do payload: raw_data sem chaves de metadado (prefixo _) e sem supplier_settings.hash_excluded_fields. Mantido por fn_spr_before_write (BEFORE INSERT/UPDATE). NÃO é mais coluna gerada.';

-- Pós-migração executado em lotes (one-shot, fora da migração):
--   1. remoção de '_ruiz_sync_at' e coerção numérica de PrecoVenda/IpiTaxa/
--      VendaMinima/Multiplos/IdProduto/Quantidade* em 11.415 linhas XBZ
--   2. recálculo do hash canônico das 18.427 linhas (toque no-op com
--      trg_spr_history desabilitado durante a janela)
