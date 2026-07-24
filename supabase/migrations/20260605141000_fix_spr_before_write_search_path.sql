-- fn_spr_before_write usa encode(digest(...),'sha256') do pgcrypto, mas a extensão
-- pgcrypto está no schema 'extensions' (padrão Supabase). Com SET search_path TO 'public'
-- a função não enxerga digest() → falha em qualquer UPDATE na tabela.
--
-- Todos os 16.509 content_hash existentes já são sha256 (64 chars); mudar para md5
-- tornaria todos os hashes incomparáveis → qualquer UPDATE dispararia history desnecessário.
-- Solução: incluir 'extensions' no search_path (read-only, só contém funções de extensão).

ALTER FUNCTION public.fn_spr_before_write()
  SET search_path TO 'public', 'extensions';
