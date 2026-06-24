/**
 * SSOT para formatação do resumo de uma personalização em orçamentos.
 *
 * Usado por:
 *  - Builder (QuoteBuilderSummaryColumn) — partes individuais
 *  - PDF/HTML (ProposalProductTable, ProposalSections) — string completa
 *
 * Garante prefixo `[Local]`, separadores e unidades idênticos em todos os pontos
 * (web ↔ PDF ↔ proposta enviada ao cliente). Backward-compat com orçamentos
 * antigos sem `location_name` (omite o prefixo) e com `colors_count` ausente/zero
 * (assume `1 cor` como padrão consistente).
 */

export interface PersonalizationSummaryInput {
  technique_name?: string | null;
  location_name?: string | null;
  width_cm?: number | null;
  height_cm?: number | null;
  colors_count?: number | null;
  material?: string | null;
  notes?: string | null;
}

export const DEFAULT_COLORS_COUNT = 1;
export const TECHNIQUE_FALLBACK = 'Personalização';

/** Normaliza colors_count: ausente/<=0/NaN ⇒ DEFAULT_COLORS_COUNT. */
export function normalizeColorsCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_COLORS_COUNT;
  return Math.trunc(n);
}

/** "1 cor" | "2 cores" — sempre singular/plural correto. */
export function formatColors(count: unknown): string {
  const n = normalizeColorsCount(count);
  return `${n} ${n === 1 ? 'cor' : 'cores'}`;
}

/** Extrai dimensões do campo `notes` (compat com orçamentos antigos). */
export function extractDimensionsFromNotes(
  notes?: string | null,
): { width: number; height: number } | null {
  if (!notes) return null;
  const m = /\|\s*([\d.]+)×([\d.]+)cm/.exec(notes);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { width: w, height: h };
}

/** Retorna `[Local] Técnica` ou só `Técnica` quando ausente. */
export function formatTechniqueWithLocation(p: PersonalizationSummaryInput): string {
  const tech = (p.technique_name ?? '').trim() || TECHNIQUE_FALLBACK;
  const loc = (p.location_name ?? '').trim();
  return loc ? `[${loc}] ${tech}` : tech;
}

/** "12×8cm" — área máxima de gravação. */
export function formatArea(width?: number | null, height?: number | null): string | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return `${width}×${height}cm`;
}

/**
 * String canônica para PDF/HTML/proposta enviada ao cliente.
 * Formato: `[Local] Técnica W×Hcm | N cores | Material`
 */
export function formatPersonalizationSummary(p: PersonalizationSummaryInput): string {
  let s = formatTechniqueWithLocation(p);

  let widthCm = p.width_cm ?? null;
  let heightCm = p.height_cm ?? null;
  if (!widthCm || !heightCm) {
    const fromNotes = extractDimensionsFromNotes(p.notes);
    if (fromNotes) {
      widthCm = widthCm || fromNotes.width;
      heightCm = heightCm || fromNotes.height;
    }
  }
  const area = formatArea(widthCm, heightCm);
  if (area) s += ` ${area}`;

  // Sempre exibe cores (mesmo ausente ⇒ "1 cor") para consistência cliente↔builder.
  s += ` | ${formatColors(p.colors_count)}`;

  if (p.material && p.material.trim()) s += ` | ${p.material.trim()}`;
  return s;
}

/** Join padrão de múltiplas personalizações em uma única célula. */
export const PERSONALIZATION_JOIN_SEPARATOR = ' · ';

export function formatPersonalizationsList(items: PersonalizationSummaryInput[]): string {
  return items.map(formatPersonalizationSummary).join(PERSONALIZATION_JOIN_SEPARATOR);
}
