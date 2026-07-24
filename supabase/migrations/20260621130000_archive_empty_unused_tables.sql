-- Archive 6 empty public tables confirmed safe via 4-check safety gate:
-- (1) no active triggers reference them
-- (2) no cron job commands reference them
-- (3) no FK constraints from active public tables point to them
-- (4) no public function bodies reference them (verified via pg_get_functiondef scan)
-- All 6 tables have 0 rows and no current write activity.

ALTER TABLE public.colors SET SCHEMA archive;
ALTER TABLE public.sync_log SET SCHEMA archive;
ALTER TABLE public.ai_usage_logs SET SCHEMA archive;
ALTER TABLE public.category_mappings SET SCHEMA archive;
ALTER TABLE public.color_synonym_map SET SCHEMA archive;
ALTER TABLE public.image_import_log SET SCHEMA archive;
