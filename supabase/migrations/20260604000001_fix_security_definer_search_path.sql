-- Migration: Fix SECURITY DEFINER functions missing SET search_path
-- Issue: soft_delete_record, restore_record e permanent_delete_record foram criados
-- sem SET search_path, tornando-os vulneráveis a search_path injection se o schema
-- for comprometido (um atacante poderia criar funções shadow em outros schemas).
-- Todos os SECURITY DEFINER devem ter search_path fixo como defesa em profundidade.
-- CI Gate: check:security-definer-acl verifica esta propriedade em todos os deploys.

CREATE OR REPLACE FUNCTION public.soft_delete_record(
    p_table_name TEXT,
    p_record_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_sql TEXT;
    v_rows_affected INT;
BEGIN
    IF p_table_name NOT IN ('products', 'clients', 'suppliers', 'quotes', 'orders', 'collections', 'categories') THEN
        RAISE EXCEPTION 'Invalid table name: %', p_table_name;
    END IF;

    v_sql := format(
        'UPDATE public.%I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
        p_table_name
    );

    EXECUTE v_sql USING p_record_id;
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    RETURN v_rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.soft_delete_record IS 'Marca um registro como deletado (soft delete). SECURITY DEFINER com search_path fixo.';

CREATE OR REPLACE FUNCTION public.restore_record(
    p_table_name TEXT,
    p_record_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_sql TEXT;
    v_rows_affected INT;
BEGIN
    IF p_table_name NOT IN ('products', 'clients', 'suppliers', 'quotes', 'orders', 'collections', 'categories') THEN
        RAISE EXCEPTION 'Invalid table name: %', p_table_name;
    END IF;

    v_sql := format(
        'UPDATE public.%I SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
        p_table_name
    );

    EXECUTE v_sql USING p_record_id;
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    RETURN v_rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.restore_record IS 'Restaura um registro deletado. SECURITY DEFINER com search_path fixo.';

CREATE OR REPLACE FUNCTION public.permanent_delete_record(
    p_table_name TEXT,
    p_record_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_sql TEXT;
    v_rows_affected INT;
BEGIN
    IF p_table_name NOT IN ('products', 'clients', 'suppliers', 'quotes', 'orders', 'collections', 'categories') THEN
        RAISE EXCEPTION 'Invalid table name: %', p_table_name;
    END IF;

    v_sql := format(
        'DELETE FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL',
        p_table_name
    );

    EXECUTE v_sql USING p_record_id;
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    RETURN v_rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.permanent_delete_record IS 'Deleta permanentemente um registro soft-deleted. SECURITY DEFINER com search_path fixo.';

-- Restrict EXECUTE to service_role only.
-- By default, PUBLIC (including anon/authenticated) can call any function; these
-- SECURITY DEFINER functions must not be callable by end users via PostgREST.
REVOKE EXECUTE ON FUNCTION public.soft_delete_record(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(TEXT, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.restore_record(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_record(TEXT, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.permanent_delete_record(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.permanent_delete_record(TEXT, UUID) TO service_role;
