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

    const { data: syncLog, error: logError } = await supabase
      .from('product_sync_logs')
      .insert({
        status: 'processing',
        source: version === '2' ? 'n8n_v2' : 'n8n',
        products_received: products?.length || (singleProduct ? 1 : 0),
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
    }

    const syncLogId = syncLog?.id;

    let outcome: { created: number; updated: number; failed: number; errors: string[] } = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    switch (data.action) {
      case 'upsert': {
        if (!singleProduct) {
          throw new Error('Product data is required for upsert action');
        }
        outcome = await upsertProducts(supabase, [singleProduct]);
        break;
      }

      case 'batch_upsert':
      case 'sync': {
        if (!products || products.length === 0) {
          throw new Error('Products array is required for batch_upsert/sync action');
        }
        outcome = await upsertProducts(supabase, products);
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
        outcome = { created: 0, updated: 0, failed: 0, errors: [] };
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
): Promise<{ created: number; updated: number; failed: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const stockStatus = calculateStockStatus(product.stock || 0);

      const productData = {
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
        metadata: product.metadata || {},
        synced_at: new Date().toISOString(),
      };

      let existingProduct = null;
      if (product.external_id) {
        const { data } = await supabase
          .from('products')
          .select('id')
          .eq('external_id', product.external_id)
          .maybeSingle();
        existingProduct = data;
      }
      if (!existingProduct) {
        const { data } = await supabase
          .from('products')
          .select('id')
          .eq('sku', product.sku)
          .maybeSingle();
        existingProduct = data;
      }

      if (existingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update(productData as never)
          .eq('id', existingProduct.id);
        if (updateError) throw updateError;
        updated++;
        console.log(`Updated product: ${product.sku}`);
      } else {
        const { error: insertError } = await supabase.from('products').insert(productData as never);
        if (insertError) throw insertError;
        created++;
        console.log(`Created product: ${product.sku}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${product.sku}: ${errMsg}`);
      failed++;
      console.error(`Failed to upsert product ${product.sku}:`, err);
    }
  }

  return { created, updated, failed, errors };
}

function calculateStockStatus(stock: number): string {
  if (stock <= 0) return 'out-of-stock';
  if (stock < 100) return 'low-stock';
  return 'in-stock';
}
