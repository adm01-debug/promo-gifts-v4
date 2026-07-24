-- Enforça invariante de multi-tenancy: toda quote pertence a uma organização.
-- organization_id é usada em 4 RLS policies; o WITH CHECK de insert (user_is_org_member(organization_id))
-- é ANDed em TODO insert, logo o RLS já exige org não-nula para inserts via PostgREST/authenticated.
-- create_quote_transactional seta organization_id; 0 nulos no histórico; SET NOT NULL validou em full scan (attnotnull=true).
-- Elimina edge-cases de isolamento de tenancy (quote órfã sem organização, invisível/vazável no RLS).
-- (created_by deliberadamente NÃO recebe NOT NULL: sem default e não setado pela função canônica => seria landmine.)
ALTER TABLE public.quotes ALTER COLUMN organization_id SET NOT NULL;
