-- Enforça invariante de integridade/segurança: toda quote tem dono (seller_id é a coluna de escopo do RLS,
-- usada em quotes_select_scope e quotes_update_scope). O WITH CHECK da policy de insert
-- (is_coord_or_above(auth.uid()) OR seller_id = auth.uid()) NÃO garante seller_id não-nulo para coordenadores
-- (curto-circuito no primeiro ramo), portanto a constraint NOT NULL é a proteção correta no nível do banco.
-- create_quote_transactional sempre seta seller_id (de auth.uid()); 0 nulos em todo o histórico;
-- SET NOT NULL validou em full scan (dry-run: attnotnull=true). NULL passa a ser impossível em qualquer INSERT/UPDATE.
ALTER TABLE public.quotes ALTER COLUMN seller_id SET NOT NULL;
