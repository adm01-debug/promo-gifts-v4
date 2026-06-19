import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCron } from '../_shared/dispatcher-auth.ts';
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// SEC-001: UUID lido de env var (era hardcoded). Default = seed legado Asia.
const SUPPLIER_ID   = Deno.env.get('ASIA_SUPPLIER_ID') ?? 'd2734e23-d633-4819-bb15-e51aa44e2118';
const ASIA_BASE     = Deno.env.get('ASIA_BASE_URL') ?? 'https://asia.ajung.site';
const POR_PAGINA    = 50;
const MAX_PAGES     = 30;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'PromoBrindes/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} -> ${url}`);
  return r.json();
}

async function upsertBatch(rows: any[]) {
  if (!rows.length) return;
  const { error } = await supabase
    .from('supplier_products_raw')
    .upsert(rows, { onConflict: 'supplier_id,supplier_sku' });
  if (error) throw error;
}

async function syncCatalogo() {
  let page = 1, total_pages = 1, inserted = 0;
  while (page <= total_pages && page <= MAX_PAGES) {
    const data = await fetchJson(`${ASIA_BASE}/api/products?por_pagina=${POR_PAGINA}&pagina=${page}`);
    total_pages = Number(data.total_paginas ?? 1);
    const produtos: any[] = data.produtos ?? [];
    if (!produtos.length) break;

    const rows: any[] = [];
    for (const p of produtos) {
      const variacoes: any[] = p.variacoes ?? [];
      if (variacoes.length > 0) {
        for (const v of variacoes) {
          const sku = v.sku ?? `${p.referencia}-${v.cor_sigla ?? v.cor ?? 'UN'}`;
          const skuTrimmed = String(sku).trim(); if (!skuTrimmed) continue;
          rows.push({
            supplier_id:        SUPPLIER_ID,
            supplier_reference: String(p.referencia ?? '').trim(),
            supplier_sku:       skuTrimmed,
            raw_data:           { ...p, _variacao: v },
            source_channel:     'n8n_edge_function',
            source_endpoint:    '/api/products',
            status:             'pending',
          });
        }
      } else {
        const baseSku = String(p.referencia ?? '').trim(); if (!baseSku) continue;
        rows.push({
          supplier_id:        SUPPLIER_ID,
          supplier_reference: baseSku,
          supplier_sku:       baseSku,
          raw_data:           p,
          source_channel:     'n8n_edge_function',
          source_endpoint:    '/api/products',
          status:             'pending',
        });
      }
    }

    await upsertBatch(rows);
    inserted += rows.length;
    page++;
  }
  return { fonte: 'F1_catalogo', paginas: page - 1, total_pages, inserted };
}

Deno.serve(async (req: Request) => {
  const __reqId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'asia-ingestion', requestId: __reqId, req });
  log.info('request_start');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  // Auth: cron/service secret (P0 fix)
  const auth = await authorizeCron(req, {
    corsHeaders: cors,
    secretEnvName: 'ASIA_INGESTION_CRON_SECRET',
    headerName: 'x-cron-secret',
  });
  if (!auth.ok) return auth.response;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: cors,
    });
  }

  const t0 = Date.now();
  try {
    const f1 = await syncCatalogo();
    return new Response(JSON.stringify({ ok: true, elapsed_ms: Date.now() - t0, ...f1 }), { headers: { ...cors, 'X-Request-Id': __reqId } });
  } catch (err: any) {
    console.error('[asia-ingestion] sync failed', { message: err?.message });
    return new Response(JSON.stringify({ ok: false, error: 'upstream_sync_failed' }), { status: 502, headers: { ...cors, 'X-Request-Id': __reqId } });
  }
});
