-- fix_version: synced_to_bitrix_notnull_v1
-- ANTI-REGRESSION: substitui 20260626112309_438248d2-913a-4120-9c7b-d5fc70476f6a.sql
-- (UUID gerado pelo Lovable, removido em 2026-06-27).
UPDATE public.quotes SET synced_to_bitrix = false WHERE synced_to_bitrix IS NULL;
ALTER TABLE public.quotes ALTER COLUMN synced_to_bitrix SET DEFAULT false;
ALTER TABLE public.quotes ALTER COLUMN synced_to_bitrix SET NOT NULL;
