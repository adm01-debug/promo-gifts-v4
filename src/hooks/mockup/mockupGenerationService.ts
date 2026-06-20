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
  logo_rotation?: number | null;
  logo_scale?: number | null;
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
// older records. client_id/client_name/logo_rotation/logo_scale added by
// migration 20260620000001. Uses untypedFrom because the generated types.ts is stale.
// user_id and thumbnail_url omitted: never used by the mapper below.
const MOCKUP_HISTORY_COLUMNS =
  'id, product_id, product_name, product_sku, technique_id, technique_name, ' +
  'mockup_url, layout_url, logo_url, position_x, position_y, ' +
  'logo_width_cm, logo_height_cm, logo_rotation, logo_scale, ' +
  'client_id, client_name, area_name, area_config, created_at';

export async function fetchMockupHistory(userId?: string): Promise<GeneratedMockup[]> {
  let query = untypedFrom<Record<string, unknown>>('generated_mockups')
    .select(MOCKUP_HISTORY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;

  return ((data as unknown as Record<string, unknown>[] | null) || []).map((row) => {
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
      // BUG-MISSING-COLS FIX: read logo_rotation/logo_scale from top-level columns
      // (added migration 20260620000001), falling back to area_config for older rows.
      logo_rotation:
        (row.logo_rotation as number | null) ?? (cfg.logoRotation as number | null) ?? null,
      logo_scale: (row.logo_scale as number | null) ?? (cfg.logoScale as number | null) ?? null,
      // BUG-CLIENT-ID FIX: client_id and client_name are now real columns
      // (migration 20260620000001). Fall back to area_config for rows created before the migration.
      client_id: (row.client_id as string | null) ?? null,
      client_name: (row.client_name as string | null) ?? (cfg.clientName as string | null) ?? null,
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
    // BUG-7 FIX: was `|| ''` which stored empty string when upload fails or preview is
    // absent. Use null so the column receives a proper SQL NULL instead of a
    // semantically-invalid empty string for a URL field.
    let logoUrl: string | null = area.logoPreview ?? null;
    if (logoUrl?.startsWith('data:')) {
      logoUrl = await uploadLogoToStorage(
        userId,
        logoUrl,
        `${product.sku || 'product'}-${technique.code || 'tech'}`,
      );
    }

    // BUG-PRODUCT-EXTRA-SELECT FIX: use product.id directly — no pre-validation SELECT.
    // Same pattern as BUG-A fix in useMockupDraft. The FK violation (23503) is
    // caught below and retried with product_id: null (~200ms saved on every save).
    const safeProductId = product.id || null;

    // BUG-10 FIX: generated_mockups.technique_id has a FK constraint pointing to
    // `personalization_techniques`, but the techniques shown in the UI come from
    // `tabela_preco_gravacao_oficial`. The two tables have ZERO overlapping UUIDs,
    // so inserting a `tabela_preco` UUID into `technique_id` always raises a FK
    // violation, causing saveMockupToDb to silently return null on EVERY invocation.
    // Solution: always null-out technique_id (the technique name is already persisted
    // in the `technique_name` text column, which is what all read paths use). The FK
    // column should only be set once the UI loads techniques from `personalization_techniques`.
    const safeTechniqueId = null;
    // BUG-CLIENT-ID FIX: persist client_id and client_name as top-level columns.
    const safeClientId = client?.id || null;
    const clientName = client?.nome_fantasia || client?.razao_social || client?.name || null;

    const insertPayload = {
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
      // BUG-MISSING-COLS FIX: persist logo_rotation/scale as top-level columns
      // (migration 20260620000001) so they survive without JSONB archaeology.
      logo_rotation: area.logoRotation ?? 0,
      logo_scale: area.logoScale ?? 100,
      // BUG-CLIENT-ID FIX: persist client_id/name as top-level columns.
      client_id: safeClientId,
      client_name: clientName,
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
        annotations: annotations && annotations.length > 0 ? annotations : null,
      },
    };

    const { data: insertedRow, error } = await untypedFrom('generated_mockups')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      if (error.code === '23503' && safeProductId) {
        // product_id FK violation — product UUID not in products table; retry with null.
        logger.warn('[saveMockupToDb] FK violation on product_id — retrying with null', {
          productId: safeProductId,
        });
        const { data: retryRow, error: retryError } = await untypedFrom('generated_mockups')
          .insert({ ...insertPayload, product_id: null })
          .select('id')
          .single();
        if (!retryError) return retryRow?.id || null;
        logger.error('[saveMockupToDb] FK retry also failed:', retryError);
      }
      logger.error('Error saving to history:', error);
      toast.error('Mockup gerado, mas não foi possível salvar no histórico.');
      return null;
    }
    return insertedRow?.id || null;
  } catch (error) {
    logger.error('Error saving to history:', error);
    toast.error('Mockup gerado, mas não foi possível salvar no histórico.');
    return null;
  }
}

export interface GenerateMockupParams {
  productImage: string;
  productName: string;
  technique: Technique;
  areas: PersonalizationArea[];
  /** Largura física do produto em cm (WYSIWYG): proporciona escala real do logo gerado. */
  productWidthCm?: number | null;
  /** Altura física do produto em cm (WYSIWYG): proporciona escala real do logo gerado. */
  productHeightCm?: number | null;
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
    if (area.logoPreview && area.logoPreview.startsWith('data:image/svg')) {
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

/** Builds the edge function body for a single area. */
function buildMockupPayload(params: GenerateMockupParams, area: PersonalizationArea) {
  // BUG-400c FIX (2026-06-18): the edge function contract expects:
  //   - `logoBase64` for inline data: URLs OR `logoUrl` for an https URL
  //     (it validates logoUrl with isValidHttpUrl, which REJECTS data: URLs);
  //   - `logoWidthCm` / `logoHeightCm` (NOT logoWidth/logoHeight);
  //   - `techniqueName` as a string (NOT a Technique object).
  const logo = area.logoPreview ?? '';
  const isDataUrl = logo.startsWith('data:');
  const logoPayload = isDataUrl ? { logoBase64: logo } : { logoUrl: logo };
  return {
    productImageUrl: params.productImage,
    productName: params.productName,
    techniqueName: params.technique.name,
    techniquePrompt: getTechniquePrompt(params.technique),
    ...logoPayload,
    areaName: area.name,
    positionX: area.positionX,
    positionY: area.positionY,
    logoWidthCm: area.logoWidth,
    logoHeightCm: area.logoHeight,
    logoRotation: area.logoRotation ?? 0,
    logoScale: area.logoScale ?? 100,
    // WYSIWYG: repassa dimensoes fisicas do produto para a edge function.
    // Sem esses valores, posX/posY sao calculados com prodW=0 → fallback /20.
    productWidthCm: params.productWidthCm ?? undefined,
    productHeightCm: params.productHeightCm ?? undefined,
  };
}

/** Single invocation attempt with 60s timeout. */
async function invokeMockupOnce(
  params: GenerateMockupParams,
  area: PersonalizationArea,
): Promise<string> {
  const generateCall = supabase.functions.invoke('generate-mockup', {
    body: buildMockupPayload(params, area),
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

/**
 * Returns true for transient infrastructure errors that warrant a retry.
 * User/payload errors (bad logo format, SVG, missing logo) propagate immediately.
 */
function isTransientError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('esgotado') || // pt-BR timeout message
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('failed to fetch') ||
    lower.includes('503') ||
    lower.includes('502')
  );
}

/**
 * Invokes the edge function for a single area with one automatic retry on
 * transient infrastructure failures (timeout, network drop, 502/503).
 * BUG-NO-RETRY FIX: previously a single network glitch aborted the whole generation.
 */
async function invokeMockupForArea(
  params: GenerateMockupParams,
  area: PersonalizationArea,
): Promise<string> {
  try {
    return await invokeMockupOnce(params, area);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isTransientError(msg)) {
      logger.warn('[invokeMockupForArea] Transient error, retrying in 2 s:', msg);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      });
      return invokeMockupOnce(params, area);
    }
    throw err;
  }
}

export async function generateMockupApi(
  params: GenerateMockupParams,
): Promise<GenerateMockupResult> {
  // BUG-400d FIX (2026-06-18): only areas that actually have a logo can be
  // composited — a logo-less area would be sent with an empty logo and rejected
  // by the edge function (422/400), surfacing as a spurious "X área(s) não
  // puderam ser geradas" warning. Callers may pass the full area list, so filter
  // defensively here (single source of truth for the contract).
  const areasWithLogos = params.areas.filter((a) => !!a.logoPreview);

  if (areasWithLogos.length === 0) {
    throw new Error('Faça upload de pelo menos um logo antes de gerar o mockup.');
  }

  // BUG-E: pre-validate BEFORE the (expensive) edge invocation.
  assertNotSvg(areasWithLogos);

  // BUG-I: single-area path sends ONLY the relevant area — never the dead areas[] payload.
  if (areasWithLogos.length === 1) {
    const url = await invokeMockupForArea(params, areasWithLogos[0]);
    return { singleUrl: url, batchResults: [] };
  }

  // BATCH: one invocation per area — run all concurrently (BUG-2 FIX: was sequential
  // for-loop which wasted N×latency for N areas; Promise.allSettled lets them run in
  // parallel while still collecting partial failures without short-circuiting on the
  // first error).
  const settled = await Promise.allSettled(
    areasWithLogos.map((area) =>
      invokeMockupForArea(params, area).then((url) => ({ url, areaName: area.name })),
    ),
  );
  const batchResults: { url: string; areaName: string }[] = [];
  let failures = 0;
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      batchResults.push(result.value);
    } else {
      failures += 1;
      logger.error('[generateMockupApi] área falhou:', result.reason);
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
): Promise<void> {
  const safeSku = product.sku?.replace(/[^a-zA-Z0-9]/g, '-') || 'mockup';
  const safeTechnique = (technique.code || technique.name).replace(/[^a-zA-Z0-9]/g, '-');
  const fileName = `mockup-${safeSku}-${safeTechnique}.pdf`;
  return downloadImageAsPdfFromUrl(mockupUrl, fileName);
}

export async function deleteMockupFromDb(id: string, userId?: string): Promise<void> {
  // BUG-22 FIX: fetch logo_url before deleting the row so we can clean up
  // the uploaded logo from storage. Best-effort — storage failure must not
  // prevent the DB delete from proceeding.
  // BUG-DELETE-ORPHANED-MOCKUP-PNG FIX: also fetch mockup_url so the composite
  // PNG (${userId}/mockups/${ts}-${uuid}.png) is removed — previously leaked.
  let selectQuery = untypedFrom<Record<string, unknown>>('generated_mockups')
    .select('logo_url, mockup_url')
    .eq('id', id);
  if (userId) selectQuery = selectQuery.eq('user_id', userId);
  const { data: rows } = await selectQuery.limit(1);
  // Explicit array narrowing instead of a double-cast through `unknown` (which would
  // hide an unexpected payload shape). Field values are read individually below.
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  const logoUrl = (row?.logo_url as string | null | undefined) ?? null;
  const mockupUrl = (row?.mockup_url as string | null | undefined) ?? null;

  let deleteQuery = supabase.from('generated_mockups').delete().eq('id', id);
  if (userId) deleteQuery = deleteQuery.eq('user_id', userId);
  const { error } = await deleteQuery;
  if (error) throw error;

  // Remove both logo and composite mockup PNG from storage after successful DB
  // delete (best-effort — storage failures must not surface to the caller).
  // Extract the storage path directly from the URL — avoids an extra getPublicUrl('')
  // round-trip and is robust to base-URL format variations (trailing slash, etc.).
  // Supabase storage public URLs follow the pattern:
  //   .../storage/v1/object/public/mockup-assets/<path>
  const STORAGE_PATH_RE = /\/storage\/v1\/object\/public\/mockup-assets\/(.+)$/;
  const pathsToRemove: string[] = [];
  for (const url of [logoUrl, mockupUrl]) {
    if (!url) continue;
    const match = url.match(STORAGE_PATH_RE);
    if (match?.[1]) pathsToRemove.push(match[1]);
  }

  if (pathsToRemove.length > 0) {
    try {
      await supabase.storage.from('mockup-assets').remove(pathsToRemove);
    } catch (storageErr) {
      logger.warn('[deleteMockupFromDb] Storage cleanup failed (non-fatal):', storageErr);
    }
  }
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
    // eslint-disable-next-line no-script-url -- security validation string, not a navigable URL
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
      ...t,
      id: String(t.id),
      name: String(t.name),
      code: t.code ? String(t.code) : null,
    }));
}

export function toastMockupSaved(productName: string): void {
  toast.success(`Mockup de ${productName} salvo no histórico!`);
}

export function toastMockupError(reason?: string): void {
  toast.error(reason || 'Erro ao gerar mockup. Tente novamente.');
}
