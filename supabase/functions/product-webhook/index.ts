import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { parseContract } from '../_shared/contracts/index.ts';
import {
  ProductWebhookSchemas,
  type ProductWebhookV1Payload,
  type ProductWebhookV2Payload,
} from '../_shared/contracts/schemas/product-webhook.ts';
import type { Database } from '../../../src/integrations/supabase/types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('N8N_PRODUCT_WEBHOOK_SECRET');
const configuredBatchSize = Number(Deno.env.get('PRODUCT_WEBHOOK_BATCH_SIZE') ?? '200');
const MAX_BATCH_SIZE = 500;
const BATCH_SIZE = Number.isFinite(configuredBatchSize)
  ? Math.min(Math.max(Math.trunc(configuredBatchSize), 100), MAX_BATCH_SIZE)
  : 200;
const DEFAULT_WEBHOOK_TOLERANCE_SEC = 300;
const MAX_WEBHOOK_TOLERANCE_SEC = 3600;
const configuredWebhookToleranceSec = Number(
  Deno.env.get('N8N_PRODUCT_WEBHOOK_TOLERANCE_SEC') ?? DEFAULT_WEBHOOK_TOLERANCE_SEC,
);
const webhookTimestampToleranceSec =
  Number.isFinite(configuredWebhookToleranceSec) && configuredWebhookToleranceSec > 0
    ? Math.min(Math.floor(configuredWebhookToleranceSec), MAX_WEBHOOK_TOLERANCE_SEC)
    : DEFAULT_WEBHOOK_TOLERANCE_SEC;

const allowedOrigins = new Set(
  (Deno.env.get('PRODUCT_WEBHOOK_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const CORS_ALLOW_HEADERS = [
  'accept-version',
  'content-type',
  'x-webhook-signature',
  'x-webhook-timestamp',
  'x-webhook-nonce',
];

const UNAUTHORIZED_BODY = JSON.stringify({
  code: 'unauthorized',
  message: 'Unauthorized',
  fields: [],
});

type ProductPayload =
  | NonNullable<ProductWebhookV1Payload['product']>
  | NonNullable<ProductWebhookV2Payload['product']>;

type NormalizedProduct = {
  external_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  min_quantity: number;
  category_id: string | null;
  category_name: string | null;
  subcategory: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  stock: number;
  stock_status: string;
  is_kit: boolean;
  is_active: boolean;
  featured: boolean;
  new_arrival: boolean;
  on_sale: boolean;
  images: string[];
  video_url: string | null;
  colors: unknown[];
  materials: string[];
  tags: Record<string, unknown>;
  kit_items: unknown[];
  variations: unknown[];
  metadata: Record<string, unknown>;
  synced_at: string;
};

type UpsertOutcome = {
  created: number;
  updated: number;
  failed: number;
  processed: number;
  errors: string[];
  db_roundtrips: number;
  duration_ms: number;
  chunk_metrics: Array<{
    chunk: number;
    received: number;
    processed: number;
    duration_ms: number;
    db_roundtrips: number;
    created: number;
    updated: number;
    failed: number;
  }>;
};

function getRequestCorsHeaders(req: Request): Record<string, string> {
  const base = getCorsHeaders(req);
  const requestOrigin = req.headers.get('origin') ?? '';
  const isAllowedOrigin = requestOrigin && allowedOrigins.has(requestOrigin);

  if (requestOrigin && !isAllowedOrigin) {
    return {
      ...base,
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS.join(', '),
      Vary: 'Origin',
    };
  }

  return {
    ...base,
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS.join(', '),
    Vary: 'Origin',
  };
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return encodeHex(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function isReplayNonce(
  supabase: SupabaseClient<Database>,
  nonce: string,
  timestamp: number,
): Promise<boolean> {
  const expiresAt = new Date((timestamp + webhookTimestampToleranceSec) * 1000).toISOString();

  const { error } = await supabase.from('webhook_request_nonces' as never).insert({
    source: 'product-webhook',
    nonce,
    request_timestamp: new Date(timestamp * 1000).toISOString(),
    expires_at: expiresAt,
  } as never);

  if (!error) return false;
  if (error.code === '23505') return true;
  throw error;
}

function logAuthFailure(reason: string, req: Request, details: Record<string, unknown> = {}) {
  const sourceIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const origin = req.headers.get('origin') || 'none';
  const ua = req.headers.get('user-agent') || 'unknown';
  console.error(
    JSON.stringify({
      event: 'product_webhook_auth_failed',
      reason,
      origin,
      sourceIp,
      ua,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getRequestCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();

    if (!webhookSecret) {
      logAuthFailure('misconfigured_secret', req);
      return new Response(UNAUTHORIZED_BODY, {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signatureHeader = req.headers.get('x-webhook-signature') || '';
    const nonce = req.headers.get('x-webhook-nonce') || '';
    const timestampHeader = req.headers.get('x-webhook-timestamp') || '';
    const timestamp = Number(timestampHeader);

    if (!signatureHeader || !nonce || !timestampHeader || !Number.isFinite(timestamp)) {
      logAuthFailure('missing_signature_headers', req, {
        hasSignature: Boolean(signatureHeader),
        hasNonce: Boolean(nonce),
        hasTimestamp: Boolean(timestampHeader),
      });
      return new Response(UNAUTHORIZED_BODY, {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestamp) > webhookTimestampToleranceSec) {
      logAuthFailure('timestamp_out_of_window', req, {
        nowSec,
        reqTimestamp: timestamp,
        toleranceSec: webhookTimestampToleranceSec,
      });
      return new Response(UNAUTHORIZED_BODY, {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signingMessage = `${timestampHeader}.${nonce}.${rawBody}`;
    const expectedSig = await hmacSign(signingMessage, webhookSecret);
    const normalizedProvidedSig = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7)
      : signatureHeader;

    if (!timingSafeEqual(expectedSig, normalizedProvidedSig)) {
      logAuthFailure('invalid_signature', req, {
        providedSigPrefix: normalizedProvidedSig.slice(0, 8),
      });
      return new Response(UNAUTHORIZED_BODY, {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const replayed = await isReplayNonce(supabase, nonce, timestamp);
    if (replayed) {
      logAuthFailure('replayed_nonce', req, { nonceSize: nonce.length });
      return new Response(UNAUTHORIZED_BODY, {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await parseContract(req, ProductWebhookSchemas, {
      corsHeaders,
      prereadBody: rawBody,
    });
    if (!result.ok) return result.response;

    const { version, data, responseHeaders } = result;
    const okHeaders = { ...corsHeaders, ...responseHeaders, 'Content-Type': 'application/json' };

    console.log(`[product-webhook] version=${version} action=${data.action}`);

    const products = data.products as ProductPayload[] | undefined;
    const singleProduct = data.product as ProductPayload | undefined;
    const externalIds = data.external_ids as string[] | undefined;
    const productsReceived = products?.length || (singleProduct ? 1 : 0);

    const { data: syncLog, error: logError } = await supabase
      .from('product_sync_logs')
      .insert({
        status: 'processing',
        source: version === '2' ? 'n8n_v2' : 'n8n',
        products_received: productsReceived,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
    }

    const syncLogId = syncLog?.id;

    let outcome: UpsertOutcome = {
      created: 0,
      updated: 0,
      failed: 0,
      processed: 0,
      errors: [],
      db_roundtrips: 0,
      duration_ms: 0,
      chunk_metrics: [],
    };

    switch (data.action) {
      case 'upsert': {
        if (!singleProduct) {
          throw new Error('Product data is required for upsert action');
        }
        outcome = await upsertProducts(supabase, [singleProduct], BATCH_SIZE);
        break;
      }

      case 'batch_upsert':
      case 'sync': {
        if (!products || products.length === 0) {
          throw new Error('Products array is required for batch_upsert/sync action');
        }
        outcome = await upsertProducts(supabase, products, BATCH_SIZE);
        break;
      }

      case 'delete': {
        if (!externalIds || externalIds.length === 0) {
          throw new Error('external_ids array is required for delete action');
        }
        const { error: deleteError, count } = await supabase
          .from('products')
          .delete()
          .in('external_id', externalIds);
        if (deleteError) throw deleteError;
        outcome = { ...outcome, processed: externalIds.length, db_roundtrips: 1 };
        console.log(`Deleted ${count} products`);
        break;
      }

      default:
        throw new Error(`Unknown action: ${(data as { action: string }).action}`);
    }

    if (syncLogId) {
      await supabase
        .from('product_sync_logs')
        .update({
          status: outcome.failed > 0 ? 'partial' : 'completed',
          products_created: outcome.created,
          products_updated: outcome.updated,
          products_failed: outcome.failed,
          records_processed: outcome.processed,
          duration_ms: outcome.duration_ms,
          payload: {
            batch_size: BATCH_SIZE,
            db_roundtrips: outcome.db_roundtrips,
            chunk_metrics: outcome.chunk_metrics,
          },
          error_message: outcome.errors.length > 0 ? outcome.errors.join('; ') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: outcome.created,
        updated: outcome.updated,
        failed: outcome.failed,
        processed: outcome.processed,
        duration_ms: outcome.duration_ms,
        db_roundtrips: outcome.db_roundtrips,
        chunk_metrics: outcome.chunk_metrics,
        errors: outcome.errors,
        sync_log_id: syncLogId,
      }),
      { headers: okHeaders },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Product webhook error:', error);
    return new Response(
      JSON.stringify({ code: 'internal_error', message: errorMessage, fields: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function upsertProducts(
  supabase: SupabaseClient<Database>,
  products: ProductPayload[],
  chunkSize: number,
): Promise<UpsertOutcome> {
  const startedAt = Date.now();
  const normalized = products.map(normalizeProduct);
  const chunks = chunkArray(normalized, chunkSize);

  let created = 0;
  let updated = 0;
  let failed = 0;
  let processed = 0;
  let db_roundtrips = 0;
  const errors: string[] = [];
  const chunk_metrics: UpsertOutcome['chunk_metrics'] = [];

  for (const [index, chunk] of chunks.entries()) {
    const chunkStart = Date.now();
    let chunkRoundtrips = 0;
    try {
      const externalIds = Array.from(
        new Set(chunk.map((item) => item.external_id).filter(Boolean)),
      ) as string[];
      const skus = Array.from(new Set(chunk.map((item) => item.sku).filter(Boolean)));

      let existingRows: Array<{ id: string; external_id: string | null; sku: string | null }> = [];
      if (externalIds.length > 0 || skus.length > 0) {
        const filters: string[] = [];
        if (externalIds.length > 0) filters.push(`external_id.in.(${externalIds.join(',')})`);
        if (skus.length > 0) filters.push(`sku.in.(${skus.join(',')})`);

        const { data: existingData, error: existingError } = await supabase
          .from('products')
          .select('id,external_id,sku')
          .or(filters.join(','));
        chunkRoundtrips += 1;
        if (existingError) throw existingError;
        existingRows = existingData ?? [];
      }

      const existingByExternalId = new Map(
        existingRows
          .filter((row) => row.external_id)
          .map((row) => [row.external_id as string, row]),
      );
      const existingBySku = new Map(
        existingRows.filter((row) => row.sku).map((row) => [row.sku as string, row]),
      );

      let chunkCreated = 0;
      let chunkUpdated = 0;

      const withExternalId: NormalizedProduct[] = [];
      const withoutExternalId: NormalizedProduct[] = [];

      for (const item of chunk) {
        const existing = item.external_id
          ? (existingByExternalId.get(item.external_id) ?? existingBySku.get(item.sku))
          : existingBySku.get(item.sku);

        if (existing) {
          chunkUpdated += 1;
          if (!item.external_id && existing.external_id) item.external_id = existing.external_id;
        } else {
          chunkCreated += 1;
        }

        if (item.external_id) {
          withExternalId.push(item);
        } else {
          withoutExternalId.push(item);
        }
      }

      if (withExternalId.length > 0) {
        const { error: upsertByExternalError } = await supabase
          .from('products')
          .upsert(withExternalId as never, { onConflict: 'external_id', ignoreDuplicates: false });
        chunkRoundtrips += 1;
        if (upsertByExternalError) throw upsertByExternalError;
      }

      if (withoutExternalId.length > 0) {
        const { error: upsertBySkuError } = await supabase
          .from('products')
          .upsert(withoutExternalId as never, { onConflict: 'sku', ignoreDuplicates: false });
        chunkRoundtrips += 1;
        if (upsertBySkuError) throw upsertBySkuError;
      }

      created += chunkCreated;
      updated += chunkUpdated;
      processed += chunk.length;
      db_roundtrips += chunkRoundtrips;

      const chunkDuration = Date.now() - chunkStart;
      chunk_metrics.push({
        chunk: index + 1,
        received: chunk.length,
        processed: chunk.length,
        duration_ms: chunkDuration,
        db_roundtrips: chunkRoundtrips,
        created: chunkCreated,
        updated: chunkUpdated,
        failed: 0,
      });

      console.log(
        `[product-webhook][chunk ${index + 1}] received=${chunk.length} processed=${chunk.length} duration_ms=${chunkDuration} db_roundtrips=${chunkRoundtrips}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      failed += chunk.length;
      errors.push(`chunk_${index + 1}: ${errMsg}`);
      db_roundtrips += chunkRoundtrips;
      chunk_metrics.push({
        chunk: index + 1,
        received: chunk.length,
        processed: 0,
        duration_ms: Date.now() - chunkStart,
        db_roundtrips: chunkRoundtrips,
        created: 0,
        updated: 0,
        failed: chunk.length,
      });
      console.error(`[product-webhook][chunk ${index + 1}] failed:`, err);
    }
  }

  return {
    created,
    updated,
    failed,
    processed,
    errors,
    db_roundtrips,
    duration_ms: Date.now() - startedAt,
    chunk_metrics,
  };
}

function normalizeProduct(product: ProductPayload): NormalizedProduct {
  const stockStatus = calculateStockStatus(product.stock || 0);
  return {
    external_id: product.external_id || null,
    sku: product.sku,
    name: product.name,
    description: product.description || null,
    price: product.price || 0,
    min_quantity: product.min_quantity || 1,
    category_id: product.category_id == null ? null : String(product.category_id),
    category_name: product.category_name || null,
    subcategory: product.subcategory || null,
    supplier_id: product.supplier_id || null,
    supplier_name: product.supplier_name || null,
    stock: product.stock || 0,
    stock_status: product.stock_status || stockStatus,
    is_kit: product.is_kit || false,
    is_active: product.is_active !== false,
    featured: product.featured || false,
    new_arrival: product.new_arrival || false,
    on_sale: product.on_sale || false,
    images: product.images || [],
    video_url: product.video_url || null,
    colors: product.colors || [],
    materials: product.materials || [],
    tags: product.tags || {},
    kit_items: product.kit_items || [],
    variations: product.variations || [],
    metadata: (product.metadata || {}) as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunked.push(items.slice(i, i + size));
  }
  return chunked;
}

function calculateStockStatus(stock: number): string {
  if (stock <= 0) return 'out-of-stock';
  if (stock < 100) return 'low-stock';
  return 'in-stock';
}
