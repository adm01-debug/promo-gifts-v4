-- Defense-in-depth: anon nao deve ter grants de escrita na tabela de governanca de badges.
-- Alinhamento com o padrao do projeto (ex.: public.products tem anon sem INSERT/UPDATE/DELETE).
-- A RLS ja bloqueia anon (policies de escrita exigem is_admin_or_above), mas remover o grant
-- elimina a dependencia exclusiva da RLS (se uma policy fosse afrouxada por engano, o grant
-- ausente ainda protege). SELECT permanece (leitura publica do catalogo, via policy pbd_public_read).
-- fix_version=pbd_v1_2_20260627
REVOKE INSERT, UPDATE, DELETE ON public.product_badge_definitions FROM anon;
