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
 * Fixes (2026-06-10 — mockup contract restoration):
 * - position_x/position_y/logo_width_cm/logo_height_cm DO exist in generated_mockups
 *   (migration 20251215011449) and layout_url exists (migration 20260301135215). The
 *   earlier "BUG-400b" removal was a misdiagnosis caused by a STALE types.ts — it
 *   regressed geometry persistence to area_config only. Restored the top-level columns
 *   (written via untypedFrom so the stale types do not reject them) while keeping the
 *   area_config mirror for backward-compat with older rows. logoRotation/logoScale are
 *   now persisted in area_config too.
 * - generateMockupApi rewritten: per-area invocation (no dead areas[] payload),
 *   friendly edge-error extraction, SVG pre-validation (assertNotSvg), 60s timeout,
 *   and batch handling that keeps successes and warns on partial failures.
 */
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { uploadLogoToStorage, downloadImageAsPdfFromUrl } from '@/lib/mockup-storage';
import { toast } from 'sonner';
import type { PersonalizationArea } from '@/components/mockup/MultiAreaManager';

import { logger } from '@/lib/logger';
export interface Technique {
  id: string;
  name: string;
  code: string | null;
  [key: string]: unknown;
}

export function createDefaultArea(): PersonalizationArea {
  return {
    id: crypto.randomUUID(),
    name: 'Área 1',
    positionX: 50,
    positionY: 50,
    logoWidth: 10,
    logoHeight: 5,
    logoPreview: null,
  };
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
// Explicit column list (incl. layout_url + area_config). Geometry now lives in
// dedicated top-level columns (position_x/y, logo_width_cm/height_cm — added by
// migration 20251215011449) AND mirrored in area_config for backward-compat with
// older records. Uses untypedFrom because the generated types.ts is stale and does
// not yet reflect those columns (pending `npm run types:generate:supabase`).
const MOCKUP_HISTORY_COLUMNS =
  'id, user_id, product_id, product_name, product_sku, technique_id, technique_name, ' +
  'mockup_url, thumbnail_url, layout_url, logo_url, position_x, position_y, ' +
  'logo_width_cm, logo_height_cm, area_name, area_config, created_at';

export async function fetchMockupHistory(userId?: string): Promise<GeneratedMockup[]> {
  let query = untypedFrom<Record<string, unknown>>('generated_mockups')
    .select(MOCKUP_HISTORY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;

  return ((data as unknown as Record<string, unknown>[] | null) ?? []).map((row) => {
    const cfg = (row.area_config ?? {}) as Record<string, unknown>;
    return {
      id: row.id as string,
      product_id: (row.product_id as string | null) ?? null,
      product_name: row.product_name as string,
      product_sku: (row.product_sku as string | null) ?? null,
      technique_id: (row.technique_id as string | null) ?? null,
      technique_name: row.technique_name as string,
      mockup_url: row.mockup_url as string,
      layout_url: (row.layout_url as string | null) ?? null,
      logo_url: (row.logo_url as string | null) ?? (cfg.logoUrl as string | null) ?? null,
      position_x: (row.position_x as number | null) ?? (cfg.positionX as number | null) ?? null,
      position_y: (row.position_y as number | null) ?? (cfg.positionY as number | null) ?? null,
      logo_width_cm:
        (row.logo_width_cm as number | null) ?? (cfg.logoWidth as number | null) ?? null,
      logo_height_cm:
        (row.logo_height_cm as number | null) ?? (cfg.logoHeight as number | null) ?? null,
      client_id: null,
      client_name: (cfg.clientName as string | null) ?? null,
      location_name: (row.area_name as string | null) ?? null,
      colors_count: (cfg.colorsCount as number | null) ?? null,
      annotations: (cfg.annotations as Array<Record<string, unknown>> | null) ?? null,
      created_at: row.created_at as string,
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
    let logoUrl = area.logoPreview ?? '';
    if (area.logoPreview?.startsWith('data:')) {
      const uploadedUrl = await uploadLogoToStorage(
        userId,
        area.logoPreview,
        `${product.sku || 'product'}-${technique.code || 'tech'}`,
      );
      logoUrl = uploadedUrl ?? '';
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

    const { data: insertedRow, error } = await untypedFrom('generated_mockups')
      .insert({
        user_id: userId,
        product_id: safeProductId,
        product_name: product.name,
        product_sku: product.sku || null,
        technique_id: safeTechniqueId,
        technique_name: technique.name,
        mockup_url: mockupUrl,
        thumbnail_url: mockupUrl,
        logo_url: logoUrl,
        layout_url: extra?.layoutUrl || null,
        position_x: area.positionX,
        position_y: area.positionY,
        logo_width_cm: area.logoWidth,
        logo_height_cm: area.logoHeight,
        area_name: extra?.locationName || area.name || 'Frente',
        ai_model_used: technique.code || technique.name || 'custom',
        area_config: {
          positionX: area.positionX,
          positionY: area.positionY,
          logoWidth: area.logoWidth,
          logoHeight: area.logoHeight,
          logoRotation: area.logoRotation ?? null,
          logoScale: area.logoScale ?? null,
          logoUrl,
          clientName,
          colorsCount: extra?.colorsCount || null,
          annotations: annotations?.length ? annotations : null,
        },
      })
      .select('id')
      .single();

    if (error) throw error;
    return insertedRow?.id || null;
  } catch (error) {
    logger.error('Error saving to history:', error);
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
  mockupUrl?: string;
  singleUrl?: string | null;
  batchResults: { url: string; areaName: string }[];
  jobId?: string;
  revisionsLeft?: number;
}

const GENERATE_TIMEOUT_MS = 60000;

// BUG-E: SVG logos are rejected up-front — the edge function cannot composite SVGs.
// Detect data: URLs encoding an SVG and fail fast with a friendly PT-BR message
// BEFORE spending an edge-function invocation.
function assertNotSvg(areas: PersonalizationArea[]): void {
  for (const area of areas) {
    if (area.logoPreview?.startsWith('data:image/svg')) {
      throw new Error(
        'Logos SVG não são suportados. Converta o logo para PNG ou JPG e tente novamente.',
      );
    }
  }
}

/**
 * Extracts a human-friendly message from a supabase FunctionsHttpError.
 * The edge function encodes { error, errorCode, message } in the non-2xx body,
 * reachable via `error.context` (a Response). Falls back to the raw message.
 */
async function extractEdgeErrorMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string; errorCode?: string; message?: string };
      if (body?.message) return body.message;
      if (body?.error) return body.error;
    } catch {
      /* body was not JSON — fall through to the generic message */
    }
  }
  return error instanceof Error ? error.message : 'Falha ao gerar mockup.';
}

/** Invokes the edge function for a single area, enforcing the 60s timeout. */
async function invokeMockupForArea(
  params: GenerateMockupParams,
  area: PersonalizationArea,
): Promise<string> {
  const generateCall = supabase.functions.invoke('generate-mockup', {
    body: {
      productImageUrl: params.productImage,
      productName: params.productName,
      technique: params.technique,
      techniquePrompt: getTechniquePrompt(params.technique),
      logoUrl: area.logoPreview,
      areaName: area.name,
      positionX: area.positionX,
      positionY: area.positionY,
      logoWidth: area.logoWidth,
      logoHeight: area.logoHeight,
      logoRotation: area.logoRotation ?? 0,
      logoScale: area.logoScale ?? 100,
    },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Tempo esgotado ao gerar mockup (limite de 60s).')),
      GENERATE_TIMEOUT_MS,
    );
  });

  try {
    const { data, error } = await Promise.race([generateCall, timeout]);
    if (error) throw new Error(await extractEdgeErrorMessage(error));
    if (!data?.mockupUrl) throw new Error('Nenhuma imagem retornada pela API de mockup.');
    return data.mockupUrl as string;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateMockupApi(
  params: GenerateMockupParams,
): Promise<GenerateMockupResult> {
  const areasWithLogos = params.areas;

  // BUG-E: pre-validate BEFORE the (expensive) edge invocation.
  assertNotSvg(areasWithLogos);

  // BUG-I: single-area path sends ONLY the relevant area — never the dead areas[] payload.
  if (areasWithLogos.length === 1) {
    const url = await invokeMockupForArea(params, areasWithLogos[0]);
    return { singleUrl: url, batchResults: [] };
  }

  // BATCH: one invocation per area; keep the successes, warn about partial failures.
  const batchResults: { url: string; areaName: string }[] = [];
  let failures = 0;
  for (const area of areasWithLogos) {
    try {
      const url = await invokeMockupForArea(params, area);
      batchResults.push({ url, areaName: area.name });
    } catch (err) {
      failures += 1;
      logger.error(`[generateMockupApi] área "${area.name}" falhou:`, err);
    }
  }

  if (batchResults.length === 0) {
    throw new Error('Nenhum mockup gerado: todas as áreas falharam.');
  }
  if (failures > 0) {
    toast.warning(
      `${failures} área(s) não puderam ser geradas. Mostrando as ${batchResults.length} que deram certo.`,
    );
  }
  return { singleUrl: batchResults[0].url, batchResults };
}

export function downloadMockupAsPdf(
  mockupUrl: string,
  product: { sku?: string | null },
  technique: Technique,
): void {
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
      (t): t is Record<string, unknown> => !!t && typeof t === 'object' && 'id' in t && 'name' in t,
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
