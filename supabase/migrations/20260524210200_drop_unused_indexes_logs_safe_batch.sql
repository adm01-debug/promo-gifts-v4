-- Limpeza de índices não usados — LOTE SEGURO (colapso 2026-05-24, fase D).
--
-- Os performance advisors apontaram ~533 índices com idx_scan=0. Como
-- pg_stat_database.stats_reset é NULL (contadores acumulam desde a criação do
-- banco em 2026-01-02, ~5 meses), idx_scan=0 é um sinal confiável de "nunca usado".
--
-- ESCOPO DESTE LOTE (conservador): apenas índices em tabelas APPEND-ONLY de
-- log/auditoria/telemetria/staging/validação — onde um seq scan eventual é
-- inofensivo e o índice só adiciona custo de escrita/vacuum. Excluídos: únicos,
-- PK, índices que lastram constraint e índices que cobrem colunas de FK.
--
-- NÃO incluídos aqui (exigem revisão caso-a-caso — ver docs/RUNBOOK_COLAPSO):
-- índices de catálogo/lookup (products.slug/sku/ref, collections.share_token,
-- magic_up public shares token, etc.). Vários podem estar idx_scan=0 porque a
-- vitrine lê o catálogo do banco EXTERNO via external-db-bridge, mas dropá-los
-- às cegas arriscaria seq scans nas tabelas quentes — o oposto de aliviar carga.
--
-- Rollback: descomentar e rodar os CREATE INDEX no bloco ao final.

DROP INDEX IF EXISTS public."idx_ai_usage_logs_created_at";
DROP INDEX IF EXISTS public."idx_app_vitals_created";
DROP INDEX IF EXISTS public."idx_app_vitals_metric";
DROP INDEX IF EXISTS public."idx_audit_log_codigo";
DROP INDEX IF EXISTS public."idx_audit_logs_created_at";
DROP INDEX IF EXISTS public."idx_audit_logs_event_type";
DROP INDEX IF EXISTS public."idx_audit_logs_identifier";
DROP INDEX IF EXISTS public."idx_bot_detection_log_ip";
DROP INDEX IF EXISTS public."idx_cas_needs_review";
DROP INDEX IF EXISTS public."idx_cas_supplier_color";
DROP INDEX IF EXISTS public."idx_changelog_category";
DROP INDEX IF EXISTS public."idx_changelog_executed_at";
DROP INDEX IF EXISTS public."idx_conv_audit_session_id";
DROP INDEX IF EXISTS public."idx_conv_audit_user_id";
DROP INDEX IF EXISTS public."idx_ec_sync_log_connection_id";
DROP INDEX IF EXISTS public."idx_ec_sync_log_status";
DROP INDEX IF EXISTS public."idx_el_created";
DROP INDEX IF EXISTS public."idx_el_provider";
DROP INDEX IF EXISTS public."idx_file_scan_logs_result";
DROP INDEX IF EXISTS public."idx_hardening_snapshots_at";
DROP INDEX IF EXISTS public."idx_image_import_log_cloudflare";
DROP INDEX IF EXISTS public."idx_image_import_log_imported_brin";
DROP INDEX IF EXISTS public."idx_image_import_log_sku";
DROP INDEX IF EXISTS public."idx_image_import_log_source";
DROP INDEX IF EXISTS public."idx_image_validation_log_date";
DROP INDEX IF EXISTS public."idx_image_validation_log_status";
DROP INDEX IF EXISTS public."idx_mcp_violations_created";
DROP INDEX IF EXISTS public."idx_mcp_violations_ip_created";
DROP INDEX IF EXISTS public."idx_mcp_violations_user_created";
DROP INDEX IF EXISTS public."idx_media_sync_log_date";
DROP INDEX IF EXISTS public."idx_media_sync_log_status";
DROP INDEX IF EXISTS public."idx_media_sync_log_type";
DROP INDEX IF EXISTS public."idx_ownership_audit_reports_generated_at";
DROP INDEX IF EXISTS public."idx_ownership_repair_logs_created_at";
DROP INDEX IF EXISTS public."idx_ownership_repair_logs_report";
DROP INDEX IF EXISTS public."idx_product_sync_logs_created";
DROP INDEX IF EXISTS public."idx_product_sync_logs_source";
DROP INDEX IF EXISTS public."idx_query_telemetry_operation";
DROP INDEX IF EXISTS public."idx_query_telemetry_severity";
DROP INDEX IF EXISTS public."idx_rls_denial_created";
DROP INDEX IF EXISTS public."idx_rls_denial_table";
DROP INDEX IF EXISTS public."idx_rls_denial_user";
DROP INDEX IF EXISTS public."idx_sdl_drift";
DROP INDEX IF EXISTS public."idx_search_analytics_created_at";
DROP INDEX IF EXISTS public."idx_search_analytics_term_lower";
DROP INDEX IF EXISTS public."idx_search_analytics_zero_results";
DROP INDEX IF EXISTS public."idx_search_logs_date";
DROP INDEX IF EXISTS public."idx_search_logs_query";
DROP INDEX IF EXISTS public."idx_seo_audit_date";
DROP INDEX IF EXISTS public."idx_seo_audit_entity";
DROP INDEX IF EXISTS public."idx_seo_audit_recent";
DROP INDEX IF EXISTS public."idx_sm_stg_sku";
DROP INDEX IF EXISTS public."idx_sm_stg_status_part";
DROP INDEX IF EXISTS public."idx_snapshots_change_type";
DROP INDEX IF EXISTS public."idx_staging_batch";
DROP INDEX IF EXISTS public."idx_staging_codigo";
DROP INDEX IF EXISTS public."idx_staging_exists";
DROP INDEX IF EXISTS public."idx_staging_pending";
DROP INDEX IF EXISTS public."idx_staging_product";
DROP INDEX IF EXISTS public."idx_staging_sku";
DROP INDEX IF EXISTS public."idx_staging_status";
DROP INDEX IF EXISTS public."idx_staging_supplier";
DROP INDEX IF EXISTS public."idx_step_up_audit_action";
DROP INDEX IF EXISTS public."idx_step_up_audit_user";
DROP INDEX IF EXISTS public."idx_video_validation_log_date";
DROP INDEX IF EXISTS public."idx_video_validation_log_video";
DROP INDEX IF EXISTS public."idx_voice_command_logs_user_created";

-- ============================================================
-- ROLLBACK (descomentar para recriar):
-- CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs USING btree (created_at DESC);
-- CREATE INDEX idx_app_vitals_created ON public.app_vitals USING btree (created_at DESC);
-- CREATE INDEX idx_app_vitals_metric ON public.app_vitals USING btree (metric_name, created_at DESC);
-- CREATE INDEX idx_audit_log_codigo ON public.audit_log_gravacao USING btree (codigo_tabela, ts DESC);
-- CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);
-- CREATE INDEX idx_audit_logs_event_type ON public.audit_logs USING btree (event_type);
-- CREATE INDEX idx_audit_logs_identifier ON public.audit_logs USING btree (identifier);
-- CREATE INDEX idx_bot_detection_log_ip ON public.bot_detection_log USING btree (ip_address);
-- CREATE INDEX idx_cas_needs_review ON public.color_analysis_staging USING btree (needs_review) WHERE (needs_review = true);
-- CREATE INDEX idx_cas_supplier_color ON public.color_analysis_staging USING btree (supplier_color_name);
-- CREATE INDEX idx_changelog_category ON public.system_changelog USING btree (category);
-- CREATE INDEX idx_changelog_executed_at ON public.system_changelog USING btree (executed_at DESC);
-- CREATE INDEX idx_conv_audit_session_id ON public.conversation_audit_logs USING btree (session_id);
-- CREATE INDEX idx_conv_audit_user_id ON public.conversation_audit_logs USING btree (user_id);
-- CREATE INDEX idx_ec_sync_log_connection_id ON public.external_connections_sync_log USING btree (connection_id);
-- CREATE INDEX idx_ec_sync_log_status ON public.external_connections_sync_log USING btree (status, started_at DESC);
-- CREATE INDEX idx_el_created ON public.enrichment_log USING btree (created_at);
-- CREATE INDEX idx_el_provider ON public.enrichment_log USING btree (provider_name);
-- CREATE INDEX idx_file_scan_logs_result ON public.file_scan_logs USING btree (scan_result, created_at DESC);
-- CREATE INDEX idx_hardening_snapshots_at ON public.hardening_health_snapshots USING btree (snapshot_at DESC);
-- CREATE INDEX idx_image_import_log_cloudflare ON public.image_import_log USING btree (cloudflare_image_id);
-- CREATE INDEX idx_image_import_log_imported_brin ON public.image_import_log USING brin (imported_at);
-- CREATE INDEX idx_image_import_log_sku ON public.image_import_log USING btree (parsed_sku);
-- CREATE INDEX idx_image_import_log_source ON public.image_import_log USING btree (source_type);
-- CREATE INDEX idx_image_validation_log_date ON public.image_validation_log USING btree (validated_at DESC);
-- CREATE INDEX idx_image_validation_log_status ON public.image_validation_log USING btree (validation_status);
-- CREATE INDEX idx_mcp_violations_created ON public.mcp_access_violations USING btree (created_at DESC);
-- CREATE INDEX idx_mcp_violations_ip_created ON public.mcp_access_violations USING btree (ip_address, created_at DESC);
-- CREATE INDEX idx_mcp_violations_user_created ON public.mcp_access_violations USING btree (user_id, created_at DESC);
-- CREATE INDEX idx_media_sync_log_date ON public.media_sync_log USING btree (created_at DESC);
-- CREATE INDEX idx_media_sync_log_status ON public.media_sync_log USING btree (status);
-- CREATE INDEX idx_media_sync_log_type ON public.media_sync_log USING btree (sync_type, media_type);
-- CREATE INDEX idx_ownership_audit_reports_generated_at ON public.ownership_audit_reports USING btree (generated_at DESC);
-- CREATE INDEX idx_ownership_repair_logs_created_at ON public.ownership_repair_logs USING btree (created_at DESC);
-- CREATE INDEX idx_ownership_repair_logs_report ON public.ownership_repair_logs USING btree (report_id);
-- CREATE INDEX idx_product_sync_logs_created ON public.product_sync_logs USING btree (created_at DESC);
-- CREATE INDEX idx_product_sync_logs_source ON public.product_sync_logs USING btree (source, status);
-- CREATE INDEX idx_query_telemetry_operation ON public.query_telemetry USING btree (operation, created_at DESC);
-- CREATE INDEX idx_query_telemetry_severity ON public.query_telemetry USING btree (severity, created_at DESC) WHERE (severity = ANY (ARRAY['slow'::text, 'error'::text, 'critical'::text]));
-- CREATE INDEX idx_rls_denial_created ON public.rls_denial_log USING btree (created_at DESC);
-- CREATE INDEX idx_rls_denial_table ON public.rls_denial_log USING btree (table_name, created_at DESC);
-- CREATE INDEX idx_rls_denial_user ON public.rls_denial_log USING btree (user_id, created_at DESC);
-- CREATE INDEX idx_sdl_drift ON public.schema_drift_log USING btree (has_drift, ran_at DESC) WHERE (has_drift = true);
-- CREATE INDEX idx_search_analytics_created_at ON public.search_analytics USING btree (created_at DESC);
-- CREATE INDEX idx_search_analytics_term_lower ON public.search_analytics USING btree (lower(search_term));
-- CREATE INDEX idx_search_analytics_zero_results ON public.search_analytics USING btree (created_at DESC) WHERE (results_count = 0);
-- CREATE INDEX idx_search_logs_date ON public.product_search_logs USING btree (created_at DESC);
-- CREATE INDEX idx_search_logs_query ON public.product_search_logs USING btree (query);
-- CREATE INDEX idx_seo_audit_date ON public.seo_audit_log USING btree (audited_at DESC);
-- CREATE INDEX idx_seo_audit_entity ON public.seo_audit_log USING btree (entity_type, entity_id);
-- CREATE INDEX idx_seo_audit_recent ON public.seo_audit_log USING btree (entity_type, entity_id, audited_at DESC);
-- CREATE INDEX idx_sm_stg_sku ON public.sm_images_staging USING btree (sku);
-- CREATE INDEX idx_sm_stg_status_part ON public.sm_images_staging USING btree (status, partition_id);
-- CREATE INDEX idx_snapshots_change_type ON public.stock_snapshots USING btree (change_type, captured_at DESC);
-- CREATE INDEX idx_staging_batch ON public.import_staging_images USING btree (batch_id);
-- CREATE INDEX idx_staging_codigo ON public.xbz_gallery_staging USING btree (codigo_amigavel);
-- CREATE INDEX idx_staging_exists ON public.scraper_images_staging USING btree (exists_in_db);
-- CREATE INDEX idx_staging_pending ON public.import_staging_images USING btree (status) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'extracted'::character varying, 'uploaded'::character varying])::text[]));
-- CREATE INDEX idx_staging_product ON public.import_staging_images USING btree (product_id);
-- CREATE INDEX idx_staging_sku ON public.import_staging_images USING btree (parsed_sku);
-- CREATE INDEX idx_staging_status ON public.xbz_gallery_staging USING btree (status);
-- CREATE INDEX idx_staging_supplier ON public.scraper_images_staging USING btree (supplier_id);
-- CREATE INDEX idx_step_up_audit_action ON public.step_up_audit_log USING btree (action, created_at DESC);
-- CREATE INDEX idx_step_up_audit_user ON public.step_up_audit_log USING btree (user_id, created_at DESC);
-- CREATE INDEX idx_video_validation_log_date ON public.video_validation_log USING btree (validated_at DESC);
-- CREATE INDEX idx_video_validation_log_video ON public.video_validation_log USING btree (video_id);
-- CREATE INDEX idx_voice_command_logs_user_created ON public.voice_command_logs USING btree (user_id, created_at DESC);
-- ============================================================
