import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { authorize } from '../_shared/authorize.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { z } from 'npm:zod@3.23.8';
import {
  fetchWithBreaker,
  CircuitOpenError,
  circuitOpenResponse,
} from '../_shared/external-fetch.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
// BUG-015 FIX: import resolveCredential for SSOT credential resolution (DB-first -> env fallback).
// Previously Deno.env.get('BITRIX24_WEBHOOK_URL') was used; key rotations via /admin/conexoes
// had no effect until the Deno isolate was restarted.
import { resolveCredential } from '../_shared/credentials.ts';

const BitrixSyncSchema = z.object({
  action: z.enum([
    'get_companies',
    'get_company',
    'search_companies',
    'get_deals',
    'get_deal_products',
    'sync_full',
    'get_stored_clients',
    'get_stored_deals',
    'create_deal',
    'update_deal',
    'get_sync_logs',
  ]),
  data: z.record(z.unknown()).optional(),
});

// Initialize Supabase client for database operations
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authorize(req, { requireRole: 'supervisor', enforceServerSide: true });
    if (!auth.ok) return auth.response;

    // BUG-015 FIX: use resolveCredential() (DB-first SSOT) instead of Deno.env.get().
    const { value: bitrixWebhookUrl } = await resolveCredential('BITRIX24_WEBHOOK_URL');

    if (!bitrixWebhookUrl) {
      return new Response(JSON.stringify({ error: 'Bitrix24 webhook URL not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let rawBitrixBody: unknown = {};
    try { rawBitrixBody = await req.json(); } catch { /* invalid JSON → safeParse will reject below */ }
    const parsed = BitrixSyncSchema.safeParse(rawBitrixBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { action, data } = parsed.data;
    const numField = (key: string, fallback: number): number => {
      const v = data?.[key];
      return typeof v === 'number' ? v : fallback;
    };
    const stringField = (key: string): string | undefined => {
      const v = data?.[key];
      return typeof v === 'string' ? v : undefined;
    };

    let result;

    switch (action) {
      case 'get_companies': {
        const response = await fetchWithBreaker('bitrix', `${bitrixWebhookUrl}/crm.company.list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            select: ['ID', 'TITLE', 'LOGO', 'EMAIL', 'PHONE', 'ADDRESS'],
            filter: data?.filter || {},
            start: data?.start || 0,
          }),
        });
        if (!response.ok) {
          await response.text();
          throw new Error(`Bitrix24 API error: ${response.status}`);
        }
        const bitrixData = await response.json();
        result = { companies: bitrixData.result || [], next: bitrixData.next };
        break;
      }

      case 'get_company': {
        const companyId = numField('id', 0);
        const response = await fetchWithBreaker('bitrix', `${bitrixWebhookUrl}/crm.company.get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: companyId }),
        });
        if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
        result = await response.json();
        break;
      }

      case 'search_companies': {
        const query = stringField('query') || '';
        const response = await fetchWithBreaker('bitrix', `${bitrixWebhookUrl}/crm.company.list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            select: ['ID', 'TITLE', 'EMAIL', 'PHONE'],
            filter: { '%TITLE': query },
            start: 0,
          }),
        });
        if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
        const d = await response.json();
        result = { companies: d.result || [] };
        break;
      }

      case 'get_deals': {
        const response = await fetchWithBreaker('bitrix', `${bitrixWebhookUrl}/crm.deal.list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            select: ['ID', 'TITLE', 'COMPANY_ID', 'STAGE_ID', 'OPPORTUNITY', 'CURRENCY_ID', 'DATE_CREATE', 'CLOSEDATE', 'ASSIGNED_BY_ID'],
            filter: data?.filter || {},
            start: data?.start || 0,
          }),
        });
        if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
        const d = await response.json();
        result = { deals: d.result || [], next: d.next };
        break;
      }

      case 'get_deal_products': {
        const dealId = numField('deal_id', 0);
        const response = await fetchWithBreaker(
          'bitrix',
          `${bitrixWebhookUrl}/crm.deal.productrows.get`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: dealId }),
          },
        );
        if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
        result = await response.json();
        break;
      }

      case 'sync_full': {
        const supabase = getSupabaseClient();
        const companiesResp = await fetchWithBreaker('bitrix', `${bitrixWebhookUrl}/crm.company.list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ select: ['ID', 'TITLE', 'EMAIL', 'PHONE'], start: 0 }),
        });
        if (!companiesResp.ok) throw new Error(`Bitrix24 companies error: ${companiesResp.status}`);
        const companiesData = await companiesResp.json();
        const companies = companiesData.result || [];
        const { error: syncError } = await supabase.from('bitrix_clients').upsert(
          companies.map((c: any) => ({
            bitrix_id: parseInt(c.ID),
            name: c.TITLE,
            email: c.EMAIL?.[0]?.VALUE || null,
            phone: c.PHONE?.[0]?.VALUE || null,
            synced_at: new Date().toISOString(),
          })),
          { onConflict: 'bitrix_id' },
        );
        result = { synced: companies.length, error: syncError?.message };
        break;
      }

      case 'get_stored_clients': {
        const supabase = getSupabaseClient();
        const { data: clients, error } = await supabase.from('bitrix_clients').select('*').limit(100);
        if (error) throw error;
        result = { clients };
        break;
      }

      case 'get_stored_deals': {
        const supabase = getSupabaseClient();
        const { data: deals, error } = await supabase.from('bitrix_deals').select('*').limit(100);
        if (error) throw error;
        result = { deals };
        break;
      }

      case 'create_deal': {
        const dealData = data?.deal as Record<string, unknown> | undefined;
        if (!dealData) throw new Error('deal data is required');
        const response = await fetchWithBreaker('bitrix', `${bitrixWebhookUrl}/crm.deal.add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: dealData }),
        });
        if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
        result = await response.json();
        break;
      }

      case 'update_deal': {
        const dealId = numField('id', 0);
        const fields = data?.fields as Record<string, unknown> | undefined;
        if (!dealId || !fields) throw new Error('id and fields are required');
        const response = await fetchWithBreaker('bitrix', `${bitrixWebhookUrl}/crm.deal.update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dealId, fields }),
        });
        if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
        result = await response.json();
        break;
      }

      case 'get_sync_logs': {
        const supabase = getSupabaseClient();
        const { data: logs, error } = await supabase
          .from('sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        result = { logs };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('bitrix-sync error:', safeErrorFields(err));
    if (err instanceof CircuitOpenError) return circuitOpenResponse(err, corsHeaders);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseColor(colorStr: string | null | undefined): string | null {
  if (!colorStr) return null;
  try {
    const parsed = JSON.parse(colorStr);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return typeof colorStr === 'string' ? colorStr : null;
  }
}
