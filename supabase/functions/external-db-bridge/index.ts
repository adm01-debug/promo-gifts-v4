// supabase/functions/external-db-bridge/index.ts
// Lean orchestrator — delegates config, aliases, telemetry and cache to shared modules.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/json-response.ts";
import {
  getExternalDbConfig,
  TABLE_ALIASES,
  BRIDGE_ALIASES,
  PRODUCT_TABLES,
  ALLOWED_RPCS,
  COMPANY_TABLES,
  TYPE_ALIASES,
} from "../_shared/external-db-config.ts";
import {
  applyTableAlias,
  applyFiltersWithAlias,
  applySelectWithAlias,
  applyOrderWithAlias,
  remapInsertPayload,
  remapUpdatePayload,
  AliasedRow,
} from "../_shared/external-db-aliases.ts";
import {
  initTelemetry,
  trackSuccess,
  trackError,
  trackRateLimit,
  trackBlocked,
} from "../_shared/external-db-telemetry.ts";
import { getCachedResponse, setCachedResponse } from "../_shared/external-db-cache.ts";
import { getBreaker, circuitOpenResponse } from "../_shared/circuit-breaker.ts";
import { retrySupabaseCall } from "../_shared/retry-backoff.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "../_shared/request-id.ts";
import { resolveCredential } from "../_shared/credentials.ts";
import { constantTimeEqual } from "../_shared/dispatcher-auth.ts";
import { assertSwitchEnabled } from "../_shared/kill_switch.ts";

const breaker = getBreaker("external-db");

// Contexto async por-request — propaga requestId para jsonResponse() sem
// precisar passar como argumento por toda a árvore de handlers.
const requestCtx = new AsyncLocalStorage<{ requestId: string }>();

// ==================== Schema Validation ====================

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const SelectOperationSchema = z.object({
  operation: z.literal("select"),
  table: z.string().min(1),
  select: z.string().optional(),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  orderBy: z.string().optional(),
  orderDir: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonneg().optional(),
  targetDb: z.string().optional(),
  companyId: z.string().optional(),
});

const InsertOperationSchema = z.object({
  operation: z.literal("insert"),
  table: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  targetDb: z.string().optional(),
  companyId: z.string().optional(),
});

const UpdateOperationSchema = z.object({
  operation: z.literal("update"),
  table: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  targetDb: z.string().optional(),
  companyId: z.string().optional(),
});

const DeleteOperationSchema = z.object({
  operation: z.literal("delete"),
  table: z.string().min(1),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  targetDb: z.string().optional(),
  companyId: z.string().optional(),
});

const UpsertOperationSchema = z.object({
  operation: z.literal("upsert"),
  table: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  targetDb: z.string().optional(),
  companyId: z.string().optional(),
});

const RpcOperationSchema = z.object({
  operation: z.literal("rpc"),
  fn: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  targetDb: z.string().optional(),
  companyId: z.string().optional(),
});

const AnyOperationSchema = z.discriminatedUnion("operation", [
  SelectOperationSchema,
  InsertOperationSchema,
  UpdateOperationSchema,
  DeleteOperationSchema,
  UpsertOperationSchema,
  RpcOperationSchema,
]);

const TopLevelBodySchema = z.object({
  operations: z.array(AnyOperationSchema).min(1).max(50),
  requestId: z.string().optional(),
});

// ==================== Rate Limiting ====================

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 1000;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

// ==================== Security ====================

const WIDE_SELECT_COLUMN_THRESHOLD = 30;

// ==================== Main Handler ====================

Deno.serve((req) => {
  const requestId = getOrCreateRequestId(req);
  return requestCtx.run({ requestId }, () => handleRequest(req, requestId));
});

async function handleRequest(req: Request, requestId: string): Promise<Response> {
  let corsHeadersResolved: Record<string, string> = {};

  try {
    corsHeadersResolved = handleCors(req, corsHeaders);
  } catch (e) {
    console.error(`[external-db-bridge] CORS init failed: ${(e as Error).message}`);
  }

  // ============================================
  // KILL-SWITCH (causa raiz do colapso 2026-05-24)
  // external-db-bridge foi aposentada no "Caminho B" (PostgREST nativo).
  // Clientes legados ainda batem aqui em loop (30–50 req/s), e cada chamada
  // dispara 5–7 sub-queries → satura o pool de conexões. Quando o switch
  // `edge_external_db_bridge` está OFF, respondemos 410 Gone ANTES de criar
  // qualquer client / ler credenciais / tocar no banco. Fail-open por design.
  // Ver docs/RELATORIO_COLAPSO_2026-05-24.md.
  // ============================================
  const goneResponse = await assertSwitchEnabled("edge_external_db_bridge", req, corsHeadersResolved);
  if (goneResponse) return goneResponse;

  const requestStartTime = performance.now();
  console.log(`[external-db-bridge] [req_id=${requestId}] request_start method=${req.method}`);

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeadersResolved);
    }

    const parsed = TopLevelBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse(
        { error: 'Invalid request body', details: parsed.error.format() },
        400,
        corsHeadersResolved
      );
    }

    const { operations } = parsed.data;
    const results = [];

    for (const op of operations) {
      const opResult = await processOperation(op, req, corsHeadersResolved, requestId);
      results.push(opResult);
    }

    const elapsed = performance.now() - requestStartTime;
    console.log(`[external-db-bridge] [req_id=${requestId}] request_complete elapsed_ms=${elapsed.toFixed(1)} ops=${operations.length}`);

    return jsonResponse({ results }, 200, corsHeadersResolved);

  } catch (error) {
    const elapsed = performance.now() - requestStartTime;
    console.error(`[external-db-bridge] [req_id=${requestId}] unhandled_error elapsed_ms=${elapsed.toFixed(1)}`, error);
    return jsonResponse({ error: 'Internal server error' }, 500, corsHeadersResolved);
  }
}

// ==================== Operation Processor ====================

async function processOperation(
  op: z.infer<typeof AnyOperationSchema>,
  req: Request,
  cors: Record<string, string>,
  requestId: string
): Promise<unknown> {
  const telemetry = initTelemetry(op.operation, 'table' in op ? op.table : ('fn' in op ? op.fn : 'unknown'));

  try {
    // Resolve credential for this operation's target
    const credential = await resolveCredential(op);
    if (!credential) {
      trackError(telemetry, 'credential_resolution_failed');
      return { error: 'credential_resolution_failed', records: [], count: 0 };
    }

    // Check dispatcher auth if required
    const dispatcherAuth = req.headers.get('x-dispatcher-auth');
    if (credential.requiresDispatcherAuth && dispatcherAuth) {
      if (!constantTimeEqual(dispatcherAuth, credential.dispatcherAuthSecret ?? '')) {
        trackBlocked(telemetry, 'dispatcher_auth_mismatch');
        return { error: 'dispatcher_auth_mismatch', records: [], count: 0 };
      }
    }

    // Rate limiting per credential
    if (!checkRateLimit(credential.id)) {
      trackRateLimit(telemetry);
      return { error: 'rate_limit_exceeded', records: [], count: 0 };
    }

    // Circuit breaker
    if (!breaker.isAllowed()) {
      return circuitOpenResponse(cors);
    }

    // Route to appropriate handler
    let result: unknown;
    if (op.operation === 'rpc') {
      result = await handleRpc(op, credential, requestId);
    } else {
      result = await handleCrud(op, credential, requestId);
    }

    trackSuccess(telemetry);
    return result;

  } catch (error) {
    breaker.recordFailure();
    trackError(telemetry, error instanceof Error ? error.message : 'unknown');
    console.error(`[external-db-bridge] [req_id=${requestId}] operation_error op=${op.operation}`, error);
    return { error: 'operation_failed', records: [], count: 0 };
  }
}

// ==================== CRUD Handler ====================

async function handleCrud(
  op: z.infer<typeof SelectOperationSchema> | z.infer<typeof InsertOperationSchema> | z.infer<typeof UpdateOperationSchema> | z.infer<typeof DeleteOperationSchema> | z.infer<typeof UpsertOperationSchema>,
  credential: Awaited<ReturnType<typeof resolveCredential>>,
  requestId: string
): Promise<unknown> {
  if (!credential) return { error: 'no_credential', records: [], count: 0 };

  const config = await getExternalDbConfig(credential);
  const client = createClient(config.url, config.key);

  const resolvedTable = applyTableAlias(op.table, TABLE_ALIASES, BRIDGE_ALIASES);

  // Whitelist check
  const isProductTable = PRODUCT_TABLES.has(op.table) || PRODUCT_TABLES.has(resolvedTable);
  const isCompanyTable = COMPANY_TABLES.has(op.table) || COMPANY_TABLES.has(resolvedTable);

  if (!isProductTable && !isCompanyTable) {
    return { error: `table_not_allowed: ${op.table}`, records: [], count: 0 };
  }

  // Cache for SELECT
  if (op.operation === 'select') {
    const cacheKey = JSON.stringify({ table: resolvedTable, filters: op.filters, select: op.select });
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;
  }

  let query = client.from(resolvedTable);
  let result: unknown;

  switch (op.operation) {
    case 'select': {
      const selectStr = op.select
        ? applySelectWithAlias(op.select, resolvedTable, TYPE_ALIASES)
        : '*';
      let q = query.select(selectStr);
      if (op.filters) q = applyFiltersWithAlias(q as any, op.filters, resolvedTable, TYPE_ALIASES) as any;
      if (op.orderBy) q = (q as any).order(applyOrderWithAlias(op.orderBy, resolvedTable, TYPE_ALIASES), { ascending: op.orderDir !== 'desc' });
      if (op.limit) q = (q as any).limit(op.limit);
      if (op.offset) q = (q as any).range(op.offset, op.offset + (op.limit ?? 100) - 1);
      const { data, error, count } = await retrySupabaseCall(() => (q as any).returns<AliasedRow[]>());
      if (error) return { error: error.message, records: [], count: 0 };
      const records = data ?? [];
      const cacheKey = JSON.stringify({ table: resolvedTable, filters: op.filters, select: op.select });
      setCachedResponse(cacheKey, { records, count: count ?? records.length });
      result = { records, count: count ?? records.length };
      break;
    }
    case 'insert': {
      const payload = remapInsertPayload(op.payload, resolvedTable, TYPE_ALIASES);
      const { data, error } = await retrySupabaseCall(() => query.insert(payload as any).select());
      if (error) return { error: error.message, records: [], count: 0 };
      result = { records: data ?? [], count: (data ?? []).length };
      break;
    }
    case 'update': {
      const payload = remapUpdatePayload(op.payload, resolvedTable, TYPE_ALIASES);
      let q = query.update(payload as any);
      if (op.filters) q = applyFiltersWithAlias(q as any, op.filters, resolvedTable, TYPE_ALIASES) as any;
      const { data, error } = await retrySupabaseCall(() => (q as any).select());
      if (error) return { error: error.message, records: [], count: 0 };
      result = { records: data ?? [], count: (data ?? []).length };
      break;
    }
    case 'delete': {
      let q = query.delete();
      if (op.filters) q = applyFiltersWithAlias(q as any, op.filters, resolvedTable, TYPE_ALIASES) as any;
      const { error } = await retrySupabaseCall(() => (q as any));
      if (error) return { error: error.message, records: [], count: 0 };
      result = { records: [], count: 0 };
      break;
    }
    case 'upsert': {
      const payload = remapInsertPayload(op.payload, resolvedTable, TYPE_ALIASES);
      const { data, error } = await retrySupabaseCall(() => query.upsert(payload as any).select());
      if (error) return { error: error.message, records: [], count: 0 };
      result = { records: data ?? [], count: (data ?? []).length };
      break;
    }
    default:
      return { error: 'unsupported_operation', records: [], count: 0 };
  }

  breaker.recordSuccess();
  return result;
}

// ==================== RPC Handler ====================

async function handleRpc(
  op: z.infer<typeof RpcOperationSchema>,
  credential: Awaited<ReturnType<typeof resolveCredential>>,
  requestId: string
): Promise<unknown> {
  if (!credential) return { error: 'no_credential', records: [], count: 0 };

  if (!ALLOWED_RPCS.has(op.fn)) {
    return { error: `rpc_not_allowed: ${op.fn}`, records: [], count: 0 };
  }

  const config = await getExternalDbConfig(credential);
  const client = createClient(config.url, config.key);

  const { data, error } = await retrySupabaseCall(() =>
    client.rpc(op.fn, op.params ?? {})
  );

  if (error) return { error: error.message, records: [], count: 0 };

  const records = Array.isArray(data) ? data : [data];
  breaker.recordSuccess();
  return { records, count: records.length };
}

// ==================== Security Audit ====================

function auditWideSelect(callSite: string, payload: unknown): void {
  if (!payload || typeof payload !== 'object' || !('select' in payload)) return;
  const selectStr = (payload as { select?: string }).select ?? '*';
  if (selectStr === '*') return;
  const columns = selectStr.split(',').map((c) => c.trim()).filter(Boolean);
  if (columns.length > WIDE_SELECT_COLUMN_THRESHOLD) {
    console.warn(
      `[external-db-bridge] wide_select detected cols=${columns.length} threshold=${WIDE_SELECT_COLUMN_THRESHOLD}) callSite=${callSite} → ${JSON.stringify(payload)}`,
    );
  }
}
