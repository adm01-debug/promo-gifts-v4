-- =============================================================================
-- Bootstrap de pre-requisitos para REPLAY LIMPO (supabase db reset / preview).
-- =============================================================================
-- Contexto: a producao ja contem estes objetos (extensao + tabelas staging
-- orfas), mas eles NUNCA foram criados por uma migration. Num replay a partir
-- do repo (db reset), arquivos historicos byte-exatos posteriores falham:
--   * 20260604141743 usa moddatetime() sem CREATE EXTENSION previo.
--   * 20260605004956 faz REVOKE nas tabelas *_staging que nenhuma migration cria.
-- Esta migration roda ANTES desses arquivos para que o replay conclua.
--
-- 100% idempotente / prod-safe: na producao todo statement aqui e no-op
-- (IF NOT EXISTS), entao nenhum objeto existente e alterado. So tem efeito
-- num banco construido do zero a partir do repo.
--
-- CAVEAT (aceito): por rodar cedo (timestamp anterior a migrations ja aplicadas
-- na prod), um `supabase db push` pode reportar migration fora de ordem; use
-- `--include-all` ou marque-a como aplicada. Nao corrige o gap de ordenacao da
-- view somarcas_catalogo_publico (ALTER 012421 antes do CREATE 012555), que
-- depende de colunas de supplier_products_raw e fica como gap conhecido.
-- =============================================================================

-- (1) Extensao moddatetime: necessaria pelos triggers updated_at de
--     supplier_price_tiers / product_physical (20260604141743).
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- (2) Tabelas staging "irmas" orfas: existem na prod, sem migration de criacao.
--     Stubs minimos para que os REVOKE de 20260605004956 nao quebrem o replay.
--     Schema real vive na prod; aqui so garantimos existencia (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS public._asia_api_staging       (id bigint);
CREATE TABLE IF NOT EXISTS public.import_staging_images   (id bigint);
CREATE TABLE IF NOT EXISTS public.color_analysis_staging  (id bigint);
CREATE TABLE IF NOT EXISTS public.xbz_gallery_staging     (id bigint);
CREATE TABLE IF NOT EXISTS public.scraper_images_staging  (id bigint);
CREATE TABLE IF NOT EXISTS public.sm_images_staging       (id bigint);
