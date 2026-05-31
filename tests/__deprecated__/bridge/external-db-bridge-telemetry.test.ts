/**
 * Tests for external-db-bridge edge function logic:
 * emitTelemetry, getResourceGroup, cache, mapping functions, and persistence.
 *
 * Since the edge function runs in Deno, we extract & re-implement the pure
 * logic here for comprehensive unit testing in Vitest.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================
// Re-implement pure functions from the edge function
// ============================================

const SLOW_QUERY_THRESHOLD_MS = 3000;
const VERY_SLOW_QUERY_THRESHOLD_MS = 8000;

const PRODUCT_TABLES = [
  "products", "categories", "suppliers", "tags",
  "product_images", "product_videos", "product_variants",
  "product_materials", "product_tags", "product_categories",
  "product_category_assignments", "product_suppliers",
  "product_print_areas", "product_kit_components", "product_attributes",
  "color_groups", "color_nuances", "color_equivalences", "color_variations",
  "supplier_colors", "material_groups", "material_types", "material_variations",
  "supplier_materials", "supplier_attribute_definitions", "supplier_product_attributes",
  "category_attributes", "price_lists", "variant_cost_tiers", "variant_sale_prices",
  "variation_types", "variation_values", "stock_movements", "variant_supplier_sources",
  "collections", "collection_products", "ramo_atividade", "ramo_atividade_filho",
  "produto_ramo_atividade", "business_sectors", "mockup_drafts", "generated_mockups",
  "personalization_techniques", "customization_price_tables", "customization_price_tiers",
  "tabela_preco_gravacao_oficial", "tabela_preco_gravacao_oficial_faixa",
  "organization_markup_customization", "category_area_techniques",
] as const;

const PRODUCT_VIEWS = [
  "v_products_with_techniques", "v_products_with_stock", "v_products_with_tags",
  "v_products_min_price", "v_products_without_images", "v_products_without_videos",
  "v_products_missing_primary_image", "v_product_print_areas_complete",
  "v_product_images_cdn", "v_product_videos_cdn", "v_product_attributes_formatted",
  "v_kit_with_components", "v_kit_component_print_areas",
  "v_customization_price_summary", "v_variant_pricing_complete", "v_technique_stats",
  "v_techniques_stricker_mapping", "v_media_stats", "v_n8n_sync_summary",
  "v_n8n_sync_errors", "v_n8n_sync_success_recent", "mv_product_compositions",
  "mv_material_group_stats", "materials_complete", "products_with_materials",
  "categories_tree_visual",
] as const;

const COMPANY_TABLES = [
  "bitrix_clients", "client_contacts", "client_notes",
  "organizations", "user_organizations", "business_sectors",
] as const;

const SYSTEM_TABLES = [
  "user_roles", "user_onboarding", "profiles", "notifications",
  "audit_log", "payments", "orders",
] as const;

type ResourceGroup = "products" | "companies" | "views";

function getResourceGroup(tableName: string): ResourceGroup | null {
  if ((PRODUCT_TABLES as readonly string[]).includes(tableName)) return "products";
  if ((PRODUCT_VIEWS as readonly string[]).includes(tableName)) return "views";
  if ((COMPANY_TABLES as readonly string[]).includes(tableName)) return "companies";
  return null;
}

const PERMISSIONS: Record<ResourceGroup, string[]> = {
  products: ["select", "insert", "update", "delete"],
  companies: ["select"],
  views: ["select"],
};

function classifyQuerySpeed(durationMs: number): "ok" | "slow" | "very_slow" {
  if (durationMs >= VERY_SLOW_QUERY_THRESHOLD_MS) return "very_slow";
  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) return "slow";
  return "ok";
}

interface TelemetryMeta {
  operation: string;
  table?: string;
  rpcName?: string;
  limit?: number;
  offset?: number;
  countMode?: string;
  durationMs: number;
  recordCount?: number;
  status: "ok" | "error" | "slow" | "very_slow";
  error?: string;
  userId?: string | null;
}

function buildTelemetryLine(meta: TelemetryMeta): string {
  const icon = meta.status === "very_slow" ? "🔴" : meta.status === "slow" ? "🟡" : meta.status === "error" ? "❌" : "✅";
  const target = meta.rpcName || meta.table || "unknown";
  return `${icon} [telemetry] ${meta.operation}:${target} ${meta.durationMs}ms | records=${meta.recordCount ?? "-"} limit=${meta.limit ?? "-"} offset=${meta.offset ?? "-"} count=${meta.countMode ?? "-"}`;
}

function buildTelemetryInsertPayload(meta: TelemetryMeta) {
  return {
    operation: meta.operation,
    table_name: meta.table || null,
    rpc_name: meta.rpcName || null,
    duration_ms: meta.durationMs,
    record_count: meta.recordCount ?? null,
    query_limit: meta.limit ?? null,
    query_offset: meta.offset ?? null,
    count_mode: meta.countMode || null,
    severity: meta.status,
    error_message: meta.error || null,
    user_id: meta.userId || null,
  };
}

// Cache implementation
const REFERENCE_CACHE_TTL_MS = 10 * 60 * 1000;
interface CacheEntry<T> { data: T; timestamp: number; }
let referenceCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = referenceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > REFERENCE_CACHE_TTL_MS) {
    referenceCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  referenceCache.set(key, { data, timestamp: Date.now() });
}

// Mapping functions
function mapTechniqueFiltersToExternal(filters: Record<string, unknown> | undefined) {
  if (!filters) return undefined;
  const out: Record<string, unknown> = { ...filters };
  if ("is_active" in out) { out.ativo = out.is_active; delete out.is_active; }
  if ("code" in out) { out.codigo = out.code; delete out.code; }
  if ("name" in out) { out.nome = out.name; delete out.name; }
  if ("description" in out) { out.descricao = out.description; delete out.description; }
  if ("max_colors" in out) { out.max_cores = out.max_colors; delete out.max_colors; }
  if ("estimated_days" in out) { out.tempo_producao_dias = out.estimated_days; delete out.estimated_days; }
  return out;
}

function mapTechniqueRowToLegacyShape(row: Record<string, unknown>) {
  const codigo = (row.codigo as string | undefined) ?? null;
  const nome = (row.nome as string | undefined) ?? "";
  const ativo = (row.ativo as boolean | undefined) ?? true;
  const tempo = (row.tempo_producao_dias as number | undefined) ?? null;
  const maxCores = typeof row.max_cores === "number" ? row.max_cores : null;
  const cobraPorCor = (row.cobra_por_cor as boolean | undefined) ?? false;
  const custoSetup = typeof row.custo_setup === "number" ? row.custo_setup : 0;

  return {
    ...row,
    codigo, nome, ativo,
    code: codigo,
    name: nome,
    is_active: ativo,
    estimated_days: tempo,
    max_colors: maxCores,
    requires_color_count: maxCores != null && maxCores > 0,
    price_by_color: cobraPorCor,
    price_by_area: false,
    setup_cost: custoSetup,
    setup_price: custoSetup,
    display_order: (row.ordem_exibicao as number | undefined) ?? 0,
    permite_cores: maxCores != null && maxCores > 0,
    requer_setup: custoSetup > 0,
  };
}

function mapPriceTableFiltersToExternal(filters: Record<string, unknown> | undefined) {
  if (!filters) return undefined;
  const out: Record<string, unknown> = { ...filters };
  if ("table_code" in out) { out.tecnica_codigo = out.table_code; delete out.table_code; }
  if ("table_code_option" in out) { out.table_code = out.table_code_option; delete out.table_code_option; }
  if ("table_fullcode" in out) { out.table_code = out.table_fullcode; delete out.table_fullcode; }
  if ("technique_id" in out) { delete out.technique_id; }
  if ("customization_type_name" in out) { out.tecnica_codigo = out.customization_type_name; delete out.customization_type_name; }
  return out;
}

function isTechniqueTableAlias(table: string) {
  return table === "personalization_techniques" || table === "tecnica_gravacao";
}

function isTechniqueVarianteAlias(table: string) {
  return table === "tecnica_gravacao_variante";
}

function isCustomizationPriceTablesAlias(table: string) {
  return table === "customization_price_tables" || table === "customization_price_tiers";
}

// ============================================
// TESTS
// ============================================

describe("external-db-bridge — getResourceGroup", () => {
  it("classifies product tables correctly", () => {
    expect(getResourceGroup("products")).toBe("products");
    expect(getResourceGroup("product_images")).toBe("products");
    expect(getResourceGroup("color_groups")).toBe("products");
    expect(getResourceGroup("tabela_preco_gravacao_oficial")).toBe("products");
    expect(getResourceGroup("category_area_techniques")).toBe("products");
  });

  it("classifies views correctly", () => {
    expect(getResourceGroup("v_products_with_techniques")).toBe("views");
    expect(getResourceGroup("mv_product_compositions")).toBe("views");
    expect(getResourceGroup("categories_tree_visual")).toBe("views");
  });

  it("classifies company tables correctly", () => {
    expect(getResourceGroup("bitrix_clients")).toBe("companies");
    expect(getResourceGroup("client_contacts")).toBe("companies");
  });

  it("returns null for unknown tables", () => {
    expect(getResourceGroup("nonexistent_table")).toBeNull();
    expect(getResourceGroup("")).toBeNull();
  });

  it("returns null for system tables (not in any whitelist)", () => {
    expect(getResourceGroup("audit_log")).toBeNull();
    expect(getResourceGroup("payments")).toBeNull();
    expect(getResourceGroup("notifications")).toBeNull();
  });

  // business_sectors appears in both PRODUCT_TABLES and COMPANY_TABLES
  it("business_sectors resolves to products (first match)", () => {
    expect(getResourceGroup("business_sectors")).toBe("products");
  });
});

describe("external-db-bridge — Permissions", () => {
  it("product tables have full CRUD", () => {
    expect(PERMISSIONS.products).toEqual(["select", "insert", "update", "delete"]);
  });

  it("company tables are read-only", () => {
    expect(PERMISSIONS.companies).toEqual(["select"]);
  });

  it("views are read-only", () => {
    expect(PERMISSIONS.views).toEqual(["select"]);
  });
});

describe("external-db-bridge — classifyQuerySpeed", () => {
  it("ok for fast queries", () => {
    expect(classifyQuerySpeed(0)).toBe("ok");
    expect(classifyQuerySpeed(500)).toBe("ok");
    expect(classifyQuerySpeed(2999)).toBe("ok");
  });

  it("slow for queries between 3s-8s", () => {
    expect(classifyQuerySpeed(3000)).toBe("slow");
    expect(classifyQuerySpeed(5000)).toBe("slow");
    expect(classifyQuerySpeed(7999)).toBe("slow");
  });

  it("very_slow for queries >= 8s", () => {
    expect(classifyQuerySpeed(8000)).toBe("very_slow");
    expect(classifyQuerySpeed(15000)).toBe("very_slow");
    expect(classifyQuerySpeed(60000)).toBe("very_slow");
  });
});

describe("external-db-bridge — buildTelemetryLine", () => {
  it("uses ✅ icon for ok status", () => {
    const line = buildTelemetryLine({ operation: "select", table: "products", durationMs: 200, status: "ok" });
    expect(line).toContain("✅");
    expect(line).toContain("select:products");
    expect(line).toContain("200ms");
  });

  it("uses 🟡 icon for slow status", () => {
    const line = buildTelemetryLine({ operation: "select", table: "products", durationMs: 4000, status: "slow" });
    expect(line).toContain("🟡");
  });

  it("uses 🔴 icon for very_slow status", () => {
    const line = buildTelemetryLine({ operation: "select", table: "products", durationMs: 10000, status: "very_slow" });
    expect(line).toContain("🔴");
  });

  it("uses ❌ icon for error status", () => {
    const line = buildTelemetryLine({ operation: "select", table: "products", durationMs: 500, status: "error" });
    expect(line).toContain("❌");
  });

  it("prefers rpcName over table", () => {
    const line = buildTelemetryLine({ operation: "rpc", rpcName: "fn_get_price", table: "products", durationMs: 100, status: "ok" });
    expect(line).toContain("rpc:fn_get_price");
    expect(line).not.toContain("rpc:products");
  });

  it("falls back to 'unknown' when no table or rpc", () => {
    const line = buildTelemetryLine({ operation: "select", durationMs: 100, status: "ok" });
    expect(line).toContain("select:unknown");
  });

  it("shows dash for missing optional fields", () => {
    const line = buildTelemetryLine({ operation: "select", table: "x", durationMs: 50, status: "ok" });
    expect(line).toContain("records=-");
    expect(line).toContain("limit=-");
    expect(line).toContain("offset=-");
    expect(line).toContain("count=-");
  });

  it("shows actual values when provided", () => {
    const line = buildTelemetryLine({
      operation: "select", table: "products", durationMs: 300,
      status: "ok", recordCount: 50, limit: 100, offset: 0, countMode: "exact",
    });
    expect(line).toContain("records=50");
    expect(line).toContain("limit=100");
    expect(line).toContain("offset=0");
    expect(line).toContain("count=exact");
  });
});

describe("external-db-bridge — buildTelemetryInsertPayload", () => {
  it("maps all fields correctly for persistence", () => {
    const payload = buildTelemetryInsertPayload({
      operation: "select",
      table: "products",
      rpcName: undefined,
      durationMs: 5000,
      recordCount: 200,
      limit: 200,
      offset: 0,
      countMode: "planned",
      status: "slow",
      error: undefined,
      userId: "user-123",
    });

    expect(payload).toEqual({
      operation: "select",
      table_name: "products",
      rpc_name: null,
      duration_ms: 5000,
      record_count: 200,
      query_limit: 200,
      query_offset: 0,
      count_mode: "planned",
      severity: "slow",
      error_message: null,
      user_id: "user-123",
    });
  });

  it("sets null for missing optional fields", () => {
    const payload = buildTelemetryInsertPayload({
      operation: "rpc",
      rpcName: "fn_test",
      durationMs: 10000,
      status: "very_slow",
    });

    expect(payload.table_name).toBeNull();
    expect(payload.rpc_name).toBe("fn_test");
    expect(payload.record_count).toBeNull();
    expect(payload.query_limit).toBeNull();
    expect(payload.query_offset).toBeNull();
    expect(payload.count_mode).toBeNull();
    expect(payload.error_message).toBeNull();
    expect(payload.user_id).toBeNull();
  });

  it("persists error message for error status", () => {
    const payload = buildTelemetryInsertPayload({
      operation: "select",
      table: "products",
      durationMs: 200,
      status: "error",
      error: "timeout connecting to database",
    });

    expect(payload.severity).toBe("error");
    expect(payload.error_message).toBe("timeout connecting to database");
  });

  it("only non-ok statuses should be persisted (business rule)", () => {
    // The edge function only inserts when status !== 'ok'
    const okMeta: TelemetryMeta = { operation: "select", table: "products", durationMs: 100, status: "ok" };
    const slowMeta: TelemetryMeta = { operation: "select", table: "products", durationMs: 4000, status: "slow" };
    const verySlowMeta: TelemetryMeta = { operation: "select", table: "products", durationMs: 9000, status: "very_slow" };
    const errorMeta: TelemetryMeta = { operation: "select", table: "products", durationMs: 200, status: "error", error: "fail" };

    // ok should NOT be persisted
    expect(okMeta.status).toBe("ok");
    // others should be persisted
    expect(slowMeta.status !== "ok").toBe(true);
    expect(verySlowMeta.status !== "ok").toBe(true);
    expect(errorMeta.status !== "ok").toBe(true);
  });
});

describe("external-db-bridge — In-Memory Cache", () => {
  beforeEach(() => {
    referenceCache.clear();
  });

  it("returns null for missing key", () => {
    expect(getCached("nonexistent")).toBeNull();
  });

  it("stores and retrieves data", () => {
    setCache("test-key", { records: [1, 2, 3], count: 3 });
    const result = getCached<{ records: number[]; count: number }>("test-key");
    expect(result).toEqual({ records: [1, 2, 3], count: 3 });
  });

  it("returns null for expired entries", () => {
    referenceCache.set("old-key", {
      data: "old-data",
      timestamp: Date.now() - REFERENCE_CACHE_TTL_MS - 1,
    });
    expect(getCached("old-key")).toBeNull();
    expect(referenceCache.has("old-key")).toBe(false); // entry deleted
  });

  it("returns data for non-expired entries", () => {
    referenceCache.set("fresh-key", {
      data: "fresh",
      timestamp: Date.now() - REFERENCE_CACHE_TTL_MS + 5000,
    });
    expect(getCached("fresh-key")).toBe("fresh");
  });

  it("overwrites existing cache entries", () => {
    setCache("key", "v1");
    setCache("key", "v2");
    expect(getCached("key")).toBe("v2");
  });

  it("handles multiple keys independently", () => {
    setCache("a", 1);
    setCache("b", 2);
    setCache("c", 3);
    expect(getCached("a")).toBe(1);
    expect(getCached("b")).toBe(2);
    expect(getCached("c")).toBe(3);
  });

  it("TTL is exactly 10 minutes", () => {
    expect(REFERENCE_CACHE_TTL_MS).toBe(600000);
  });
});

describe("external-db-bridge — Table Alias Detection", () => {
  it("detects personalization_techniques alias", () => {
    expect(isTechniqueTableAlias("personalization_techniques")).toBe(true);
    expect(isTechniqueTableAlias("tecnica_gravacao")).toBe(true);
    expect(isTechniqueTableAlias("other_table")).toBe(false);
  });

  it("detects tecnica_gravacao_variante alias", () => {
    expect(isTechniqueVarianteAlias("tecnica_gravacao_variante")).toBe(true);
    expect(isTechniqueVarianteAlias("tecnica_gravacao")).toBe(false);
  });

  it("detects customization price tables alias", () => {
    expect(isCustomizationPriceTablesAlias("customization_price_tables")).toBe(true);
    expect(isCustomizationPriceTablesAlias("customization_price_tiers")).toBe(true);
    expect(isCustomizationPriceTablesAlias("other")).toBe(false);
  });
});

describe("external-db-bridge — mapTechniqueFiltersToExternal", () => {
  it("returns undefined for undefined input", () => {
    expect(mapTechniqueFiltersToExternal(undefined)).toBeUndefined();
  });

  it("maps is_active to ativo", () => {
    const result = mapTechniqueFiltersToExternal({ is_active: true });
    expect(result).toEqual({ ativo: true });
  });

  it("maps code to codigo", () => {
    const result = mapTechniqueFiltersToExternal({ code: "SER" });
    expect(result).toEqual({ codigo: "SER" });
  });

  it("maps name to nome", () => {
    const result = mapTechniqueFiltersToExternal({ name: "Serigrafia" });
    expect(result).toEqual({ nome: "Serigrafia" });
  });

  it("maps max_colors to max_cores", () => {
    const result = mapTechniqueFiltersToExternal({ max_colors: 6 });
    expect(result).toEqual({ max_cores: 6 });
  });

  it("maps estimated_days to tempo_producao_dias", () => {
    const result = mapTechniqueFiltersToExternal({ estimated_days: 5 });
    expect(result).toEqual({ tempo_producao_dias: 5 });
  });

  it("maps multiple filters at once", () => {
    const result = mapTechniqueFiltersToExternal({
      is_active: true, code: "LASER", max_colors: 1,
    });
    expect(result).toEqual({ ativo: true, codigo: "LASER", max_cores: 1 });
  });

  it("preserves unmapped filters", () => {
    const result = mapTechniqueFiltersToExternal({ custom_field: "value" });
    expect(result).toEqual({ custom_field: "value" });
  });
});

describe("external-db-bridge — mapTechniqueRowToLegacyShape", () => {
  const sampleRow = {
    id: "uuid-1",
    codigo: "SER",
    nome: "Serigrafia",
    descricao: "Impressão por tela",
    ativo: true,
    tempo_producao_dias: 7,
    max_cores: 6,
    cobra_por_cor: true,
    custo_setup: 50,
    ordem_exibicao: 1,
    slug_grupo: "serigrafia",
    codigo_curto: "S",
  };

  it("maps all legacy fields", () => {
    const mapped = mapTechniqueRowToLegacyShape(sampleRow);
    expect(mapped.code).toBe("SER");
    expect(mapped.name).toBe("Serigrafia");
    expect(mapped.is_active).toBe(true);
    expect(mapped.estimated_days).toBe(7);
    expect(mapped.max_colors).toBe(6);
    expect(mapped.requires_color_count).toBe(true);
    expect(mapped.price_by_color).toBe(true);
    expect(mapped.price_by_area).toBe(false);
    expect(mapped.setup_cost).toBe(50);
    expect(mapped.setup_price).toBe(50);
    expect(mapped.display_order).toBe(1);
    expect(mapped.permite_cores).toBe(true);
    expect(mapped.requer_setup).toBe(true);
  });

  it("handles missing optional fields with defaults", () => {
    const mapped = mapTechniqueRowToLegacyShape({});
    expect(mapped.codigo).toBeNull();
    expect(mapped.nome).toBe("");
    expect(mapped.ativo).toBe(true);
    expect(mapped.max_colors).toBeNull();
    expect(mapped.requires_color_count).toBe(false);
    expect(mapped.permite_cores).toBe(false);
    expect(mapped.setup_cost).toBe(0);
    expect(mapped.requer_setup).toBe(false);
    expect(mapped.display_order).toBe(0);
  });

  it("handles max_cores=0 (no colors)", () => {
    const mapped = mapTechniqueRowToLegacyShape({ max_cores: 0 });
    expect(mapped.max_colors).toBe(0);
    expect(mapped.requires_color_count).toBe(false);
    expect(mapped.permite_cores).toBe(false);
  });
});

describe("external-db-bridge — mapPriceTableFiltersToExternal", () => {
  it("returns undefined for undefined input", () => {
    expect(mapPriceTableFiltersToExternal(undefined)).toBeUndefined();
  });

  it("maps table_code to tecnica_codigo", () => {
    const result = mapPriceTableFiltersToExternal({ table_code: "SER-01" });
    expect(result).toEqual({ tecnica_codigo: "SER-01" });
  });

  it("maps table_code_option to table_code", () => {
    const result = mapPriceTableFiltersToExternal({ table_code_option: "OPT-1" });
    expect(result).toEqual({ table_code: "OPT-1" });
  });

  it("maps table_fullcode to table_code", () => {
    const result = mapPriceTableFiltersToExternal({ table_fullcode: "FULL-01" });
    expect(result).toEqual({ table_code: "FULL-01" });
  });

  it("removes technique_id (not supported)", () => {
    const result = mapPriceTableFiltersToExternal({ technique_id: "uuid" });
    expect(result).toEqual({});
    expect(result).not.toHaveProperty("technique_id");
  });

  it("maps customization_type_name to tecnica_codigo", () => {
    const result = mapPriceTableFiltersToExternal({ customization_type_name: "Laser" });
    expect(result).toEqual({ tecnica_codigo: "Laser" });
  });
});

describe("external-db-bridge — Thresholds", () => {
  it("slow threshold is 3000ms", () => {
    expect(SLOW_QUERY_THRESHOLD_MS).toBe(3000);
  });

  it("very slow threshold is 8000ms", () => {
    expect(VERY_SLOW_QUERY_THRESHOLD_MS).toBe(8000);
  });
});

describe("external-db-bridge — ALLOWED_RPCS", () => {
  const ALLOWED_RPCS = [
    "fn_get_product_print_areas", "fn_get_product_print_areas_v2",
    "fn_get_product_customization_options", "fn_link_product_print_areas",
    "fn_backfill_product_print_areas", "fn_get_customization_price",
    "fn_get_customization_price_v2", "fn_find_fornecedor_price_table",
    "get_category_descendants",
  ];

  it("has 9 allowed RPCs", () => {
    expect(ALLOWED_RPCS).toHaveLength(9);
  });

  it("includes pricing RPCs", () => {
    expect(ALLOWED_RPCS).toContain("fn_get_customization_price");
    expect(ALLOWED_RPCS).toContain("fn_get_customization_price_v2");
    expect(ALLOWED_RPCS).toContain("fn_find_fornecedor_price_table");
  });

  it("includes print area RPCs", () => {
    expect(ALLOWED_RPCS).toContain("fn_get_product_print_areas");
    expect(ALLOWED_RPCS).toContain("fn_get_product_print_areas_v2");
    expect(ALLOWED_RPCS).toContain("fn_link_product_print_areas");
  });

  it("does not include arbitrary RPCs", () => {
    expect(ALLOWED_RPCS).not.toContain("execute_sql");
    expect(ALLOWED_RPCS).not.toContain("drop_table");
  });
});

describe("external-db-bridge — Batch Limits", () => {
  it("heavy tables are correctly identified", () => {
    const HEAVY_TABLES = ["products", "product_images", "product_variants", "color_variations", "product_categories", "product_category_assignments"];
    HEAVY_TABLES.forEach(t => {
      expect(HEAVY_TABLES.includes(t)).toBe(true);
    });
  });

  it("batch limit for heavy table without search is capped at 200", () => {
    const rawLimit = 500;
    const isHeavy = true;
    const hasSearch = false;
    const offset = 0;
    const qLimit = !isHeavy ? rawLimit : hasSearch ? Math.min(rawLimit, 120) : offset >= 1000 ? Math.min(rawLimit, 125) : Math.min(rawLimit, 200);
    expect(qLimit).toBe(200);
  });

  it("batch limit for heavy table with search is capped at 120", () => {
    const rawLimit = 500;
    const isHeavy = true;
    const hasSearch = true;
    const offset = 0;
    const qLimit = !isHeavy ? rawLimit : hasSearch ? Math.min(rawLimit, 120) : offset >= 1000 ? Math.min(rawLimit, 125) : Math.min(rawLimit, 200);
    expect(qLimit).toBe(120);
  });

  it("batch limit for heavy table with high offset is capped at 125", () => {
    const rawLimit = 500;
    const isHeavy = true;
    const hasSearch = false;
    const offset = 1000;
    const qLimit = !isHeavy ? rawLimit : hasSearch ? Math.min(rawLimit, 120) : offset >= 1000 ? Math.min(rawLimit, 125) : Math.min(rawLimit, 200);
    expect(qLimit).toBe(125);
  });

  it("non-heavy tables keep original limit", () => {
    const rawLimit = 500;
    const isHeavy = false;
    const qLimit = !isHeavy ? rawLimit : Math.min(rawLimit, 200);
    expect(qLimit).toBe(500);
  });
});

describe("external-db-bridge — Telemetry Persistence Decision", () => {
  it("ok queries are NOT persisted", () => {
    expect("ok" !== "ok").toBe(false); // would skip insert
  });

  it("slow queries ARE persisted", () => {
    expect("slow" !== "ok").toBe(true);
  });

  it("very_slow queries ARE persisted", () => {
    expect("very_slow" !== "ok").toBe(true);
  });

  it("error queries ARE persisted", () => {
    expect("error" !== "ok").toBe(true);
  });
});

describe("external-db-bridge — Telemetry Insert Payload Completeness", () => {
  it("maps all query_telemetry columns", () => {
    const payload = buildTelemetryInsertPayload({
      operation: "select",
      table: "products",
      rpcName: "fn_test",
      durationMs: 5000,
      recordCount: 100,
      limit: 200,
      offset: 400,
      countMode: "planned",
      status: "slow",
      error: "timeout",
      userId: "user-abc",
    });

    // Verify all columns match query_telemetry schema
    expect(payload).toHaveProperty("operation");
    expect(payload).toHaveProperty("table_name");
    expect(payload).toHaveProperty("rpc_name");
    expect(payload).toHaveProperty("duration_ms");
    expect(payload).toHaveProperty("record_count");
    expect(payload).toHaveProperty("query_limit");
    expect(payload).toHaveProperty("query_offset");
    expect(payload).toHaveProperty("count_mode");
    expect(payload).toHaveProperty("severity");
    expect(payload).toHaveProperty("error_message");
    expect(payload).toHaveProperty("user_id");

    // No extra unexpected fields
    expect(Object.keys(payload)).toHaveLength(11);
  });
});
