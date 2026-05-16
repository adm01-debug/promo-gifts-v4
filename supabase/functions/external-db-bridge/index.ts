// supabase/functions/external-db-bridge/index.ts
// Lean orchestrator — delegates config, aliases, telemetry and cache to shared modules.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  type ServiceClient,
  castSupabaseClient,
} from "../_shared/supabase-client-adapter.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { buildPublicCorsHeaders, getCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import {
  type Operation,
  ALLOWED_RPCS,
  PRODUCT_TABLES, PRODUCT_VIEWS, COMPANY_TABLES, SYSTEM_TABLES,
  PERMISSIONS, SENSITIVE_TABLES,
  HEAVY_TABLES, VERY_HEAVY_TABLES,
  TABLES_WITHOUT_CREATED_AT, TABLES_WITHOUT_UPDATED_AT,
  getResourceGroup,
  type ProductTable, type ProductView,
} from "../_shared/external-db-config.ts";
import {
  resolveTableAlias,
  sanitizeExternalWriteData,
  mapTechniqueRowToLegacyShape,
  mapPriceTableRowToLegacyShape,
} from "../_shared/external-db-aliases.ts";
import { emitTelemetry, classifyDuration, VERY_SLOW_QUERY_THRESHOLD_MS, SLOW_QUERY_THRESHOLD_MS } from "../_shared/external-db-telemetry.ts";
import { getCached, setCache } from "../_shared/external-db-cache.ts";
import { getBreaker, circuitOpenResponse } from "../_shared/circuit-breaker.ts";
import { retrySupabaseCall } from "../_shared/retry-backoff.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "../_shared/request-id.ts";
import { resolveCredential } from "../_shared/credentials.ts";

const breaker = getBreaker("external-db");

// Contexto async por-request — propaga requestId para jsonResponse() sem
// precisar passar como argumento por toda a árvore de handlers.
const requestCtx = new AsyncLocalStorage<{ requestId: string }>();
function currentRequestId(): string | undefined {
  return requestCtx.getStore()?.requestId;
}

/**
 * Transient classifier for the EXTERNAL Postgres bridge.
 * IMPORTANT: do NOT include "statement timeout" here — that path has a dedicated
 * degradation fallback (smaller limit, no count) handled downstream. Retrying
 * the same heavy query verbatim would just burn budget. We only retry true
 * connection/transport flakes here.
 */
function isBridgeTransient(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('statement timeout') || msg.includes('canceling statement')) return false;
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('connection reset') ||
    msg.includes('connection terminated') ||
    msg.includes('etimedout') ||
    msg.includes(' 503') ||
    msg.includes(' 504') ||
    msg.includes('503 ') ||
    msg.includes('504 ')
  );
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Custom error thrown when a filter value is invalid (e.g. raw object).
 * Captured at the request boundary and returned as HTTP 400 with details.
 */
class InvalidFilterError extends Error {
  field: string;
  reason: string;
  receivedType: string;
  constructor(field: string, reason: string, receivedType: string) {
    super(`Invalid filter on field "${field}": ${reason}`);
    this.name = 'InvalidFilterError';
    this.field = field;
    this.reason = reason;
    this.receivedType = receivedType;
  }
}

/**
 * Pre-validates a filters object and returns a list of violations.
 * Rejects non-plain values (objects, functions, symbols, NaN) that would otherwise
 * be coerced to "[object Object]" or break the PostgREST query.
 *
 * Allowed value types: string | number | boolean | bigint | null | undefined | Array<primitive>
 */
function validateFilters(filters: Record<string, unknown> | undefined | null): Array<{ field: string; reason: string; receivedType: string; sample: string }> {
  if (!filters || typeof filters !== 'object') return [];
  const violations: Array<{ field: string; reason: string; receivedType: string; sample: string }> = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue;

    const t = typeof value;

    // Arrays are allowed only if every element is a primitive.
    if (Array.isArray(value)) {
      const badIdx = value.findIndex(v => v !== null && (typeof v === 'object' || typeof v === 'function'));
      if (badIdx >= 0) {
        violations.push({
          field: key,
          reason: `array contains non-primitive element at index ${badIdx} (use only string/number/boolean inside arrays)`,
          receivedType: `Array<${typeof value[badIdx]}>`,
          sample: safeStringify(value).slice(0, 120),
        });
      }
      continue;
    }

    if (t === 'object') {
      violations.push({
        field: key,
        reason: 'filter value must be a primitive (string, number, boolean) — received a raw object. Use suffix promotion (e.g. `${key}_gte`) or a PostgREST string operator (e.g. "gte.10", "is.null", "in.(a,b)") instead.',
        receivedType: 'object',
        sample: safeStringify(value).slice(0, 120),
      });
      continue;
    }

    if (t === 'function' || t === 'symbol') {
      violations.push({
        field: key,
        reason: `filter value of type "${t}" is not serializable`,
        receivedType: t,
        sample: String(value).slice(0, 80),
      });
      continue;
    }

    if (t === 'number' && Number.isNaN(value as number)) {
      violations.push({
        field: key,
        reason: 'filter value is NaN',
        receivedType: 'number(NaN)',
        sample: 'NaN',
      });
    }
  }

  return violations;
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}

export function applyFilters(
  query: any,
  filters: Record<string, unknown>,
  categoryDescendants: string[] | null,
) {
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (key === '_search' && typeof value === 'string') {
      const escaped = value.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%,supplier_reference.ilike.%${escaped}%,brand.ilike.%${escaped}%,description.ilike.%${escaped}%`);
      return;
    }

    // Name prefix search: matches products whose name STARTS with the term (case insensitive)
    if (key === '_name_prefix' && typeof value === 'string') {
      const escaped = value.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.ilike('name', `${escaped}%`);
      return;
    }

    if (categoryDescendants && (key === 'category_id' || key === 'main_category_id')) {
      query = query.in(key, categoryDescendants);
      return;
    }

    // Suffix-based operator promotion: foo_gte → .gte('foo', val), foo_isnull → .is('foo', null|not.null)
    const suffixMatch = key.match(/^(.+)_(gte|lte|gt|lt|neq|like|ilike|isnull|notnull)$/);
    if (suffixMatch) {
      const [, col, op] = suffixMatch;
      if (op === 'isnull') { query = query.is(col, null); return; }
      if (op === 'notnull') { query = query.not(col, 'is', null); return; }
      query = query[op](col, value);
      return;
    }

    // Detect unknown suffix-style keys early (e.g. foo_isnotnull, foo_between) and log clearly.
    const unknownSuffix = key.match(/^(.+)_([a-z]+)$/);
    if (unknownSuffix && !['category', 'main', 'sub', 'group', 'price', 'created', 'updated', 'product', 'supplier', 'color', 'image'].includes(unknownSuffix[2])) {
      // Heuristic: if the suffix looks like an operator attempt but isn't whitelisted, warn but still try equality.
      const knownOps = ['gte','lte','gt','lt','neq','like','ilike','isnull','notnull','eq','in'];
      if (knownOps.some(op => unknownSuffix[2].includes(op)) && !knownOps.includes(unknownSuffix[2])) {
        console.warn(`[external-db-bridge] Unknown filter operator suffix "_${unknownSuffix[2]}" for key "${key}". Supported: ${knownOps.join(', ')}. Falling back to equality.`);
      }
    }

    if (typeof value === 'string') {
      // Support PostgREST-style is.null / not.is.null (and common variants)
      const nullVariants = ['is.null', 'isnull', 'null'];
      const notNullVariants = ['not.is.null', 'is.not.null', 'notnull', 'not.null'];
      if (nullVariants.includes(value)) { query = query.is(key, null); return; }
      if (notNullVariants.includes(value)) { query = query.not(key, 'is', null); return; }

      // Support PostgREST-style in.(val1,val2,...) operator
      const inMatch = value.match(/^in\.\((.+)\)$/);
      if (inMatch) {
        const vals = inMatch[1].split(',').map(v => v.trim());
        query = query.in(key, vals);
        return;
      }

      // Support PostgREST-style comparison operators: gte., lte., gt., lt., neq., like., ilike.
      const operatorMatch = value.match(/^(gte|lte|gt|lt|neq|like|ilike)\.(.+)$/);
      if (operatorMatch) {
        const [, op, val] = operatorMatch;
        query = query[op](key, val);
        return;
      }

      // Detect unrecognized PostgREST-style "op.value" attempts and log clearly.
      const looksLikeOperator = value.match(/^([a-z]+(?:\.[a-z]+)?)\.(.+)$/);
      if (looksLikeOperator) {
        const attemptedOp = looksLikeOperator[1];
        const knownStringOps = ['is.null','not.is.null','is.not.null','in','gte','lte','gt','lt','neq','like','ilike'];
        if (!knownStringOps.includes(attemptedOp)) {
          console.warn(`[external-db-bridge] Unknown PostgREST-style operator "${attemptedOp}" in value for key "${key}". Supported: ${knownStringOps.join(', ')}. Treating as literal equality.`);
        }
      }

      if (['name', 'description', 'title', 'razao_social', 'nome_fantasia', 'nome', 'descricao'].includes(key)) {
        query = query.ilike(key, `%${value}%`);
      } else {
        query = query.eq(key, value);
      }
    } else if (Array.isArray(value)) {
      query = query.in(key, value);
    } else if (typeof value === 'object') {
      // Defense-in-depth: validateFilters() should have caught this earlier and returned 400.
      // If we reach here (e.g. internal call site bypassed validation), refuse loudly instead of silently dropping.
      throw new InvalidFilterError(
        key,
        'filter value must be a primitive (string, number, boolean) — received a raw object. Use suffix promotion (e.g. `${key}_gte`) or a PostgREST string operator (e.g. "gte.10", "is.null").',
        'object',
      );
    } else {
      query = query.eq(key, value);
    }
  });
  return query;
}

function computeSafeLimit(
  requestedLimit: number,
  table: string,
  hasSearch: boolean,
  offset: number,
  selectFields?: string,
): number {
  const isHeavy = HEAVY_TABLES.includes(table);
  const isVeryHeavy = VERY_HEAVY_TABLES.includes(table);
  if (!isHeavy) return requestedLimit;

  // Lightweight selects (few scalar fields, no JSONB) can handle larger pages safely
  const isLightweight = selectFields && selectFields !== '*' && selectFields.split(',').length <= 20;
  if (isLightweight) {
    if (hasSearch) return Math.min(requestedLimit, 250);
    return Math.min(requestedLimit, 500);
  }

  if (hasSearch) return Math.min(requestedLimit, 120);
  if (isVeryHeavy) return Math.min(requestedLimit, 100);
  if (offset >= 1000) return Math.min(requestedLimit, 125);
  return Math.min(requestedLimit, 200);
}

function isUnpopulatedMaterializedViewError(message?: string | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('has not been populated')
    || (normalized.includes('materialized view') && normalized.includes('not been populated'))
    || normalized.includes('mv precisa de refresh');
}

// ============================================
// VIRTUAL TABLE: product_print_areas
// Materializes personalization_areas JSONB → flat rows
// ============================================

function normalizeTechniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeArea(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function getAreas(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeArea);
}

function getAreaId(area: Record<string, unknown>, index: number): string {
  const rawId = area.id;
  return typeof rawId === 'string' && rawId.trim().length > 0 ? rawId : `area-${index}`;
}

function buildVirtualRecords(productId: string, personalizationAreas: unknown): Record<string, unknown>[] {
  const areas = getAreas(personalizationAreas);
  return areas.flatMap((area, index) => {
    const areaId = getAreaId(area, index);
    const techniqueIds = normalizeTechniqueIds(area.allowed_technique_ids ?? area.technique_ids);
    return techniqueIds.map((techniqueId) => ({
      ...area,
      id: `${productId}::${areaId}::${techniqueId}`,
      product_id: productId,
      area_id: areaId,
      area_name: typeof area.area_name === 'string' ? area.area_name : typeof area.name === 'string' ? area.name : `Área ${index + 1}`,
      technique_id: techniqueId,
      allowed_technique_ids: techniqueIds,
      is_active: area.is_active !== false,
      display_order: typeof area.display_order === 'number' ? area.display_order : index,
      component_name: typeof area.component_name === 'string' ? area.component_name : null,
      location_name: typeof area.location_name === 'string' ? area.location_name : null,
      _virtual: true,
    }));
  });
}

function parseVirtualId(virtualId: string) {
  const parts = virtualId.split('::');
  if (parts.length !== 3 || parts.some((p) => !p)) return null;
  return { productId: parts[0], areaId: parts[1], techniqueId: parts[2] };
}

async function fetchProductForVirtualAreas(externalSupabase: any, productId: string) {
  const { data: product, error } = await externalSupabase
    .from('products')
    .select('id, personalization_areas')
    .eq('id', productId)
    .maybeSingle();
  const missingColumn = !!error?.message?.includes("personalization_areas");
  return { product, error, missingColumn };
}

function addTechniqueToAreas(personalizationAreas: unknown, techniqueId: string, areaName = 'Área Principal') {
  const areas = getAreas(personalizationAreas);
  if (areas.length === 0) {
    const areaId = crypto.randomUUID();
    return {
      updatedAreas: [{ id: areaId, area_name: areaName, allowed_technique_ids: [techniqueId], is_active: true, is_primary: true, display_order: 0, unit: 'cm', shape: 'rectangle', max_width: 0, max_height: 0 }],
      areaId, alreadyLinked: false,
    };
  }
  const targetIndex = areas.findIndex((a) => a.is_primary === true);
  const resolvedIndex = targetIndex >= 0 ? targetIndex : 0;
  const targetArea = normalizeArea(areas[resolvedIndex]);
  const areaId = getAreaId(targetArea, resolvedIndex);
  const existing = normalizeTechniqueIds(targetArea.allowed_technique_ids ?? targetArea.technique_ids);
  const alreadyLinked = existing.includes(techniqueId);
  const next = alreadyLinked ? existing : [...existing, techniqueId];
  targetArea.id = areaId;
  targetArea.allowed_technique_ids = next;
  if ('technique_ids' in targetArea) targetArea.technique_ids = next;
  if (typeof targetArea.area_name !== 'string' && typeof targetArea.name !== 'string') targetArea.area_name = areaName;
  areas[resolvedIndex] = targetArea;
  return { updatedAreas: areas, areaId, alreadyLinked };
}

function removeTechniqueFromAreas(personalizationAreas: unknown, areaId: string, techniqueId: string) {
  const areas = getAreas(personalizationAreas);
  let removed = false;
  const updatedAreas = areas.map((area, index) => {
    const next = normalizeArea(area);
    const nextAreaId = getAreaId(next, index);
    if (nextAreaId !== areaId) return next;
    const current = normalizeTechniqueIds(next.allowed_technique_ids ?? next.technique_ids);
    const filtered = current.filter((id) => id !== techniqueId);
    removed = removed || filtered.length !== current.length;
    next.id = nextAreaId;
    next.allowed_technique_ids = filtered;
    if ('technique_ids' in next) next.technique_ids = filtered;
    return next;
  });
  return { updatedAreas, removed };
}

// ============================================
// MAIN HANDLER
// ============================================

const TopLevelBodySchema = z.object({
  operation: z.enum(['select', 'insert', 'update', 'delete', 'upsert', 'batch_insert', 'rpc', 'batch', 'ping']),
  table: z.string().min(1).optional(),
  queries: z.array(z.record(z.unknown())).max(10).optional(),
  rpcName: z.string().optional(),
  rpcParams: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
  data: z.unknown().optional(),
  id: z.unknown().optional(),
  select: z.string().optional(),
  orderBy: z.object({ column: z.string(), ascending: z.boolean().optional() }).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
  countMode: z.string().optional(),
  onConflict: z.string().optional(),
}).refine(data => {
  if (data.operation === 'batch') return true;
  if (data.operation === 'ping') return true;
  if (data.operation === 'rpc') return !!data.rpcName;
  return !!data.table;
}, { message: "Field 'table' is required for CRUD operations, 'rpcName' for RPC" });

Deno.serve((req) => {
  const corsHeaders = getCorsHeaders(req);
  // Guard raiz: nada lançado a partir daqui pode escapar ao runtime,
  // ou o edge-runtime devolve 503 SUPABASE_EDGE_RUNTIME_ERROR genérico
  // (sem CORS, sem JSON) que trava a UI ("blank screen").
  let requestId = "unknown";
  try {
    requestId = getOrCreateRequestId(req);
  } catch {
    // ignora — vamos usar "unknown"
  }
  return requestCtx.run({ requestId }, async () => {
    let corsHeaders: Record<string, string> = buildPublicCorsHeaders({ allowMethods: "POST, OPTIONS" });
    try {
      corsHeaders = getCorsHeaders(req);
      const preflightResponse = handleCorsPreflightIfNeeded(req);
      if (preflightResponse) return preflightResponse;
    } catch (e) {
      console.error(`[external-db-bridge] CORS init failed: ${(e as Error).message}`);
    }

    const requestStartTime = performance.now();
    console.log(`[external-db-bridge] [req_id=${requestId}] request_start method=${req.method}`);

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const parsed = TopLevelBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400, corsHeaders);
    }

    const body = parsed.data as Record<string, unknown>;

    // ============================================
    // PING (keep-alive — sem DB I/O, sem auth, sem breaker)
    // Ping é diagnóstico/warm-up — deve responder mesmo com circuito aberto.
    // Agora estendido para retornar metadados de saúde das credenciais (sem expor valores).
    // ============================================
    if (body.operation === 'ping') {
      const [{ value: externalUrl }, { value: externalKey }] = await Promise.all([
        resolveCredential("EXTERNAL_PROMOBRIND_URL"),
        resolveCredential("EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY"),
      ]);

      return jsonResponse({ 
        ok: true, 
        ts: Date.now(), 
        warm: true,
        config: {
          url: externalUrl ? externalUrl.replace(/\/\/.*@/, '//***@') : null, // sanitize basic auth if present
          has_url: !!externalUrl,
          has_key: !!externalKey,
          // Fingerprint para confirmar que estamos na instância certa
          url_suffix: externalUrl ? externalUrl.slice(-10) : null,
          is_external: externalUrl ? !externalUrl.includes('supabase.co') : false
        }
      }, 200, corsHeaders);
    }

    // Circuit breaker só barra operações reais (após parse do body).
    if (!breaker.canRequest()) {
      return circuitOpenResponse("external-db", corsHeaders);
    }

    // ============================================
    // BATCH OPERATION
    // ============================================
    if (body.operation === 'batch') {
      return await handleBatch(body, req, corsHeaders, requestStartTime);
    }

    const operation = body.operation as Operation;

    // ============================================
    // RPC OPERATION
    // ============================================
    if (operation === 'rpc') {
      return await handleRpc(body, corsHeaders);
    }

    // ============================================
    // CRUD OPERATIONS
    // ============================================
    const response = await handleCrud(body, req, corsHeaders, requestStartTime);
    if (response.status >= 500) breaker.recordFailure(); else breaker.recordSuccess();
    return response;

  } catch (error) {
    if (error instanceof InvalidFilterError) {
      const totalDuration = Math.round(performance.now() - requestStartTime);
      console.warn(`⚠️ [external-db-bridge] InvalidFilterError after ${totalDuration}ms — field="${error.field}" type=${error.receivedType}`);
      return jsonResponse({
        error: 'Invalid filter values',
        details: [{ field: error.field, reason: error.reason, receivedType: error.receivedType }],
        hint: 'Each filter value must be a primitive. Use suffix promotion (e.g. price_gte) or PostgREST string operators ("gte.10", "is.null", "in.(a,b)").',
      }, 400, corsHeaders);
    }
    breaker.recordFailure();
    const totalDuration = Math.round(performance.now() - requestStartTime);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`❌ [telemetry] [req_id=${requestId}] Request failed after ${totalDuration}ms: ${errorMessage}`);
    // Devolve 200 + flag fallback para o cliente acionar retry/degradação
    // sem que o supabase-js trate como exceção fatal e a UI quebre.
    return jsonResponse({
      error: 'SERVICE_FAILED',
      message: errorMessage,
      fallback: true,
      request_id: requestId,
    }, 200, corsHeaders);
  }
  });
});

// ============================================
// BATCH HANDLER
// ============================================

async function handleBatch(body: any, req: Request, corsHeaders: Record<string, string>, requestStartTime: number) {
  const queries = body.queries as Array<Record<string, unknown>>;
  if (!Array.isArray(queries) || queries.length === 0) {
    return jsonResponse({ error: 'Batch requires a non-empty "queries" array' }, 400, corsHeaders);
  }
  if (queries.length > 10) {
    return jsonResponse({ error: 'Batch limited to 10 queries max' }, 400, corsHeaders);
  }

  const externalSupabaseOrResp = await getExternalClient(corsHeaders);
  if (externalSupabaseOrResp instanceof Response) return externalSupabaseOrResp;
  // Narrow estável dentro de closures async (TS perde narrow em vars que mudam globalmente).
  const externalSupabase: ServiceClient = externalSupabaseOrResp;

  const results = await Promise.all(
    queries.map(async (q, idx) => {
      const qTable = q.table as string;
      const qSelect = (q.select as string) || '*';
      const qFilters = q.filters as Record<string, unknown> | undefined;
      const qOrderBy = q.orderBy as { column: string; ascending?: boolean } | undefined;
      const hasSearch = !!(qFilters && '_search' in qFilters);
      const rawLimit = (q.limit as number) || 500;
      const qOffset = (q.offset as number) || 0;
      const qLimit = computeSafeLimit(rawLimit, qTable, hasSearch, qOffset, qSelect);
      const qCacheKey = q.cacheKey as string | undefined;
      const qCountMode = q.countMode as string | undefined;

      if (qCacheKey) {
        const cached = getCached<{ records: unknown[]; count: number | null }>(qCacheKey);
        if (cached) {
          console.log(`[batch] Query ${idx} (${qTable}) served from cache (${(cached.records as unknown[]).length} records)`);
          return { success: true, data: cached, fromCache: true };
        }
      }

      const resourceGroup = getResourceGroup(qTable);
      if (!resourceGroup) return { success: false, error: `Tabela '${qTable}' não mapeada` };

      // Reject malformed filters (objects, NaN, functions) per-batch-item BEFORE building the query.
      const batchFilterViolations = validateFilters(qFilters);
      if (batchFilterViolations.length > 0) {
        console.warn(`[batch] Query ${idx} (${qTable}) rejected — invalid filters:`, batchFilterViolations);
        return {
          success: false,
          error: 'Invalid filter values',
          details: batchFilterViolations,
          hint: 'Each filter value must be a primitive. Use suffix promotion (e.g. price_gte) or PostgREST string operators ("gte.10", "is.null", "in.(a,b)").',
        };
      }

      try {
        const queryStart = performance.now();
        // Use centralized resolver (same hard guard: limit > 50 AND no id) for batch too
        const batchResolved = resolveProductsSelect({
          table: qTable,
          select: qSelect,
          limit: rawLimit,
          hasId: false,
        });
        const effectiveBatchSelect = batchResolved.effectiveSelect;
        logSelectDecision({
          callSite: 'handleBatch',
          table: qTable,
          callerSelect: qSelect,
          effectiveLimit: rawLimit ?? qLimit,
          hasId: false,
          resolved: batchResolved,
        });
        const selectOpts = qCountMode ? { count: qCountMode as 'exact' | 'planned' | 'estimated' } : undefined;
        let query = selectOpts
          ? externalSupabase.from(qTable).select(effectiveBatchSelect, selectOpts)
          : externalSupabase.from(qTable).select(effectiveBatchSelect);
        if (qFilters) query = applyFilters(query, qFilters, null);
        if (qOrderBy) query = query.order(qOrderBy.column, { ascending: qOrderBy.ascending ?? false });
        query = query.range(qOffset, qOffset + qLimit - 1);

        // Execute with backoff+jitter ONLY for connection/transport flakes.
        // Statement timeouts skip retry here and go to the degradation fallback below.
        const execStart = performance.now();
        const { data: selectData, error: selectError, count } = await (async () => {
          try {
            const r = await retrySupabaseCall<unknown>(
              async () => {
                const { data, error, count } = await query;
                return { data: { data, count }, error: error as { message: string; code?: string } | null };
              },
              { maxAttempts: 3, baseMs: 60, capMs: 600, budgetMs: 1500, isTransient: isBridgeTransient, label: `batch:${qTable}` },
            );
            const payload = (r.data ?? { data: null, count: null }) as { data: unknown; count: number | null };
            if (r.attempts > 1) console.log(`[batch] ✅ ${qTable} recovered after ${r.attempts} attempts in ${r.totalMs}ms`);
            return { data: payload.data as any, error: null, count: payload.count };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { data: null, error: { message: msg } as { message: string; code?: string }, count: null };
          }
        })();
        const duration = Math.round(performance.now() - execStart);
        if (selectError) {
          if (qTable.startsWith('mv_') && isUnpopulatedMaterializedViewError(selectError.message)) {
            console.warn(`[batch] Query ${idx} (${qTable}) returned unpopulated MV; sending empty result`);
            const result = {
              records: [],
              count: 0,
              meta: { materialized_view_status: 'not_populated' },
            };
            if (qCacheKey) setCache(qCacheKey, result);
            return { success: true, data: result };
          }

          // Retry on statement timeout with reduced limit and no count
          if (selectError.message?.includes('statement timeout') && qLimit > 50) {
            const retryLimit = Math.min(qLimit, 50);
            console.warn(`[batch] Query ${idx} (${qTable}) timed out with limit=${qLimit}, retrying with limit=${retryLimit} and no count`);
            const retryStart = performance.now();
            let retryQuery = externalSupabase.from(qTable).select(effectiveBatchSelect);
            if (qFilters) retryQuery = applyFilters(retryQuery, qFilters, null);
            if (qOrderBy) retryQuery = retryQuery.order(qOrderBy.column, { ascending: qOrderBy.ascending ?? false });
            retryQuery = retryQuery.range(qOffset, qOffset + retryLimit - 1);

            const { data: retryData, error: retryError } = await retryQuery;
            const retryDuration = Math.round(performance.now() - retryStart);

            if (retryError) {
              console.warn(`[batch] Query ${idx} (${qTable}) retry also failed in ${retryDuration}ms: ${retryError.message}`);
              return { success: false, error: retryError.message };
            }

            const retryResult = { records: retryData || [], count: null };
            if (qCacheKey) setCache(qCacheKey, retryResult);
            console.log(`[batch] ♻️ Query ${idx} (${qTable}) retry OK in ${retryDuration}ms, ${retryData?.length ?? 0} records`);
            return { success: true, data: retryResult };
          }

          console.warn(`[batch] Query ${idx} (${qTable}) failed in ${duration}ms: ${selectError.message}`);
          return { success: false, error: selectError.message };
        }

        const result = { records: selectData || [], count };
        if (qCacheKey) setCache(qCacheKey, result);

        const icon = duration >= VERY_SLOW_QUERY_THRESHOLD_MS ? '🔴' : duration >= SLOW_QUERY_THRESHOLD_MS ? '🟡' : '✅';
        console.log(`[batch] ${icon} Query ${idx} (${qTable}) ${duration}ms, ${selectData?.length ?? 0} records`);
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );

  const totalDuration = Math.round(performance.now() - requestStartTime);
  console.log(`[batch] Total: ${totalDuration}ms for ${queries.length} queries`);
  return jsonResponse({ success: true, results }, 200, corsHeaders);
}

// ============================================
// RPC HANDLER
// ============================================

async function handleRpc(body: any, corsHeaders: Record<string, string>) {
  const rpcName = body.rpcName as string;
  const rpcParams = body.rpcParams as Record<string, unknown>;

  if (!ALLOWED_RPCS.includes(rpcName as any)) {
    return jsonResponse({ error: `RPC '${rpcName}' não permitida`, allowedRpcs: ALLOWED_RPCS }, 403, corsHeaders);
  }

  const externalSupabase = await getExternalClient(corsHeaders);
  if (externalSupabase instanceof Response) return externalSupabase;

  console.log(`RPC: ${rpcName}`, rpcParams);
  const rpcStart = performance.now();
  const { data: rpcDataRaw, error: rpcError } = await externalSupabase.rpc(rpcName, rpcParams || {});
  const rpcDuration = Math.round(performance.now() - rpcStart);
  const rpcData = rpcDataRaw as Record<string, unknown> | unknown[] | null;

  if (rpcError) {
    emitTelemetry({ operation: 'rpc', rpcName, durationMs: rpcDuration, status: 'error', error: rpcError.message });
    return jsonResponse({ error: rpcError.message }, 400, corsHeaders);
  }

  emitTelemetry({ operation: 'rpc', rpcName, durationMs: rpcDuration, status: classifyDuration(rpcDuration), recordCount: Array.isArray(rpcData) ? rpcData.length : 1 });

  // Enrich legacy flat responses from fn_get_customization_price
  let enrichedData: unknown = rpcData;
  const flat = (rpcData && !Array.isArray(rpcData)) ? rpcData as Record<string, unknown> : null;
  const isLegacyFlat = !!(flat && flat.success && flat.tabela_codigo && !flat.tabela);
  if (rpcName === 'fn_get_customization_price' && isLegacyFlat && flat) {
    enrichedData = await enrichCustomizationPrice(externalSupabase, flat);
  }

  return jsonResponse({ success: true, data: enrichedData }, 200, corsHeaders);
}

async function enrichCustomizationPrice(externalSupabase: any, rpcData: any) {
  try {
    const { data: tabelaRows } = await externalSupabase
      .from('tabela_preco_gravacao_oficial')
      .select('id,area_maxima_texto,max_cores,cobra_por_cor')
      .eq('codigo', rpcData.tabela_codigo)
      .eq('ativo', true)
      .limit(1);

    if (tabelaRows?.length) {
      const t = tabelaRows[0];
      const { data: faixaRows } = await externalSupabase
        .from('tabela_preco_gravacao_oficial_faixa')
        .select('largura_max,altura_max')
        .eq('tabela_preco_gravacao_id', t.id);

      let maxLargura: number | null = null;
      let maxAltura: number | null = null;
      if (faixaRows?.length) {
        const larguras = faixaRows.map((f: any) => f.largura_max).filter((v: any): v is number => typeof v === 'number' && v < 90);
        const alturas = faixaRows.map((f: any) => f.altura_max).filter((v: any): v is number => typeof v === 'number' && v < 90);
        maxLargura = larguras.length ? Math.max(...larguras) : null;
        maxAltura = alturas.length ? Math.max(...alturas) : null;
      }

      return {
        ...rpcData,
        tabela: { ...(rpcData.tabela || {}), id: t.id, area_maxima_texto: t.area_maxima_texto ?? null, largura_max_cm: maxLargura, altura_max_cm: maxAltura, max_cores: t.max_cores ?? rpcData.max_cores ?? null, cobra_por_cor: t.cobra_por_cor ?? false },
      };
    }
  } catch (e) {
    console.warn('[external-db-bridge] RPC enrichment failed:', e);
  }
  return rpcData;
}

// ============================================
// CRUD HANDLER
// ============================================

async function handleCrud(body: any, req: Request, corsHeaders: Record<string, string>, requestStartTime: number) {
  const operation = body.operation as Operation;
  let table = body.table as string;

  if (!table || typeof table !== 'string' || table === 'undefined') {
    return jsonResponse({ error: `Parâmetro 'table' é obrigatório e deve ser uma string válida (recebido: ${JSON.stringify(table)})` }, 400, corsHeaders);
  }

  // Resolve aliases
  const alias = resolveTableAlias(table, body.filters, body.orderBy, body.select);
  table = alias.table;
  const filters = alias.filters;
  const orderBy = alias.orderBy;
  const select = alias.select;
  const aliasType = alias.aliasType;

  // Auth check
  const isReadOperation = operation === 'select';
  const isPublicTable = PRODUCT_TABLES.includes(table as ProductTable) || PRODUCT_VIEWS.includes(table as ProductView);
  const isSensitive = SENSITIVE_TABLES.has(table);
  const allowPublicAccess = isReadOperation && isPublicTable && !isSensitive;

  const authHeader = req.headers.get('Authorization');
  let userId: string | null = null;
  let userRole = 'public';

  // ⚡ FAST-PATH: skip auth entirely for anonymous reads on public catalog tables.
  // Saves ~150–300ms per request (no getUser RTT, no user_roles lookup).
  // Write operations and sensitive tables ALWAYS go through full auth below.
  const isWriteOp = ['insert', 'update', 'delete', 'upsert', 'batch_insert'].includes(operation);
  const skipAuth = allowPublicAccess && !isWriteOp && (!authHeader || !authHeader.startsWith('Bearer '));

  if (!skipAuth && authHeader?.startsWith('Bearer ')) {
    const localSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    // getClaims is faster than getUser — verifies JWT locally without server RTT.
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await localSupabase.auth.getClaims(token);

    if (claimsData?.claims?.sub && !claimsError) {
      userId = claimsData.claims.sub;
      const localService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: userRoles, error: roleError } = await localService.from('user_roles').select('role').eq('user_id', userId);
      if (roleError) console.error('Error fetching user roles:', roleError);
      userRole = userRoles?.[0]?.role || 'vendedor';
    } else if (!allowPublicAccess) {
      console.error('Auth failed:', claimsError?.message);
    }
  }

  if (!allowPublicAccess && !userId) {
    console.error(`Authentication required: table=${table}, operation=${operation}, sensitive=${isSensitive}`);
    return jsonResponse({ error: 'Autenticação necessária' }, 401, corsHeaders);
  }

  console.log(`Operation: ${operation} on table: ${table} (public: ${allowPublicAccess})`);

  // Extract remaining body fields
  const { data, id, limit: queryLimit, offset: queryOffset, countMode: requestCountMode } = body;

  // Validate resource group & permissions
  const resourceGroup = getResourceGroup(table);
  if (!resourceGroup) {
    if (SYSTEM_TABLES.includes(table as any)) {
      return jsonResponse({ error: `Tabela '${table}' não está disponível para acesso externo` }, 403, corsHeaders);
    }
    return jsonResponse({ error: `Tabela '${table}' não mapeada`, availableTables: { products: PRODUCT_TABLES, companies: COMPANY_TABLES } }, 400, corsHeaders);
  }

  if (!PERMISSIONS[resourceGroup].includes(operation)) {
    return jsonResponse({ error: `Operação '${operation}' não permitida para '${resourceGroup}'`, allowed: PERMISSIONS[resourceGroup] }, 403, corsHeaders);
  }

  if (['insert', 'update', 'delete', 'upsert', 'batch_insert'].includes(operation)) {
    if (!['admin', 'gerente', 'vendedor'].includes(userRole)) {
      return jsonResponse({ error: 'Permissão insuficiente para esta operação' }, 403, corsHeaders);
    }
    if (userRole === 'vendedor' && operation === 'delete') {
      return jsonResponse({ error: 'Vendedores não podem excluir registros' }, 403, corsHeaders);
    }
  }

  // Determina elegibilidade de cache cedo (antes de tocar BD).
  // Cache é seguro para qualquer usuário em tabelas públicas não-sensíveis:
  // a resposta não depende da identidade (sem RLS no BD externo).
  // Excluímos apenas count='exact' (precisa ser preciso) e tabelas sensíveis.
  const isExactCount = requestCountMode === 'exact';
  const isCacheable =
    operation === 'select' &&
    allowPublicAccess &&
    !isExactCount;

  // CACHE LOOKUP: serve direto da memória se houver hit válido
  let cacheKey: string | null = null;
  if (isCacheable) {
    cacheKey = buildCacheKey(table, body);
    const cached = getCachedResponse(cacheKey);
    if (cached !== null) {
      cacheHitsTotal++;
      const totalDuration = Math.round(performance.now() - requestStartTime);
      console.info(`⚡ [cache] HIT ${operation}:${table} ${totalDuration}ms key=${cacheKey} (hits=${cacheHitsTotal} misses=${cacheMissesTotal})`);
      // Persist cache hit so the admin dashboard can compute Cache Hit Rate.
      emitTelemetry({
        operation,
        table,
        durationMs: totalDuration,
        status: 'ok',
        cacheHit: true,
        userId,
      });
      return cachedJsonResponse(cached, corsHeaders, true);
    }
    cacheMissesTotal++;
  }

  const externalSupabase = await getExternalClient(corsHeaders);
  if (externalSupabase instanceof Response) return externalSupabase;

  const isVirtual = table === 'product_print_areas';
  let result;

  switch (operation) {
    case 'select':
      result = await handleSelect(externalSupabase, table, { filters, id, select, orderBy, queryLimit, queryOffset, requestCountMode, isVirtual, aliasType, corsHeaders });
      if (result instanceof Response) return result;
      break;

    case 'insert':
      result = await handleInsert(externalSupabase, table, { data, isVirtual, corsHeaders });
      if (result instanceof Response) return result;
      break;

    case 'upsert':
      result = await handleUpsert(externalSupabase, table, { data, corsHeaders });
      if (result instanceof Response) return result;
      break;

    case 'batch_insert':
      result = await handleBatchInsert(externalSupabase, table, { data, corsHeaders, onConflict: body.onConflict });
      if (result instanceof Response) return result;
      break;

    case 'update':
      result = await handleUpdate(externalSupabase, table, { data, id, isVirtual, corsHeaders });
      if (result instanceof Response) return result;
      break;

    case 'delete':
      result = await handleDelete(externalSupabase, table, { id, isVirtual, corsHeaders });
      if (result instanceof Response) return result;
      break;

    default:
      return jsonResponse({ error: `Operação não suportada: ${operation}` }, 400, corsHeaders);
  }

  // Invalidação: qualquer write expira TODAS as entradas de cache da tabela tocada
  if (['insert', 'update', 'delete', 'upsert', 'batch_insert'].includes(operation)) {
    invalidateCacheForTable(table);
  }

  const totalDuration = Math.round(performance.now() - requestStartTime);
  if (totalDuration >= VERY_SLOW_QUERY_THRESHOLD_MS) {
    console.warn(`🔴 [telemetry] Total request ${operation}:${table} took ${totalDuration}ms (VERY SLOW)`);
  } else if (totalDuration >= SLOW_QUERY_THRESHOLD_MS) {
    console.warn(`🟡 [telemetry] Total request ${operation}:${table} took ${totalDuration}ms (SLOW)`);
  }

  // CACHE WRITE: armazena resposta para próximas requisições
  if (isCacheable && cacheKey) {
    const payload = JSON.stringify({ data: result, success: true });
    setCachedResponse(cacheKey, payload);
    return cachedJsonResponse(payload, corsHeaders, false);
  }

  return jsonResponse({ data: result, success: true }, 200, corsHeaders);
}

// ============================================
// SELECT
// ============================================

async function handleSelect(externalSupabase: any, table: string, opts: any) {
  const { filters, id, select, orderBy, queryLimit, queryOffset, requestCountMode, isVirtual, aliasType, corsHeaders } = opts;

  // Reject malformed filters (objects, NaN, functions) BEFORE building the query.
  const filterViolations = validateFilters(filters as Record<string, unknown> | undefined);
  if (filterViolations.length > 0) {
    console.warn(`[external-db-bridge] Rejecting select on "${table}" — ${filterViolations.length} invalid filter(s):`, filterViolations);
    return jsonResponse({
      error: 'Invalid filter values',
      details: filterViolations,
      hint: 'Each filter value must be a primitive. For range/null/in queries use suffix promotion (e.g. price_gte) or PostgREST string operators (e.g. "gte.10", "is.null", "in.(a,b)").',
    }, 400, corsHeaders);
  }

  if (isVirtual) {
    const selectStart = performance.now();
    const productIdFromId = typeof id === 'string' ? parseVirtualId(id)?.productId : null;
    const virtualProductId = productIdFromId ?? (typeof filters?.product_id === 'string' ? filters.product_id : null);
    if (!virtualProductId) {
      emitTelemetry({ operation: 'select', table, durationMs: Math.round(performance.now() - selectStart), status: 'error', error: 'Filtro product_id é obrigatório' });
      return jsonResponse({ error: 'Filtro product_id é obrigatório para product_print_areas' }, 400, corsHeaders);
    }

    const { product, error: productError, missingColumn } = await fetchProductForVirtualAreas(externalSupabase, virtualProductId);
    const dur = Math.round(performance.now() - selectStart);

    if (missingColumn) {
      emitTelemetry({ operation: 'select', table, durationMs: dur, status: 'ok', recordCount: 0 });
      console.warn(`Virtual table ${table} unavailable: products.personalization_areas does not exist`);
      return { records: [], count: 0 };
    }
    if (productError) {
      emitTelemetry({ operation: 'select', table, durationMs: dur, status: 'error', error: productError.message });
      return jsonResponse({ error: productError.message }, 400, corsHeaders);
    }

    const limit = typeof queryLimit === 'number' && queryLimit > 0 ? queryLimit : 200;
    const offset = typeof queryOffset === 'number' && queryOffset >= 0 ? queryOffset : 0;
    let allRecords = buildVirtualRecords(virtualProductId, product?.personalization_areas);

    if (id) allRecords = allRecords.filter((r) => r.id === id);
    if (filters) {
      allRecords = allRecords.filter((r) => Object.entries(filters).every(([k, v]) => {
        if (v === undefined || v === null || v === '' || k === 'product_id') return true;
        return Array.isArray(v) ? v.includes(r[k] as never) : r[k] === v;
      }));
    }

    const paginated = allRecords.slice(offset, offset + limit);
    emitTelemetry({ operation: 'select', table, limit, offset, countMode: 'virtual', durationMs: dur, status: classifyDuration(dur), recordCount: paginated.length });
    return { records: paginated, count: allRecords.length };
  }

  // #7: In-memory TTL cache.
  //   - STATIC_TABLES: 10min TTL (categories, suppliers, etc.) — quase imutáveis.
  //   - PRODUCTS lightweight (lista pública): 60s TTL — só quando o caller
  //     usa o select lightweight padrão SEM filtros dinâmicos pesados.
  //     Reduz custo de re-paginação quando usuário troca de filtro/aba rápido.
  const STATIC_TABLES = new Set([
    'categories', 'suppliers', 'tags', 'colors', 'materials',
    'print_techniques', 'print_areas', 'price_tables',
  ]);

  // Detecta listing lightweight de products (sem id, sem search/keyset).
  // Filtros simples (booleanos / IDs) podem entrar no cache; _search e _keyset não.
  const hasDynamicFilter =
    filters && (
      Object.prototype.hasOwnProperty.call(filters, '_search') ||
      Object.prototype.hasOwnProperty.call(filters, '_keyset')
    );
  const isProductsListingCacheable =
    table === 'products' &&
    !id &&
    !hasDynamicFilter &&
    requestCountMode !== 'exact' &&
    requestCountMode !== 'planned';

  const isCacheable =
    (STATIC_TABLES.has(table) || isProductsListingCacheable) &&
    !id &&
    requestCountMode !== 'exact' &&
    requestCountMode !== 'planned';
  const cacheKey = isCacheable
    ? `select:${table}:${JSON.stringify({ filters: filters ?? null, select: select ?? '*', orderBy: orderBy ?? null, queryLimit: queryLimit ?? null, queryOffset: queryOffset ?? 0 })}`
    : null;
  if (cacheKey) {
    const cached = getCached<{ records: unknown[]; count: number | null }>(cacheKey);
    if (cached) {
      emitTelemetry({ operation: 'select', table, limit: queryLimit, offset: queryOffset ?? 0, countMode: 'cache', durationMs: 0, status: 'ok', recordCount: cached.records.length });
      return cached;
    }
  }

  // Category descendants optimization
  let categoryDescendants: string[] | null = null;
  if (table === 'products' && filters && (filters.category_id || filters.main_category_id)) {
    const catId = (filters.category_id || filters.main_category_id) as string;
    try {
      const { data: desc, error: descErr } = await externalSupabase.rpc('get_category_descendants', { category_uuid: catId });
      if (!descErr && Array.isArray(desc)) {
        categoryDescendants = desc as string[];
        console.log(`Category ${catId} has ${categoryDescendants.length} descendants`);
      }
    } catch (err) {
      console.warn('Error calling get_category_descendants:', err);
    }
  }

  const isHeavy = HEAVY_TABLES.includes(table);
  const isVeryHeavy = VERY_HEAVY_TABLES.includes(table);
  const hasSearch = filters && '_search' in filters;
  const hasNamePrefix = filters && '_name_prefix' in filters;
  const countMode = requestCountMode ?? (hasSearch ? 'none' : (isVeryHeavy ? 'none' : (isHeavy ? 'planned' : 'exact')));
  const queryCountMode = countMode === 'none' ? undefined : countMode;

  // ============================================
  // PRODUCTS LIGHTWEIGHT SELECT — delegated to resolveProductsSelect()
  // (single source of truth, hard guard: limit > 50 AND no id)
  // ============================================
  const requestedLimitRaw = typeof queryLimit === 'number' && queryLimit > 0 ? queryLimit : 500;
  // hasId considera tanto `id` top-level quanto `filters.id` (fetch direto via filters):
  // ambos resultam em consulta single-row e devem preservar o payload completo
  // para detail/edit pages — não devem ser degradados pelo lightweight forçado.
  const filtersId = filters && typeof filters === 'object' ? (filters as Record<string, unknown>).id : undefined;
  const hasIdSignal = !!id || (filtersId !== undefined && filtersId !== null && filtersId !== '');
  const resolved = resolveProductsSelect({
    table,
    select,
    limit: requestedLimitRaw,
    hasId: hasIdSignal,
  });
  const effectiveSelect = resolved.effectiveSelect;
  logSelectDecision({
    callSite: 'handleSelect',
    table,
    callerSelect: select,
    effectiveLimit: requestedLimitRaw,
    hasId: hasIdSignal,
    resolved,
  });

  let query = queryCountMode
    ? externalSupabase.from(table).select(effectiveSelect, { count: queryCountMode })
    : externalSupabase.from(table).select(effectiveSelect);

  if (filters) query = applyFilters(query, filters, categoryDescendants);
  if (id) query = query.eq('id', id);
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });

  const requestedLimit = requestedLimitRaw;
  const safeOffset = typeof queryOffset === 'number' && queryOffset >= 0 ? queryOffset : 0;
  const safeLimit = computeSafeLimit(requestedLimit, table, !!(hasSearch || hasNamePrefix), safeOffset, effectiveSelect);
  query = query.range(safeOffset, safeOffset + safeLimit - 1);

  const selectStart = performance.now();
  let selectData: unknown[] | null;
  let selectError: { message: string; code?: string } | null;
  let count: number | null;

  try {
    // Backoff+jitter for connection/transport flakes only. Statement timeouts
    // skip retry here and fall through to the dedicated degradation fallback.
    const r = await retrySupabaseCall<unknown>(
      async () => {
        const res = await query;
        return {
          data: { data: res.data, count: res.count },
          error: res.error as { message: string; code?: string } | null,
        };
      },
      { maxAttempts: 3, baseMs: 80, capMs: 800, budgetMs: 2000, isTransient: isBridgeTransient, label: `select:${table}` },
    );
    const payload = (r.data ?? { data: null, count: null }) as { data: unknown[] | null; count: number | null };
    selectData = payload.data;
    selectError = null;
    count = payload.count;
    if (r.attempts > 1) console.log(`[select] ✅ ${table} recovered after ${r.attempts} attempts in ${r.totalMs}ms`);
  } catch (abortErr) {
    const msg = abortErr instanceof Error ? abortErr.message : String(abortErr);
    // If transient retries exhausted but it's actually a Supabase-shaped error,
    // surface it as selectError so downstream fallbacks (statement timeout,
    // orderBy column missing) can still kick in.
    if (isBridgeTransient(abortErr)) {
      const selectDuration = Math.round(performance.now() - selectStart);
      emitTelemetry({ operation: 'select', table, limit: safeLimit, offset: safeOffset, countMode, durationMs: selectDuration, status: 'error', error: `transient retries exhausted: ${msg}` });
      return jsonResponse({ error: 'Backend instável — tente novamente em instantes' }, 503, corsHeaders);
    }
    selectData = null;
    selectError = { message: msg } as { message: string; code?: string };
    count = null;
  }

  const selectDuration = Math.round(performance.now() - selectStart);

  if (selectError) {
    if (table.startsWith('mv_') && isUnpopulatedMaterializedViewError(selectError.message)) {
      emitTelemetry({ operation: 'select', table, limit: safeLimit, offset: safeOffset, countMode, durationMs: selectDuration, status: 'ok', recordCount: 0 });
      console.warn(`[external-db-bridge] ${table} not populated yet; returning empty result`);
      return {
        records: [],
        count: 0,
        meta: { materialized_view_status: 'not_populated' },
      };
    }

    // On statement timeout for products, retry with even smaller limit and no count
    if (selectError.message?.includes('statement timeout') && safeLimit > 50) {
      console.warn(`[retry] ${table} timed out with limit=${safeLimit}, retrying with limit=50 and no count`);
      const retryStart = performance.now();
      let retryQuery = externalSupabase.from(table).select(effectiveSelect);
      if (filters) retryQuery = applyFilters(retryQuery, filters, categoryDescendants);
      if (id) retryQuery = retryQuery.eq('id', id);
      if (orderBy) retryQuery = retryQuery.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      retryQuery = retryQuery.range(safeOffset, safeOffset + 49);

      const { data: retryData, error: retryError } = await retryQuery;
      const retryDuration = Math.round(performance.now() - retryStart);

      if (retryError) {
        emitTelemetry({ operation: 'select', table, limit: 50, offset: safeOffset, countMode: 'none', durationMs: retryDuration, status: 'error', error: retryError.message });
        return jsonResponse({ error: retryError.message }, 400, corsHeaders);
      }

      let records = retryData || [];
      if (aliasType === 'technique') records = records.map(mapTechniqueRowToLegacyShape);
      if (aliasType === 'priceTable') records = records.map(mapPriceTableRowToLegacyShape);
      emitTelemetry({ operation: 'select', table, limit: 50, offset: safeOffset, countMode: 'none', durationMs: retryDuration, status: classifyDuration(retryDuration), recordCount: records.length });
      console.log(`[retry] Selected ${records.length} records from ${table} (offset=${safeOffset}, limit=50)`);
      return { records, count: null };
    }

    // Fallback: orderBy column missing or invalid (e.g. price_updated_at not yet provisioned)
    // Symptoms: PostgREST 42703 "column ... does not exist", or generic order-related failure.
    const errMsg = selectError.message || '';
    const errCode = (selectError as { code?: string }).code || '';
    const orderColumn = orderBy?.column;
    const looksLikeOrderFailure = !!orderColumn && (
      errCode === '42703' ||
      errMsg.includes(`column "${orderColumn}"`) ||
      errMsg.includes(`"${orderColumn}" does not exist`) ||
      (errMsg.toLowerCase().includes('order') && errMsg.includes(orderColumn))
    );

    if (orderBy && looksLikeOrderFailure) {
      console.warn(
        `[external-db-bridge] orderBy fallback: column "${orderColumn}" failed on table "${table}" ` +
        `(code=${errCode || 'n/a'}, msg="${errMsg}"). Retrying without orderBy. ` +
        `Caller origin: select="${effectiveSelect.slice(0, 80)}..." filters=${JSON.stringify(filters ?? {}).slice(0, 200)}`
      );

      const retryStart = performance.now();
      let retryQuery = queryCountMode
        ? externalSupabase.from(table).select(effectiveSelect, { count: queryCountMode })
        : externalSupabase.from(table).select(effectiveSelect);
      if (filters) retryQuery = applyFilters(retryQuery, filters, categoryDescendants);
      if (id) retryQuery = retryQuery.eq('id', id);
      // Intentionally skip .order() — that's the whole point of the fallback.
      retryQuery = retryQuery.range(safeOffset, safeOffset + safeLimit - 1);

      const { data: retryData, error: retryError, count: retryCount } = await retryQuery;
      const retryDuration = Math.round(performance.now() - retryStart);

      if (retryError) {
        emitTelemetry({ operation: 'select', table, limit: safeLimit, offset: safeOffset, countMode, durationMs: retryDuration, status: 'error', error: `orderBy-fallback failed: ${retryError.message}` });
        return jsonResponse({ error: retryError.message }, 400, corsHeaders);
      }

      let records = retryData || [];
      if (aliasType === 'technique') records = records.map(mapTechniqueRowToLegacyShape);
      if (aliasType === 'priceTable') records = records.map(mapPriceTableRowToLegacyShape);

      emitTelemetry({
        operation: 'select',
        table,
        limit: safeLimit,
        offset: safeOffset,
        countMode,
        durationMs: retryDuration,
        status: classifyDuration(retryDuration),
        recordCount: records.length,
        error: `orderBy-fallback applied (column=${orderColumn})`,
      });
      console.log(`[orderBy-fallback] Selected ${records.length} records from ${table} without orderBy (was: ${orderColumn})`);

      const result = { records, count: retryCount ?? null, meta: { orderBy_fallback: orderColumn } };
      // Listings dinâmicos (products) usam TTL curto (60s); estáticos usam default (10min).
      if (cacheKey) setCache(cacheKey, result, table === 'products' ? 60_000 : undefined);
      return result;
    }

    emitTelemetry({ operation: 'select', table, limit: safeLimit, offset: safeOffset, countMode, durationMs: selectDuration, status: 'error', error: selectError.message });
    return jsonResponse({ error: selectError.message }, 400, corsHeaders);
  }

  let records: unknown[] = (selectData ?? []) as unknown[];

  // Apply legacy row transforms for aliased tables
  const rowsAsRecords = () => records as Record<string, unknown>[];
  if (aliasType === 'technique') records = rowsAsRecords().map(mapTechniqueRowToLegacyShape);
  if (aliasType === 'priceTable') records = rowsAsRecords().map(mapPriceTableRowToLegacyShape);

  emitTelemetry({ operation: 'select', table, limit: safeLimit, offset: safeOffset, countMode, durationMs: selectDuration, status: classifyDuration(selectDuration), recordCount: records.length });
  console.log(`Selected ${records.length} records from ${table} (offset=${safeOffset}, limit=${safeLimit}, count=${count ?? 'n/a'})`);

  const result = { records, count: count ?? null };
  // Listings de products: TTL curto (60s) para refletir mudanças no catálogo;
  // tabelas estáticas (categories, suppliers, etc.): TTL default (10min).
  if (cacheKey) setCache(cacheKey, result, table === 'products' ? 60_000 : undefined);
  return result;
}

// ============================================
// INSERT
// ============================================

async function handleInsert(externalSupabase: any, table: string, opts: any) {
  const { data, isVirtual, corsHeaders } = opts;

  if (isVirtual) {
    if (!data?.product_id || !data?.technique_id) {
      return jsonResponse({ error: 'product_id e technique_id obrigatórios para inserção em product_print_areas' }, 400, corsHeaders);
    }
    const productId = data.product_id as string;
    const techniqueId = data.technique_id as string;
    const areaName = (data.area_name as string) || 'Área Principal';

    const { product, error: productError, missingColumn } = await fetchProductForVirtualAreas(externalSupabase, productId);
    if (missingColumn) return jsonResponse({ error: 'Áreas de personalização não disponíveis neste catálogo externo' }, 503, corsHeaders);
    if (productError) return jsonResponse({ error: productError.message }, 400, corsHeaders);
    if (!product) return jsonResponse({ error: `Produto '${productId}' não encontrado` }, 404, corsHeaders);

    const { updatedAreas, areaId, alreadyLinked } = addTechniqueToAreas(product.personalization_areas, techniqueId, areaName);

    if (!alreadyLinked) {
      const { data: updatedProduct, error: updateError } = await externalSupabase
        .from('products')
        .update({ personalization_areas: updatedAreas, updated_at: new Date().toISOString() })
        .eq('id', productId).select('id').maybeSingle();

      if (updateError) return jsonResponse({ error: updateError.message, details: updateError.details }, 400, corsHeaders);
      if (!updatedProduct) return jsonResponse({ error: `Produto '${productId}' não encontrado para atualização` }, 404, corsHeaders);
    }

    const virtualRecord = buildVirtualRecords(productId, updatedAreas)
      .find((r) => r.area_id === areaId && r.technique_id === techniqueId);
    const result = virtualRecord || { id: `${productId}::${areaId}::${techniqueId}`, product_id: productId, area_id: areaId, technique_id: techniqueId };
    console.log(`${alreadyLinked ? 'Already linked' : 'Inserted virtual record'} in ${table}:`, (result as any).id);
    return result;
  }

  // Standard insert
  const canInjectCreatedAt = !TABLES_WITHOUT_CREATED_AT.includes(table);
  const canInjectUpdatedAt = !TABLES_WITHOUT_UPDATED_AT.includes(table);
  const insertData: Record<string, unknown> = sanitizeExternalWriteData(table, {
    ...data,
    ...(canInjectUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
  });
  if (canInjectCreatedAt && !insertData.created_at) insertData.created_at = new Date().toISOString();

  console.log(`Inserting into ${table}:`, JSON.stringify(insertData).substring(0, 500));
  const { data: insertResult, error: insertError } = await externalSupabase.from(table).insert(insertData).select().single();

  if (insertError) {
    console.error('Insert error:', insertError.message, insertError.details, insertError.hint);
    return jsonResponse({ error: insertError.message, details: insertError.details, hint: insertError.hint }, 400, corsHeaders);
  }

  console.log(`Inserted record in ${table}:`, insertResult?.id);
  return insertResult;
}

// ============================================
// UPDATE
// ============================================

async function handleUpdate(externalSupabase: any, table: string, opts: any) {
  const { data, id, isVirtual, corsHeaders } = opts;

  if (isVirtual) {
    return jsonResponse({ error: 'Atualização direta de product_print_areas não suportada; atualize products.personalization_areas' }, 400, corsHeaders);
  }
  if (!id) return jsonResponse({ error: 'ID obrigatório para atualização' }, 400, corsHeaders);
  if (!data) return jsonResponse({ error: 'Dados obrigatórios para atualização' }, 400, corsHeaders);

  const canInjectUpdatedAt = !TABLES_WITHOUT_UPDATED_AT.includes(table);
  const updateData = sanitizeExternalWriteData(table, {
    ...data,
    ...(canInjectUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
  });

  console.log(`Updating ${table} id=${id}:`, JSON.stringify(updateData).substring(0, 500));
  const { data: updateResult, error: updateError } = await externalSupabase.from(table).update(updateData).eq('id', id).select().maybeSingle();

  if (updateError) {
    console.error('Update error:', updateError.message, updateError.details, updateError.hint);
    return jsonResponse({ error: updateError.message, details: updateError.details, hint: updateError.hint }, 400, corsHeaders);
  }
  if (!updateResult) return jsonResponse({ error: `Registro não encontrado em '${table}' com id='${id}'` }, 404, corsHeaders);

  console.log(`Updated record in ${table}:`, id);
  return updateResult;
}

// ============================================
// DELETE
// ============================================

async function handleDelete(externalSupabase: any, table: string, opts: any) {
  const { id, isVirtual, corsHeaders } = opts;

  if (!id) return jsonResponse({ error: 'ID obrigatório para exclusão' }, 400, corsHeaders);

  if (isVirtual) {
    const parsedId = parseVirtualId(id);
    if (!parsedId) return jsonResponse({ error: `ID virtual inválido: '${id}'` }, 400, corsHeaders);

    const { product, error: productError, missingColumn } = await fetchProductForVirtualAreas(externalSupabase, parsedId.productId);
    if (missingColumn) return jsonResponse({ error: 'Áreas de personalização não disponíveis neste catálogo externo' }, 503, corsHeaders);
    if (productError) return jsonResponse({ error: productError.message }, 400, corsHeaders);
    if (!product) return jsonResponse({ error: `Produto '${parsedId.productId}' não encontrado` }, 404, corsHeaders);

    const { updatedAreas, removed } = removeTechniqueFromAreas(product.personalization_areas, parsedId.areaId, parsedId.techniqueId);
    if (!removed) return jsonResponse({ error: `Registro não encontrado em '${table}' com id='${id}'` }, 404, corsHeaders);

    const { data: updatedProduct, error: updateError } = await externalSupabase
      .from('products')
      .update({ personalization_areas: updatedAreas, updated_at: new Date().toISOString() })
      .eq('id', parsedId.productId).select('id').maybeSingle();

    if (updateError) return jsonResponse({ error: updateError.message, details: updateError.details }, 400, corsHeaders);
    if (!updatedProduct) return jsonResponse({ error: `Produto '${parsedId.productId}' não encontrado para atualização` }, 404, corsHeaders);

    console.log(`Deleted virtual record from ${table}:`, id);
    return { success: true, deleted_id: id };
  }

  // Standard delete
  const { data: deleteResult, error: deleteError } = await externalSupabase.from(table).delete().eq('id', id).select('id').maybeSingle();

  if (deleteError) {
    console.error('Delete error:', deleteError.message, deleteError.details, deleteError.hint);
    return jsonResponse({ error: deleteError.message, details: deleteError.details, hint: deleteError.hint }, 400, corsHeaders);
  }
  if (!deleteResult) return jsonResponse({ error: `Registro não encontrado em '${table}' com id='${id}'` }, 404, corsHeaders);

  console.log(`Deleted record from ${table}:`, id);
  return { success: true, deleted_id: id };
}

// ============================================
// UPSERT (single row, merge on SKU)
// ============================================

async function handleUpsert(externalSupabase: any, table: string, opts: any) {
  const { data, corsHeaders } = opts;
  if (!data) return jsonResponse({ error: 'Dados obrigatórios para upsert' }, 400, corsHeaders);

  const canInjectCreatedAt = !TABLES_WITHOUT_CREATED_AT.includes(table);
  const canInjectUpdatedAt = !TABLES_WITHOUT_UPDATED_AT.includes(table);
  const upsertData: Record<string, unknown> = sanitizeExternalWriteData(table, {
    ...data,
    ...(canInjectUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
  });
  if (canInjectCreatedAt && !upsertData.created_at) upsertData.created_at = new Date().toISOString();

  // Default merge on 'sku' for products, 'id' for others
  const onConflict = table === 'products' ? 'sku' : 'id';

  console.log(`Upserting into ${table} (onConflict=${onConflict}):`, JSON.stringify(upsertData).substring(0, 500));
  const { data: result, error } = await externalSupabase
    .from(table)
    .upsert(upsertData, { onConflict })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Upsert error:', error.message, error.details, error.hint);
    return jsonResponse({ error: error.message, details: error.details, hint: error.hint }, 400, corsHeaders);
  }

  console.log(`Upserted record in ${table}:`, result?.id);
  return result;
}

// ============================================
// BATCH INSERT (multiple rows in one call)
// ============================================

async function handleBatchInsert(externalSupabase: any, table: string, opts: any) {
  const { data, corsHeaders, onConflict } = opts;

  if (!Array.isArray(data) || data.length === 0) {
    return jsonResponse({ error: 'batch_insert requer "data" como array não-vazio' }, 400, corsHeaders);
  }
  if (data.length > 100) {
    return jsonResponse({ error: 'batch_insert limitado a 100 registros por chamada' }, 400, corsHeaders);
  }

  const canInjectCreatedAt = !TABLES_WITHOUT_CREATED_AT.includes(table);
  const canInjectUpdatedAt = !TABLES_WITHOUT_UPDATED_AT.includes(table);
  const now = new Date().toISOString();

  const sanitizedRows = data.map((row: Record<string, unknown>) => {
    const sanitized = sanitizeExternalWriteData(table, {
      ...row,
      ...(canInjectUpdatedAt ? { updated_at: now } : {}),
    });
    if (canInjectCreatedAt && !sanitized.created_at) sanitized.created_at = now;
    return sanitized;
  });

  const useUpsert = !!onConflict;
  const conflictColumn = typeof onConflict === 'string' ? onConflict : (table === 'products' ? 'sku' : 'id');

  console.log(`Batch ${useUpsert ? 'upsert' : 'insert'} into ${table}: ${sanitizedRows.length} rows${useUpsert ? ` (onConflict=${conflictColumn})` : ''}`);

  let result, error;

  if (useUpsert) {
    const response = await externalSupabase
      .from(table)
      .upsert(sanitizedRows, { onConflict: conflictColumn, ignoreDuplicates: false })
      .select('id,sku,name');
    result = response.data;
    error = response.error;
  } else {
    const response = await externalSupabase
      .from(table)
      .insert(sanitizedRows)
      .select('id,sku,name');
    result = response.data;
    error = response.error;
  }

  if (error) {
    console.error('Batch insert error:', error.message, error.details, error.hint);
    return jsonResponse({
      error: error.message,
      details: error.details,
      hint: error.hint,
    }, 400, corsHeaders);
  }

  console.log(`Batch ${useUpsert ? 'upserted' : 'inserted'} ${result?.length ?? 0} records in ${table}`);
  return { records: result || [], count: result?.length ?? 0 };
}

// ============================================
// UTILITIES
// ============================================

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  const reqId = currentRequestId();
  let finalBody: unknown = body;
  if (reqId && body && typeof body === "object" && !Array.isArray(body)) {
    finalBody = { ...(body as Record<string, unknown>), request_id: reqId };
  }
  const headers: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' };
  if (reqId) headers[REQUEST_ID_HEADER] = reqId;
  return new Response(JSON.stringify(finalBody), { status, headers });
}

// FNV-1a 32-bit — barato e suficiente para chave de cache (não-criptográfico).
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * In-memory cache para reads públicos do catálogo.
 * Vive dentro da instância da edge function (mesma vida do worker).
 * Como mantemos a função quente via cron keep-alive a cada 4 min, o cache
 * sobrevive entre requests reais.
 *
 * - TTL: 60s (catálogo muda raramente)
 * - Tamanho máx: 200 entradas (evita memory bloat)
 * - Eviction: LRU simples via Map (delete+set restaura ordem de inserção)
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
type CacheEntry = { payload: string; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();

let cacheHitsTotal = 0;
let cacheMissesTotal = 0;

function buildCacheKey(table: string, body: any): string {
  const raw = JSON.stringify({
    o: body.operation,
    s: body.select ?? null,
    f: body.filters ?? null,
    ob: body.orderBy ?? null,
    l: body.limit ?? null,
    of: body.offset ?? null,
    cm: body.countMode ?? null,
    id: body.id ?? null,
  });
  // Prefixa com a tabela em texto puro para permitir invalidação seletiva.
  return `t:${table}|${fnv1aHash(raw)}`;
}

function getCachedResponse(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  // LRU touch: move para o final reordenando inserção
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.payload;
}

function setCachedResponse(key: string, payload: string): void {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    // Evict o mais antigo (primeiro no Map)
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Invalida todas as entradas de cache que referenciam a tabela tocada.
 * Como a key embute a tabela, fazemos full scan barato (max 200 entradas).
 */
function invalidateCacheForTable(table: string): void {
  const tagPrefix = `t:${table}|`;
  let removed = 0;
  for (const [key, entry] of responseCache.entries()) {
    // entry.payload contém o resultado, mas precisamos identificar pela tabela.
    // Reescrevemos buildCacheKey para anexar tag legível antes do hash.
    if (key.startsWith(tagPrefix)) {
      responseCache.delete(key);
      removed++;
    }
  }
  if (removed > 0) console.info(`🧹 [cache] invalidated ${removed} entries for table=${table}`);
}

function cachedJsonResponse(payload: string, corsHeaders: Record<string, string>, hit: boolean): Response {
  return new Response(payload, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Bridge-Cache': hit ? 'HIT' : 'MISS',
    },
  });
}

// ============================================
// EXTERNAL CLIENT — singleton por isolate
// ============================================
// Reusa o mesmo client entre requests do mesmo isolate. O fetch keep-alive
// interno do supabase-js mantém o socket aberto, eliminando TLS+auth handshake
// repetido em rajadas paralelas (catálogo, dashboards, batches).
// Em rajada de 6+ requests, isso reduz "tempo até a 1ª query" de ~800ms para ~50ms.
let cachedExternalClient: ServiceClient | null = null;
let warmupPromise: Promise<void> | null = null;

function buildExternalClient(url: string, key: string): ServiceClient {
  return castSupabaseClient(createClient(url, key, {
    db: { schema: 'public' },
    global: {
      headers: {
        'x-connection-timeout': '15000',
        // Increase PostgREST statement timeout to 25s to avoid premature cancellation
        'Prefer': 'max-affected=1000',
      },
    },
  }));
}

async function getExternalClient(corsHeaders: Record<string, string>) {
  if (cachedExternalClient) return cachedExternalClient;

  // SSOT: DB-first via integration_credentials, fallback to legacy env aliases
  // (EXTERNAL_SUPABASE_URL/EXTERNAL_SUPABASE_SERVICE_ROLE_KEY/EXTERNAL_SUPABASE_SERVICE_KEY).
  const [{ value: externalUrl }, { value: externalKey }] = await Promise.all([
    resolveCredential("EXTERNAL_PROMOBRIND_URL"),
    resolveCredential("EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY"),
  ]);
  if (!externalUrl || !externalKey) {
    console.warn('[external-db-bridge] EXTERNAL_PROMOBRIND_URL/KEY not configured (DB or env) — returning empty payload');
    return jsonResponse(
      { records: [], data: [], count: 0, _unconfigured: true, _message: 'Banco externo não configurado' },
      200,
      corsHeaders,
    );
  }
  cachedExternalClient = buildExternalClient(externalUrl, externalKey);
  return cachedExternalClient;
}

/**
 * Warm-up no boot do isolate — abre TLS + handshake PostgREST em paralelo
 * ao Deno.serve. Não bloqueia o handler; idempotente.
 */
function warmupExternalClient(): Promise<void> {
  if (warmupPromise) return warmupPromise;
  warmupPromise = (async () => {
    try {
      const [{ value: url }, { value: key }] = await Promise.all([
        resolveCredential("EXTERNAL_PROMOBRIND_URL"),
        resolveCredential("EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY"),
      ]);
      if (!url || !key) return;
      const client: ServiceClient = cachedExternalClient ?? (cachedExternalClient = buildExternalClient(url, key));
      const t0 = performance.now();
      const { error } = await client.from('suppliers').select('id').limit(1);
      const ms = Math.round(performance.now() - t0);
      if (error) {
        console.warn(`[boot-warmup] ⚠️ ${error.message} (${ms}ms)`);
      } else {
        console.log(`[boot-warmup] ✅ external client ready (${ms}ms)`);
      }
    } catch (e) {
      console.warn(`[boot-warmup] ⚠️ ${e instanceof Error ? e.message : String(e)}`);
    }
  })();
  return warmupPromise;
}

// Dispara warm-up no boot do isolate (não-bloqueante).
warmupExternalClient();

// Default lightweight columns for products table to avoid fetching heavy JSONB columns
const PRODUCTS_LIGHTWEIGHT_SELECT = 'id,name,sku,sale_price,cost_price,primary_image_url,category_id,main_category_id,supplier_id,supplier_reference,description,short_description,brand,is_active,active,stock_quantity,min_quantity,created_at,updated_at,is_featured,is_bestseller,is_new,is_on_sale,is_kit';

// ============================================
// PRODUCTS SELECT RESOLVER — single source of truth for the lightweight rule
// ============================================
// Centralizes the decision to swap the caller's `select` for `PRODUCTS_LIGHTWEIGHT_SELECT`.
// HARD GUARD: lightweight is ONLY applied when limit > LIGHTWEIGHT_LIMIT_THRESHOLD AND no `id` is set.
// This prevents regressions where detail/edit pages (id present, or limit ≤ 50) lose JSONB columns.
//
// Decision matrix (table === 'products'):
//   id present                              → keep caller's select (detail/edit)
//   limit ≤ 50                              → keep caller's select (small reads)
//   limit > 50 AND select is '*' or empty   → force lightweight  (Rule A)
//   limit > 50 AND select is very wide (>25 cols) → force lightweight  (Rule B)
//   limit > 50 AND select touches heavy JSONB     → force lightweight  (Rule C)
//   otherwise                               → keep caller's select
export const LIGHTWEIGHT_LIMIT_THRESHOLD = 50;

// Threshold (em número de colunas no select do caller) acima do qual forçamos
// lightweight como Rule B ("wide-select-listing"). Configurável via env
// LIGHTWEIGHT_COLUMN_THRESHOLD para permitir tuning sem redeploy de código —
// fallback para 25, valor empírico que cobre o PRODUCTS_LIGHTWEIGHT_SELECT (24 cols)
// com folga de 1 coluna para selects ligeiramente customizados.
function readColumnThresholdFromEnv(): number {
  try {
    // deno-lint-ignore no-explicit-any
    const denoGlobal = (globalThis as any).Deno;
    const raw = denoGlobal?.env?.get?.('LIGHTWEIGHT_COLUMN_THRESHOLD');
    if (!raw) return 25;
    const parsed = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 25;
    return parsed;
  } catch {
    return 25;
  }
}
export const WIDE_SELECT_COLUMN_THRESHOLD = readColumnThresholdFromEnv();

// Colunas confirmadas como JSONB pesados / arrays grandes / texto longo na tabela `products`.
// Fonte: inspeção empírica do payload SELECT * (148 cols → ver lightweightSelect.e2e.test.ts)
// e PRODUCTS_LIGHTWEIGHT_SELECT (subset das 24 colunas leves).
//
// Manter como Set para lookup O(1) e tokenização precisa (sem falsos positivos via substring).
export const HEAVY_PRODUCT_COLUMNS = new Set<string>([
  // JSONB / objects
  'metadata',
  'specifications',
  'attributes_json',
  'attributes',
  'personalization_areas',
  'schema_json',
  'dimensions',
  'seo_issues',
  // HTML / texto longo
  'description_html',
  'description_packaging_info',
  'meta_description',
  'meta_keywords',
  'ai_description',
  'ai_summary',
  // Arrays / JSON arrays grandes
  'images',
  'videos',
  'tags',
  'key_benefits',
  'capacities',
  'combined_sizes',
  'use_cases',
  'target_audience',
  'colors',
  'materials',
]);

// Extrai o nome canônico de uma coluna PostgREST a partir de um token de select.
// Suporta:
//   "name"                    → "name"
//   "alias:column"            → "column"          (alias PostgREST)
//   "metadata->>summary"      → "metadata"        (operador JSON)
//   "metadata->path->>x"      → "metadata"
//   "alias:metadata->>x"      → "metadata"
//   "table(col1,col2)"        → ""                (embed — não é coluna direta)
//   "  spaced  "              → "spaced"
// Retorna '' quando o token não representa uma coluna direta da tabela base
// (embeds não devem disparar o detector de "heavy").
export function extractBaseColumn(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  // Embed PostgREST (joins): "fk_table(...)" — não é uma coluna direta da base.
  if (trimmed.includes('(')) return '';
  // Remove alias PostgREST "alias:column"
  const afterAlias = trimmed.includes(':') ? trimmed.slice(trimmed.indexOf(':') + 1) : trimmed;
  // Remove operadores JSON "->" e "->>"
  const beforeArrow = afterAlias.split('->')[0];
  return beforeArrow.trim();
}

// Detecta se o select do caller toca uma coluna pesada da tabela `products`.
// Usa tokenização com boundary (não regex bruto) para evitar falsos positivos
// como `meta_description` casando dentro de `meta_description_id`.
export function callerSelectIsHeavy(select: string): boolean {
  for (const rawToken of select.split(',')) {
    const col = extractBaseColumn(rawToken);
    if (col && HEAVY_PRODUCT_COLUMNS.has(col)) return true;
  }
  return false;
}

export interface ResolveProductsSelectInput {
  table: string;
  select: string | undefined | null;
  limit: number | undefined | null;
  hasId: boolean;
}

export interface ResolveProductsSelectResult {
  effectiveSelect: string;
  forcedLightweight: boolean;
  reason:
    | 'not-products'
    | 'has-id'
    | 'small-limit'
    | 'star-select-listing'
    | 'wide-select-listing'
    | 'heavy-jsonb-listing'
    | 'caller-select';
}

export function resolveProductsSelect(input: ResolveProductsSelectInput): ResolveProductsSelectResult {
  const { table, select, limit, hasId } = input;
  const callerSelect = select && select.length > 0 ? select : '*';

  if (table !== 'products') {
    return { effectiveSelect: callerSelect, forcedLightweight: false, reason: 'not-products' };
  }
  if (hasId) {
    return { effectiveSelect: callerSelect, forcedLightweight: false, reason: 'has-id' };
  }

  const safeLimit = typeof limit === 'number' && limit > 0 ? limit : 0;
  // HARD GUARD against regression: never force lightweight on small reads.
  if (safeLimit <= LIGHTWEIGHT_LIMIT_THRESHOLD) {
    return { effectiveSelect: callerSelect, forcedLightweight: false, reason: 'small-limit' };
  }

  const isStarOrEmpty = !select || select === '*';
  if (isStarOrEmpty) {
    return { effectiveSelect: PRODUCTS_LIGHTWEIGHT_SELECT, forcedLightweight: true, reason: 'star-select-listing' };
  }
  if (select.split(',').length > WIDE_SELECT_COLUMN_THRESHOLD) {
    return { effectiveSelect: PRODUCTS_LIGHTWEIGHT_SELECT, forcedLightweight: true, reason: 'wide-select-listing' };
  }
  if (callerSelectIsHeavy(select)) {
    return { effectiveSelect: PRODUCTS_LIGHTWEIGHT_SELECT, forcedLightweight: true, reason: 'heavy-jsonb-listing' };
  }

  return { effectiveSelect: callerSelect, forcedLightweight: false, reason: 'caller-select' };
}

// ============================================
// STRUCTURED SELECT-DECISION LOG
// ============================================
// Emite UM log estruturado por decisão de `select`, em ambos os call sites
// (handleSelect e handleBatch). Permite filtrar por `event=select-decision`
// no painel de logs e cruzar com telemetria — inclui sempre tabela, limit
// efetivo e motivo (default vs forçado).
export interface SelectDecisionLogContext {
  callSite: 'handleSelect' | 'handleBatch';
  table: string;
  callerSelect: string | undefined | null;
  effectiveLimit: number;
  hasId: boolean;
  resolved: ResolveProductsSelectResult;
}

const LIGHTWEIGHT_REASONS = new Set<ResolveProductsSelectResult['reason']>([
  'star-select-listing',
  'wide-select-listing',
  'heavy-jsonb-listing',
]);

export function logSelectDecision(ctx: SelectDecisionLogContext): void {
  const { callSite, table, callerSelect, effectiveLimit, hasId, resolved } = ctx;
  const callerLen = (callerSelect ?? '').split(',').filter(Boolean).length;
  const effectiveLen = resolved.effectiveSelect.split(',').filter(Boolean).length;

  const payload = {
    event: 'select-decision',
    callSite,
    table,
    forcedLightweight: resolved.forcedLightweight,
    mode: resolved.forcedLightweight ? 'lightweight-forced' : 'caller-default',
    reason: resolved.reason,
    effectiveLimit,
    hasId,
    limitThreshold: LIGHTWEIGHT_LIMIT_THRESHOLD,
    columnThreshold: WIDE_SELECT_COLUMN_THRESHOLD,
    // mantido para compat com dashboards já existentes
    threshold: LIGHTWEIGHT_LIMIT_THRESHOLD,
    callerSelect: callerSelect && callerSelect.length > 120
      ? `${callerSelect.slice(0, 117)}...`
      : (callerSelect ?? '(omitted)'),
    callerColumnCount: callerLen,
    effectiveColumnCount: effectiveLen,
    exceededColumnThreshold: callerLen > WIDE_SELECT_COLUMN_THRESHOLD,
  };

  if (resolved.forcedLightweight) {
    console.log(
      `[external-db-bridge] ⚡ select-decision table=${table} mode=lightweight-forced reason=${resolved.reason} ` +
      `limit=${effectiveLimit} (>${LIGHTWEIGHT_LIMIT_THRESHOLD}) caller_cols=${callerLen} ` +
      `(col_threshold=${WIDE_SELECT_COLUMN_THRESHOLD}) effective_cols=${effectiveLen} ` +
      `callSite=${callSite} → ${JSON.stringify(payload)}`,
    );
    return;
  }

  // Para não poluir os logs de queries triviais, só registramos o "default"
  // em situações onde a decisão é informativa: tabela `products` com qualquer limit,
  // ou outras tabelas quando o limit ultrapassa o threshold (poderia ter sido afetado).
  const isInformative =
    table === 'products' ||
    LIGHTWEIGHT_REASONS.has(resolved.reason) || // defesa: nunca cai aqui, mas explícito
    effectiveLimit > LIGHTWEIGHT_LIMIT_THRESHOLD;

  if (isInformative) {
    console.log(
      `[external-db-bridge] · select-decision table=${table} mode=caller-default reason=${resolved.reason} ` +
      `limit=${effectiveLimit} hasId=${hasId} caller_cols=${callerLen} ` +
      `(col_threshold=${WIDE_SELECT_COLUMN_THRESHOLD}) callSite=${callSite} → ${JSON.stringify(payload)}`,
    );
  }
}
