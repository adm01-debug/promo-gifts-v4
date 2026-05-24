/**
 * mockupGenerationService — Handles mockup generation API calls and history persistence.
 * Extracted from useMockupGenerator to reduce hook complexity.
 */
import { supabase } from '@/integrations/supabase/client';
import { uploadLogoToStorage, downloadImageAsPdfFromUrl } from '@/lib/mockup-storage';
import { toast } from 'sonner';
import type { PersonalizationArea } from '@/components/mockup/MultiAreaManager';

// ─── Types ───────────────────────────────────────────────────────────

export interface Technique {
  id: string;
  name: string;
  code: string | null;
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
  logo_url: string;
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

// ─── Technique prompt mapping ────────────────────────────────────────

const TECHNIQUE_PROMPTS: Record<string, string> = {
  bordado: 'as professional machine embroidery with visible thread stitching texture',
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

export function getTechniquePrompt(technique: Technique): string {
  const code = technique.code?.toLowerCase() || technique.name.toLowerCase();
  for (const [key, prompt] of Object.entries(TECHNIQUE_PROMPTS)) {
    if (code.includes(key) || technique.name.toLowerCase().includes(key)) return prompt;
  }
  return TECHNIQUE_PROMPTS.default;
}

// ─── History fetching ────────────────────────────────────────────────

export async function fetchMockupHistory(userId?: string): Promise<GeneratedMockup[]> {
  let query = supabase
    .from('generated_mockups')
    .select(
      'id, product_id, product_name, product_sku, technique_id, technique_name, mockup_url, created_at',
    )
    .order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as GeneratedMockup[];
}

// ─── Save to history ─────────────────────────────────────────────────

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

    // Validate FK targets
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
        thumbnail_url: logoUrl || null,
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

// ─── Generate mockup ─────────────────────────────────────────────────

export interface GenerateMockupParams {
  productImage: string;
  productName: string;
  technique: Technique;
  areas: PersonalizationArea[];
}

export interface GenerateMockupResult {
  singleUrl: string | null;
  batchResults: { areaName: string; url: string }[];
}

export async function generateMockupApi(
  params: GenerateMockupParams,
): Promise<GenerateMockupResult> {
  const { productImage, productName, technique, areas } = params;
  const areasWithLogos = areas.filter((a) => a.logoPreview);
  const techniquePrompt = getTechniquePrompt(technique);

  if (areasWithLogos.length === 1) {
    const area = areasWithLogos[0];
    const isLogoUrl = area.logoPreview?.startsWith('http');

    const response = await supabase.functions.invoke('generate-mockup', {
      body: {
        productImageUrl: productImage,
        logoBase64: isLogoUrl ? undefined : area.logoPreview,
        logoUrl: isLogoUrl ? area.logoPreview : undefined,
        techniqueName: technique.name,
        techniquePrompt,
        positionX: area.positionX,
        positionY: area.positionY,
        logoWidthCm: area.logoWidth,
        logoHeightCm: area.logoHeight,
        logoRotation: area.logoRotation || 0,
        logoScale: area.logoScale ?? 100,
        productName,
        areas: areasWithLogos.map((a) => ({
          name: a.name,
          positionX: a.positionX,
          positionY: a.positionY,
          logoWidth: a.logoWidth,
          logoHeight: a.logoHeight,
          logoRotation: a.logoRotation || 0,
          logoScale: a.logoScale ?? 100,
        })),
      },
    });

    if (response.error) {
      const errData = response.data || response.error;
      if (errData?.errorCode === 'SVG_NOT_SUPPORTED') {
        throw new Error(errData.error || 'Logos SVG não são suportados. Use PNG ou JPG.');
      }
      throw response.error;
    }
    if (!response.data?.mockupUrl) throw new Error('Nenhuma imagem retornada');
    return { singleUrl: response.data.mockupUrl, batchResults: [] };
  }

  // BATCH
  const results: { areaName: string; url: string }[] = [];
  for (const area of areasWithLogos) {
    const isLogoUrl = area.logoPreview?.startsWith('http');
    toast.info(`Gerando ${area.name}...`, { duration: 2000 });

    const response = await supabase.functions.invoke('generate-mockup', {
      body: {
        productImageUrl: productImage,
        logoBase64: isLogoUrl ? undefined : area.logoPreview,
        logoUrl: isLogoUrl ? area.logoPreview : undefined,
        techniqueName: technique.name,
        techniquePrompt,
        positionX: area.positionX,
        positionY: area.positionY,
        logoWidthCm: area.logoWidth,
        logoHeightCm: area.logoHeight,
        logoRotation: area.logoRotation || 0,
        logoScale: area.logoScale ?? 100,
        productName,
        areas: [
          {
            name: area.name,
            positionX: area.positionX,
            positionY: area.positionY,
            logoWidth: area.logoWidth,
            logoHeight: area.logoHeight,
            logoRotation: area.logoRotation || 0,
            logoScale: area.logoScale ?? 100,
          },
        ],
      },
    });

    if (response.error) {
      console.error(`Error generating ${area.name}:`, response.error);
      continue;
    }
    if (response.data?.mockupUrl)
      results.push({ areaName: area.name, url: response.data.mockupUrl });
  }

  if (results.length === 0) throw new Error('Nenhum mockup gerado no batch');
  return { singleUrl: results[0].url, batchResults: results };
}

// ─── Download ────────────────────────────────────────────────────────

export async function downloadMockupAsPdf(mockupUrl: string, sku?: string, techniqueName?: string) {
  const safeSku = (sku || 'produto').replace(/[^a-zA-Z0-9-_]/g, '-');
  const safeTechnique = (techniqueName || 'tecnica').replace(/[^a-zA-Z0-9-_]/g, '-');
  const fileName = `mockup-${safeSku}-${safeTechnique}.pdf`;
  await downloadImageAsPdfFromUrl(mockupUrl, fileName);
}

// ─── Delete ──────────────────────────────────────────────────────────

export async function deleteMockupFromDb(id: string, userId?: string): Promise<void> {
  let query = supabase.from('generated_mockups').delete().eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
}

// ─── Default area ────────────────────────────────────────────────────

export const createDefaultArea = (): PersonalizationArea => ({
  id: crypto.randomUUID(),
  name: 'Frente',
  positionX: 50,
  positionY: 50,
  logoWidth: 5,
  logoHeight: 3,
  logoRotation: 0,
  logoScale: 100,
  logoPreview: null,
});
