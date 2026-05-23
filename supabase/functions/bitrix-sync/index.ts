import { getCorsHeaders, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { authorize } from '../_shared/authorize.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from "../_shared/external-fetch.ts";

const BitrixSyncSchema = z.object({
  action: z.enum([
    'get_companies', 'get_company', 'search_companies',
    'get_deals', 'get_deal_products', 'sync_full',
    'get_stored_clients', 'get_stored_deals',
    'create_deal', 'update_deal', 'get_sync_logs',
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
    // AuthZ: bitrix-sync escreve no CRM externo — supervisor (admin) ou dev.
    // Server-side double-check via has_role() para defesa em profundidade.
    const auth = await authorize(req, { requireRole: 'supervisor', enforceServerSide: true });
    if (!auth.ok) return auth.response;

    const bitrixWebhookUrl = Deno.env.get('BITRIX24_WEBHOOK_URL');

    if (!bitrixWebhookUrl) {
      return new Response(
        JSON.stringify({ error: 'Bitrix24 webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = BitrixSyncSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { action, data } = parsed.data;
    // Helper para extrair número de `data?.<key>` (Zod tipa data como
    // Record<string, unknown> | undefined — sem narrow seguro inline).
    const numField = (key: string, fallback: number): number => {
      const v = data?.[key];
      return typeof v === "number" ? v : fallback;
    };
    const stringField = (key: string): string | undefined => {
      const v = data?.[key];
      return typeof v === "string" ? v : undefined;
    };

    let result;

    switch (action) {
      case 'get_companies': {
        // Fetch companies/clients from Bitrix24
        const response = await fetchWithBreaker("bitrix", `${bitrixWebhookUrl}/crm.company.list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            select: [
              'ID',
              'TITLE',
              'LOGO',
              'UF_CRM_1590780873288', // Ramo de Atividade
              'UF_CRM_1631795570468', // Nicho/Segmento
              'UF_CRM_1755898066',    // Cor Predominante Logo
              'UF_CRM_1755898357',    // Cores Secundárias Logo
              'EMAIL',
              'PHONE',
              'ADDRESS',
            ],
            filter: data?.filter || {},
            start: data?.start || 0,
          }),
        });

        if (!response.ok) {
          await response.text();
          console.error('Bitrix24 API error:', { status: response.status });
          throw new Error(`Bitrix24 API error: ${response.status}`);
        }

        const bitrixData = await response.json();
        console.log('Bitrix24 response:', JSON.stringify(bitrixData).slice(0, 500));

        // Transform Bitrix24 data to our client format
        const clients = (bitrixData.result || []).map((company: any) => ({
          id: company.ID,
          name: company.TITLE || 'Sem nome',
          ramo: company.UF_CRM_1590780873288 || 'Não informado',
          nicho: company.UF_CRM_1631795570468 || 'Não informado',
          primaryColor: parseColor(company.UF_CRM_1755898066),
          secondaryColors: parseColors(company.UF_CRM_1755898357),
          email: getFirstValue(company.EMAIL),
          phone: getFirstValue(company.PHONE),
          address: company.ADDRESS || '',
          logo: company.LOGO || null,
        }));

        result = {
          clients,
          total: bitrixData.total || clients.length,
          next: bitrixData.next,
        };
        break;
      }

      case 'get_company': {
        // Fetch single company by ID
        const companyId = data?.id;
        if (!companyId) {
          throw new Error('Company ID is required');
        }

        const response = await fetchWithBreaker("bitrix", `${bitrixWebhookUrl}/crm.company.get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: companyId }),
        });

        if (!response.ok) {
          throw new Error(`Bitrix24 API error: ${response.status}`);
        }

        const bitrixData = await response.json();
        const company = bitrixData.result;

        result = {
          id: company.ID,
          name: company.TITLE || 'Sem nome',
          ramo: company.UF_CRM_1590780873288 || 'Não informado',
          nicho: company.UF_CRM_1631795570468 || 'Não informado',
          primaryColor: parseColor(company.UF_CRM_1755898066),
          secondaryColors: parseColors(company.UF_CRM_1755898357),
          email: getFirstValue(company.EMAIL),
          phone: getFirstValue(company.PHONE),
          address: company.ADDRESS || '',
          logo: company.LOGO || null,
        };
        break;
      }

      case 'search_companies': {
        // Search companies by name
        const query = data?.query || '';
        
        const response = await fetchWithBreaker("bitrix", `${bitrixWebhookUrl}/crm.company.list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            select: ['ID', 'TITLE', 'UF_CRM_1755898066'],
            filter: { '%TITLE': query },
            order: { TITLE: 'ASC' },
            start: 0,
          }),
        });

        if (!response.ok) {
          throw new Error(`Bitrix24 API error: ${response.status}`);
        }

        const bitrixData = await response.json();
        result = (bitrixData.result || []).map((c: any) => ({
          id: c.ID,
          name: c.TITLE,
          primaryColor: parseColor(c.UF_CRM_1755898066),
        }));
        break;
      }

      case 'get_deals': {
        // Fetch deals (purchase history) from Bitrix24
        const companyId = data?.companyId;
        
        const filter: Record<string, any> = {};
        if (companyId) {
          filter.COMPANY_ID = companyId;
        }
        if (data?.status) {
          filter.STAGE_ID = data.status;
        }

        const response = await fetchWithBreaker("bitrix", `${bitrixWebhookUrl}/crm.deal.list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            select: [
              'ID',
              'TITLE',
              'COMPANY_ID',
              'OPPORTUNITY',
              'CURRENCY_ID',
              'STAGE_ID',
              'CLOSEDATE',
              'DATE_CREATE',
              'DATE_MODIFY',
              'ASSIGNED_BY_ID',
            ],
            filter,
            order: { DATE_CREATE: 'DESC' },
            start: data?.start || 0,
          }),
        });

        if (!response.ok) {
          await response.text();
          console.error('Bitrix24 deals error:', { status: response.status });
          throw new Error(`Bitrix24 API error: ${response.status}`);
        }

        const bitrixData = await response.json();
        console.log('Bitrix24 deals response:', JSON.stringify(bitrixData).slice(0, 500));

        const deals = (bitrixData.result || []).map((deal: any) => ({
          id: deal.ID,
          title: deal.TITLE || 'Sem título',
          companyId: deal.COMPANY_ID,
          value: parseFloat(deal.OPPORTUNITY) || 0,
          currency: deal.CURRENCY_ID || 'BRL',
          stage: deal.STAGE_ID || 'NEW',
          closeDate: deal.CLOSEDATE,
          createdAt: deal.DATE_CREATE,
          updatedAt: deal.DATE_MODIFY,
          assignedTo: deal.ASSIGNED_BY_ID,
        }));

        result = {
          deals,
          total: bitrixData.total || deals.length,
          next: bitrixData.next,
        };
        break;
      }

      case 'get_deal_products': {
        // Fetch products in a deal
        const dealId = data?.dealId;
        if (!dealId) {
          throw new Error('Deal ID is required');
        }

        const response = await fetchWithBreaker("bitrix", `${bitrixWebhookUrl}/crm.deal.productrows.get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dealId }),
        });

        if (!response.ok) {
          throw new Error(`Bitrix24 API error: ${response.status}`);
        }

        const bitrixData = await response.json();
        
        result = (bitrixData.result || []).map((product: any) => ({
          id: product.ID,
          productId: product.PRODUCT_ID,
          productName: product.PRODUCT_NAME || 'Produto',
          quantity: parseInt(product.QUANTITY) || 1,
          price: parseFloat(product.PRICE) || 0,
          discount: parseFloat(product.DISCOUNT_SUM) || 0,
          total: parseFloat(product.SUM) || 0,
        }));
        break;
      }

      case 'sync_full': {
        // Full sync: get companies with their deals and save to database
        console.log('Starting full sync with database persistence...');
        
        const supabase = getSupabaseClient();
        const syncStartTime = new Date().toISOString();

        // Create sync log entry
        const { data: syncLog, error: logError } = await supabase
          .from('bitrix_sync_logs')
          .insert({ status: 'in_progress', started_at: syncStartTime })
          .select()
          .single();

        if (logError) {
          console.error('Error creating sync log:', logError);
        }

        try {
          // Get all companies
          const companiesResponse = await fetchWithBreaker("bitrix", `${bitrixWebhookUrl}/crm.company.list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              select: ['ID', 'TITLE', 'UF_CRM_1590780873288', 'UF_CRM_1631795570468', 'UF_CRM_1755898066', 'EMAIL', 'PHONE', 'ADDRESS'],
              start: data?.start || 0,
            }),
          });

          if (!companiesResponse.ok) {
            throw new Error(`Bitrix24 companies error: ${companiesResponse.status}`);
          }

          const companiesData = await companiesResponse.json();
          console.log(`Fetched ${companiesData.result?.length || 0} companies`);

          // Get all deals
          const dealsResponse = await fetchWithBreaker("bitrix", `${bitrixWebhookUrl}/crm.deal.list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              select: ['ID', 'TITLE', 'COMPANY_ID', 'OPPORTUNITY', 'CURRENCY_ID', 'STAGE_ID', 'CLOSEDATE', 'DATE_CREATE'],
              order: { DATE_CREATE: 'DESC' },
              start: 0,
            }),
          });

          if (!dealsResponse.ok) {
            throw new Error(`Bitrix24 deals error: ${dealsResponse.status}`);
          }

          const dealsData = await dealsResponse.json();
          console.log(`Fetched ${dealsData.result?.length || 0} deals`);

          // Group deals by company for calculating totals
          const dealsByCompany: Record<string, any[]> = {};
          (dealsData.result || []).forEach((deal: any) => {
            const companyId = deal.COMPANY_ID;
            if (companyId) {
              if (!dealsByCompany[companyId]) {
                dealsByCompany[companyId] = [];
              }
              dealsByCompany[companyId].push({
                id: deal.ID,
                title: deal.TITLE,
                value: parseFloat(deal.OPPORTUNITY) || 0,
                currency: deal.CURRENCY_ID || 'BRL',
                stage: deal.STAGE_ID,
                closeDate: deal.CLOSEDATE,
                date: deal.DATE_CREATE,
              });
            }
          });

          // Upsert clients to database
          const clientsToUpsert = (companiesData.result || []).map((company: any) => {
            const companyDeals = dealsByCompany[company.ID] || [];
            const totalSpent = companyDeals.reduce((sum: number, d: any) => sum + d.value, 0);
            const parsedColor = parseColor(company.UF_CRM_1755898066);
            
            return {
              bitrix_id: company.ID,
              name: company.TITLE || 'Sem nome',
              ramo: company.UF_CRM_1590780873288 || null,
              nicho: company.UF_CRM_1631795570468 || null,
              primary_color_name: parsedColor.name,
              primary_color_hex: parsedColor.hex,
              email: getFirstValue(company.EMAIL) || null,
              phone: getFirstValue(company.PHONE) || null,
              address: company.ADDRESS || null,
              total_spent: totalSpent,
              last_purchase_date: companyDeals[0]?.date || null,
              synced_at: syncStartTime,
            };
          });

          if (clientsToUpsert.length > 0) {
            const { error: clientsError } = await supabase
              .from('bitrix_clients')
              .upsert(clientsToUpsert, { onConflict: 'bitrix_id' });

            if (clientsError) {
              console.error('Error upserting clients:', clientsError);
              throw new Error(`Database error: ${clientsError.message}`);
            }
            console.log(`Upserted ${clientsToUpsert.length} clients to database`);
          }

          // Upsert deals to database
          const dealsToUpsert = (dealsData.result || []).map((deal: any) => ({
            bitrix_id: deal.ID,
            bitrix_client_id: deal.COMPANY_ID || '',
            title: deal.TITLE || 'Sem título',
            value: parseFloat(deal.OPPORTUNITY) || 0,
            currency: deal.CURRENCY_ID || 'BRL',
            stage: deal.STAGE_ID || null,
            close_date: deal.CLOSEDATE || null,
            created_at_bitrix: deal.DATE_CREATE || null,
            synced_at: syncStartTime,
          }));

          if (dealsToUpsert.length > 0) {
            const { error: dealsError } = await supabase
              .from('bitrix_deals')
              .upsert(dealsToUpsert, { onConflict: 'bitrix_id' });

            if (dealsError) {
              console.error('Error upserting deals:', dealsError);
              throw new Error(`Database error: ${dealsError.message}`);
            }
            console.log(`Upserted ${dealsToUpsert.length} deals to database`);
          }

          // Update sync log with success
          if (syncLog) {
            await supabase
              .from('bitrix_sync_logs')
              .update({
                status: 'completed',
                clients_synced: clientsToUpsert.length,
                deals_synced: dealsToUpsert.length,
                completed_at: new Date().toISOString(),
              })
              .eq('id', syncLog.id);
          }

          // Build response with combined data
          const clients = (companiesData.result || []).map((company: any) => {
            const companyDeals = dealsByCompany[company.ID] || [];
            const totalSpent = companyDeals.reduce((sum: number, d: any) => sum + d.value, 0);
            
            return {
              id: company.ID,
              name: company.TITLE || 'Sem nome',
              ramo: company.UF_CRM_1590780873288 || 'Não informado',
              nicho: company.UF_CRM_1631795570468 || 'Não informado',
              primaryColor: parseColor(company.UF_CRM_1755898066),
              email: getFirstValue(company.EMAIL),
              phone: getFirstValue(company.PHONE),
              deals: companyDeals,
              totalSpent,
              lastPurchase: companyDeals[0]?.date || null,
            };
          });

          result = {
            clients,
            totalCompanies: companiesData.total || clients.length,
            totalDeals: dealsData.total || 0,
            nextCompanies: companiesData.next,
            syncedAt: syncStartTime,
            savedToDatabase: true,
          };

        } catch (syncError) {
          // Update sync log with error
          if (syncLog) {
            await supabase
              .from('bitrix_sync_logs')
              .update({
                status: 'failed',
                error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
                completed_at: new Date().toISOString(),
              })
              .eq('id', syncLog.id);
          }
          throw syncError;
        }
        break;
      }

      case 'get_stored_clients': {
        // Get clients from local database
        const supabase = getSupabaseClient();
        
        const { data: clients, error, count } = await supabase
          .from('bitrix_clients')
          .select('*', { count: 'exact' })
          .order('name', { ascending: true })
          .range(numField('start', 0), numField('start', 0) + numField('limit', 50) - 1);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        result = {
          clients: clients?.map(c => ({
            id: c.bitrix_id,
            name: c.name,
            ramo: c.ramo || 'Não informado',
            nicho: c.nicho || 'Não informado',
            primaryColor: { name: c.primary_color_name, hex: c.primary_color_hex, group: 'CUSTOM' },
            email: c.email,
            phone: c.phone,
            totalSpent: parseFloat(c.total_spent) || 0,
            lastPurchase: c.last_purchase_date,
            syncedAt: c.synced_at,
          })) || [],
          total: count || 0,
        };
        break;
      }

      case 'get_stored_deals': {
        // Get deals from local database
        const supabase = getSupabaseClient();
        
        let query = supabase
          .from('bitrix_deals')
          .select('*', { count: 'exact' })
          .order('created_at_bitrix', { ascending: false });

        const clientIdFilter = stringField('clientId');
        if (clientIdFilter) {
          query = query.eq('bitrix_client_id', clientIdFilter);
        }

        const { data: deals, error, count } = await query
          .range(numField('start', 0), numField('start', 0) + numField('limit', 50) - 1);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        result = {
          deals: deals?.map(d => ({
            id: d.bitrix_id,
            title: d.title,
            value: parseFloat(d.value) || 0,
            currency: d.currency,
            stage: d.stage,
            closeDate: d.close_date,
            createdAt: d.created_at_bitrix,
            syncedAt: d.synced_at,
          })) || [],
          total: count || 0,
        };
        break;
      }

      case 'get_sync_logs': {
        // Get sync history
        const supabase = getSupabaseClient();
        
        const { data: logs, error } = await supabase
          .from('bitrix_sync_logs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(numField('limit', 10));

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        result = { logs };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    if (error instanceof CircuitOpenError) {
      return circuitOpenResponse(error, corsHeaders);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bitrix24 sync error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions
function parseColor(colorValue: string | null): { name: string; hex: string; group: string } {
  if (!colorValue) {
    return { name: 'Cinza', hex: '#6B7280', group: 'CINZA' };
  }
  
  // If it's already a hex color
  if (colorValue.startsWith('#')) {
    return { name: colorValue, hex: colorValue, group: 'CUSTOM' };
  }
  
  // Map common color names to hex
  const colorMap: Record<string, { hex: string; group: string }> = {
    'vermelho': { hex: '#EF4444', group: 'VERMELHO' },
    'azul': { hex: '#3B82F6', group: 'AZUL' },
    'verde': { hex: '#22C55E', group: 'VERDE' },
    'branco': { hex: '#FFFFFF', group: 'BRANCO' },
    'preto': { hex: '#1F2937', group: 'PRETO' },
    'laranja': { hex: '#F97316', group: 'LARANJA' },
    'amarelo': { hex: '#EAB308', group: 'AMARELO' },
    'rosa': { hex: '#EC4899', group: 'ROSA' },
    'cinza': { hex: '#6B7280', group: 'CINZA' },
    'prata': { hex: '#C0C0C0', group: 'PRATA' },
    'marrom': { hex: '#78350F', group: 'MARROM' },
    'roxo': { hex: '#8B5CF6', group: 'ROXO' },
    'dourado': { hex: '#D4AF37', group: 'DOURADO' },
  };

  const normalizedColor = colorValue.toLowerCase().trim();
  const mapped = colorMap[normalizedColor];
  
  if (mapped) {
    return { name: colorValue, ...mapped };
  }
  
  return { name: colorValue, hex: '#6B7280', group: 'CUSTOM' };
}

function parseColors(colorsValue: string | string[] | null): Array<{ name: string; hex: string; group: string }> {
  if (!colorsValue) return [];
  
  const colors = Array.isArray(colorsValue) ? colorsValue : colorsValue.split(',');
  return colors.map(c => parseColor(c.trim())).filter(c => c.hex !== '#6B7280');
}

function getFirstValue(field: any): string {
  if (!field) return '';
  if (Array.isArray(field) && field.length > 0) {
    return field[0]?.VALUE || field[0] || '';
  }
  if (typeof field === 'object' && field.VALUE) {
    return field.VALUE;
  }
  return String(field);
}
