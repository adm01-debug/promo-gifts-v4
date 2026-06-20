/**
 * Audit puro de cobertura de campos críticos em componentes de kit.
 * Extraído de `products-detail.ts` para permitir testes unitários sem
 * tocar o bridge / edge function / rede.
 */

export const KIT_AUDITED_FIELDS = [
  'component_name',
  'component_description',
  'material',
  'color',
  'primary_image_url',
  'images',
  'height_mm',
  'width_mm',
  'length_mm',
  'diameter_mm',
  'circumference_mm',
  'weight_g',
  'capacity_ml',
  'component_type_code',
  'supplier_component_code',
  'personalization_notes',
] as const;

export type KitAuditedField = (typeof KIT_AUDITED_FIELDS)[number];

export interface FieldCoverage {
  filled: number;
  total: number;
  pct: number;
}

export interface KitCoverageReport {
  rows: number;
  coverage: Record<KitAuditedField, FieldCoverage>;
  fullyNullFields: KitAuditedField[];
  /** % médio de preenchimento entre todos os campos auditados. */
  avgPct: number;
}

/** Considera vazio: null, undefined, string "", array []. */
export function isFieldFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v) && v.length === 0) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

export function computeKitCoverage(
  rows: ReadonlyArray<Record<string, unknown>>,
): KitCoverageReport {
  const coverage = {} as Record<KitAuditedField, FieldCoverage>;
  const fullyNullFields: KitAuditedField[] = [];

  if (rows.length === 0) {
    for (const field of KIT_AUDITED_FIELDS) {
      coverage[field] = { filled: 0, total: 0, pct: 0 };
    }
    return { rows: 0, coverage, fullyNullFields: [], avgPct: 0 };
  }

  let sumPct = 0;
  for (const field of KIT_AUDITED_FIELDS) {
    const filled = rows.filter((r) => isFieldFilled(r[field])).length;
    const pct = Math.round((filled / rows.length) * 100);
    coverage[field] = { filled, total: rows.length, pct };
    sumPct += pct;
    if (filled === 0) fullyNullFields.push(field);
  }

  return {
    rows: rows.length,
    coverage,
    fullyNullFields,
    avgPct: Math.round(sumPct / KIT_AUDITED_FIELDS.length),
  };
}

/**
 * Compara cobertura de view enriquecida vs tabela base.
 * Regra: view NUNCA pode preencher MENOS campos que a base (deve ser super-set).
 * Retorna lista de campos onde a view regrediu — vazio = sucesso.
 */
export function compareCoverage(
  view: KitCoverageReport,
  base: KitCoverageReport,
): { regressions: Array<{ field: KitAuditedField; viewPct: number; basePct: number }> } {
  const regressions: Array<{ field: KitAuditedField; viewPct: number; basePct: number }> = [];
  for (const field of KIT_AUDITED_FIELDS) {
    const v = view.coverage[field].pct;
    const b = base.coverage[field].pct;
    if (v < b) regressions.push({ field, viewPct: v, basePct: b });
  }
  return { regressions };
}
