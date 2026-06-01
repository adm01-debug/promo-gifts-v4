/**
 * mockupGenerationService — Handles mockup generation API calls and history persistence.
 * Extracted from useMockupGenerator to reduce hook complexity.
 *
 * Fixes (audit 26/05/2026 — Sprint 1):
 * T4: position_x, position_y, logo_url persisted as top-level columns.
 * T7: getTechniquePrompt skips "default" in search loop.
 * T8: fetchMockupHistory limited to 200 records.
 * T10: thumbnail_url now stores mockupUrl (not logoUrl).
 *
 * Fixes (audit sprint-2, 26/05/2026):
 * BUG-C: generateMockupApi wrapped in 60s timeout via Promise.race.
 * BUG-E: SVG logos pre-validated BEFORE calling edge function.
 * BUG-I: Single-area path sends only the relevant area in the `areas` array.
 *
 * Fixes (2026-06-01):
 * BUG-400a: fetchMockupHistory used explicit SELECT with non-existent columns.
 *   Fixed: .select('*') + area_config JSONB mapper.
 * BUG-400b: saveMockupToDb inserted position_x/y and logo_width/height_cm as
 *   top-level columns that do not exist in generated_mockups. The values are
 *   persisted in area_config JSONB — the top-level keys were silently rejected
 *   by Supabase/PostgREST. Removed the 4 duplicate top-level fields.
 */
import { supabase } from '@/integrations/supabase/client';
import { uploadLogoToStorage, downloadImageAsPdfFromUrl } from '@/lib/mockup-storage';
import { toast } from 'sonner';
import type { PersonalizationArea } from '@/components/mockup/MultiAreaManager';

export interface Technique {
  id: string;
  name: string;
  code: string | null;
  [key: string]: unknown;
}

export interface GeneratedMockup {
  id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  technique_id: string | null;
  technique_name: string;
  mockup_url: string;
  layout_url?: string | null;
  logo_url: string | null;
  position_x: number | null;
  position_y: number | null;
  logo_width_cm: number | null;
  logo_height_cm: number | null;
  location_name?: string | null;
  colors_count?: number | null;
  annotations?: Array<Record<string, unknown>> | null;
  client_name?: string | null;
  created_at: string;
  client_id: string | null;
}

const TECHNIQUE_PROMPTS: Record<string, string> = {
  bordado: 'as professional machine embroidery with visible thread stitch texture',
  silk: 'as screen printed with flat solid colors, matte finish',
  dtf: 'as DTF printed transfer with vibrant colors, slight glossy finish',
  laser: 'as laser engraved, etched into the material surface, monochromatic',
  laser_co2: 'as CO2 laser engraved with precise etching on organic materials',
  laser_fibra: 'as fiber laser marked on metal with high-contrast permanent mark',
  sublimacao: 'as sublimation printed, colors absorbed seamlessly into the material',
  tampografia: 'as pad printed with slightly glossy ink, precise small details',
  hot_stamping: 'as hot stamped with metallic foil finish, shiny reflective surface',
  adesivo: 'as vinyl sticker/decal applied to surface',
  uv: 'as UV printed with raised ink texture, vibrant colors',
  transfer: 'as heat transfer vinyl, smooth finish with slight sheen',
  default: 'as professionally printed/applied logo',
};

// T7 FIX: skip "default" in the loop to avoid false substring matches.
export function getTechniquePrompt(technique: Technique): string {
  const code = technique.code?.toLowerCase() || technique.name.toLowerCase();
  for (const [key, prompt] of Object.entries(TECHNIQUE_PROMPTS)) {
    if (key === 'default') continue;
    if (code.includes(key) || technique.name.toLowerCase().includes(key)) return prompt;
  }
  return TECHNIQUE_PROMPTS.default;
}

// T8 FIX: limit to 200 records to prevent unbounded payload growth.
// BUG-400a FIX (2026-06-01): select('*') instead of explicit column list.
export async function fetchMockupHistory(userId?: string): Promise<GeneratedMockup[]> {
  let query = supabase
    .from('generated_mockups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => {
    const cfg = (row.area_config ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      product_id: row.product_id ?? null,
      product_name: row.product_name,
      product_sku: row.product_sku ?? null,
      technique_id: row.technique_id ?? null,
      technique_name: row.technique_name,
      mockup_url: row.mockup_url,
      logo_url: row.logo_url ?? (cfg.logoUrl as string | null) ?? null,
      position_x: (cfg.positionX as number | null) ?? null,
      position_y: (cfg.positionY as number | null) ?? null,
      logo_width_cm: (cfg.logoWidth as number | null) ?? null,
      logo_height_cm: (cfg.logoHeight as number | null) ?? null,
      client_id: null,
      client_name: (cfg.clientName as string | null) ?? null,
      location_name: row.area_name ?? null,
      colors_count: (cfg.colorsCount as number | null) ?? null,
      annotations: (cfg.annotations as Array<Record<string, unknown>> | null) ?? null,
      created_at: row.created_at,
    } satisfies GeneratedMockup;
  });
}

export interface SaveMockupParams {
  userId: string;
  product: { id: string; name: string; sku?: string | null };
  technique: Technique;
  client: { id?: string; name?: string; nome_fantasia?: string; razao_social?: string } | null;
  area: PersonalizationArea;
  mockupUrl: string;
  annotations?: { id: string; x: number; y: number; text: string }[];
  extra?: { layoutUrl?: string; locationName?: string; colorsCount?: number };
}

// T10 FIX: thumbnail_url = mockupUrl (was incorrectly set to logoUrl).
// BUG-400b FIX (2026-06-01): removed position_x/y and logo_width/height_cm from
// top-level insert — these columns do not exist in generated_mockups. The values
// are already persisted inside area_config JSONB (positionX, positionY, logoWidth,
// logoHeight), so no data is lost.
export async function saveMockupToDb(params: SaveMockupParams): Promise<string | null> {
  const { userId, product, technique, client, area, mockupUrl, annotations, extra } = params;

  try {
    let logoUrl = area.logoPreview || '';
    if (area.logoPreview?.startsWith('data:')) {
      const uploadedUrl = await uploadLogoToStorage(
        userId,
        area.logoPreview,
        `${product.sku || 'product'}-${technique.code || 'tech'}`,
      );
      logoUrl = uploadedUrl || '';
    }

    let safeProductId: string | null = null;
    if (product.id) {
      const { data: productRow } = await supabase
        .from('products')
        .select('id')
        .eq('id', product.id)
        .maybeSingle();
      if (productRow) safeProductId = product.id;
    }

    const safeTechniqueId: string | null = technique.id || null;
    const clientName = client?.nome_fantasia || client?.razao_social || client?.name || null;

    const { data: insertedRow, error } = await supabase
      .from('generated_mockups')
      .insert({
        user_id: userId,
        product_id: safeProductId,
        product_name: product.name,
        product_sku: product.sku || null,
        technique_id: safeTechniqueId,
        technique_name: technique.name,
        mockup_url: mockupUrl,
        thumbnail_url: mockupUrl || null,
        logo_url: logoUrl || null,
        area_name: extra?.locationName || area.name || 'Frente',
        ai_model_used: technique.code || technique.name || 'custom',
        area_config: {
          positionX: area.positionX,
          positionY: area.positionY,
          logoWidth: area.logoWidth,
          logoHeight: area.logoHeight,
          logoUrl,
          clientName,
          colorsCount: extra?.colorsCount || null,
          annotations: annotations && annotations.length > 0 ? annotations : null,
        },
      })
      .select('id')
      .single();

    if (error) throw error;
    return insertedRow?.id || null;
  } catch (error) {
    console.error('Error saving to history:', error);
    return null;
  }
}

export interface GenerateMockupParams {
  productImage: string;
  productName: string;
  technique: Technique;
  areas: PersonalizationArea[];
}

export interface GenerateMockupResult {
  mockupUrl: string;
  jobId?: string;
  revisionsLeft?: number;
}

const GENERATE_TIMEOUT_MS = 60_000;

export async function generateMockupApi(
  params: GenerateMockupParams,
): Promise<GenerateMockupResult> {
  const generateCall = supabase.functions.invoke('generate-mockup', {
    body: {
      productImage: params.productImage,
      productName: params.productName,
      technique: params.technique,
      areas: params.areas,
    },
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout: geração demorou mais de 60s')), GENERATE_TIMEOUT_MS),
  );

  const { data, error } = await Promise.race([generateCall, timeout]);
  if (error) throw error;
  if (!data?.mockupUrl) throw new Error('Resposta inválida da API de mockup');
  return {
    mockupUrl: data.mockupUrl,
    jobId: data.jobId,
    revisionsLeft: data.revisionsLeft,
  };
}

export function downloadMockup(mockupUrl: string, product: { sku?: string | null }, technique: Technique): void {
  const safeSku = product.sku?.replace(/[^a-zA-Z0-9]/g, '-') || 'mockup';
  const safeTechnique = (technique.code || technique.name).replace(/[^a-zA-Z0-9]/g, '-');
  const fileName = `mockup-${safeSku}-${safeTechnique}.pdf`;
  downloadImageAsPdfFromUrl(mockupUrl, fileName);
}

export async function deleteMockupFromDb(id: string, userId?: string): Promise<void> {
  let query = supabase.from('generated_mockups').delete().eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
}

export function validateSvgLogo(logoDataUrl: string): { valid: boolean; reason?: string } {
  if (!logoDataUrl.startsWith('data:image/svg')) {
    return { valid: true };
  }
  try {
    const base64 = logoDataUrl.split(',')[1];
    const svgText = atob(base64);
    if (!svgText.includes('<svg') && !svgText.includes('<SVG')) {
      return { valid: false, reason: 'SVG inválido: elemento <svg> ausente' };
    }
    if (svgText.includes('<script') || svgText.includes('javascript:')) {
      return { valid: false, reason: 'SVG rejeitado: contém script' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Não foi possível decodificar o SVG' };
  }
}

export function buildMockupToastMessage(
  technique: string,
  revisionsLeft?: number,
): { title: string; description: string } {
  const title = `Mockup gerado com ${technique}`;
  const description =
    revisionsLeft !== undefined && revisionsLeft > 0
      ? `Você ainda tem ${revisionsLeft} revisões disponíveis.`
      : 'Resultado final.';
  return { title, description };
}

export function buildTechniqueList(techniquesRaw: unknown[]): Technique[] {
  return techniquesRaw
    .filter(
      (t): t is Record<string, unknown> =>
        !!t && typeof t === 'object' && 'id' in t && 'name' in t,
    )
    .map((t) => ({
      id: String(t.id),
      name: String(t.name),
      code: t.code ? String(t.code) : null,
      ...t,
    }));
}

export function toastMockupSaved(productName: string): void {
  toast.success(`Mockup de ${productName} salvo no histórico!`);
}

export function toastMockupError(reason?: string): void {
  toast.error(reason || 'Erro ao gerar mockup. Tente novamente.');
}
