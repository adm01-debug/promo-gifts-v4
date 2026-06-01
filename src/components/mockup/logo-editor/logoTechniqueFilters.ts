export type TechniqueFilter = {
  filter: string;
  opacity: number;
  blend?: string;
  description: string;
};

export const TECHNIQUE_FILTERS: Record<string, TechniqueFilter> = {
  bordado: {
    filter: 'contrast(1.1) saturate(0.9)',
    opacity: 0.85,
    description: 'Textura de bordado',
  },
  silk: { filter: 'contrast(1.2) saturate(1.1)', opacity: 0.9, description: 'Serigrafia' },
  serigrafia: { filter: 'contrast(1.2) saturate(1.1)', opacity: 0.9, description: 'Serigrafia' },
  dtf: { filter: 'brightness(1.05) saturate(1.2)', opacity: 0.95, description: 'Transfer DTF' },
  laser: {
    filter: 'grayscale(1) contrast(1.3) sepia(0.3)',
    opacity: 0.7,
    description: 'Gravação laser',
  },
  laser_co2: {
    filter: 'grayscale(1) contrast(1.2) sepia(0.4) brightness(0.9)',
    opacity: 0.75,
    description: 'Laser CO2',
  },
  laser_fibra: {
    filter: 'grayscale(1) contrast(1.4) brightness(1.1)',
    opacity: 0.8,
    description: 'Laser Fibra',
  },
  sublimacao: {
    filter: 'saturate(1.3) brightness(1.05)',
    opacity: 0.92,
    description: 'Sublimação',
  },
  tampografia: { filter: 'contrast(1.15)', opacity: 0.88, description: 'Tampografia' },
  hot_stamping: {
    filter: 'sepia(0.5) saturate(1.5) brightness(1.2) contrast(1.1)',
    opacity: 0.85,
    description: 'Hot Stamping',
  },
  adesivo: { filter: 'brightness(1.02)', opacity: 0.95, description: 'Adesivo' },
  uv: {
    filter: 'contrast(1.1) saturate(1.15) brightness(1.05)',
    opacity: 0.9,
    description: 'Impressão UV',
  },
  transfer: { filter: 'contrast(1.05)', opacity: 0.88, description: 'Transfer' },
  default: { filter: 'none', opacity: 1, description: 'Preview' },
};

// Ordered matching rules: more specific patterns first to avoid false matches.
const TECHNIQUE_MATCH_ORDER: Array<{ pattern: string; key: string }> = [
  { pattern: 'laser_co2', key: 'laser_co2' },
  { pattern: 'laser_fibra', key: 'laser_fibra' },
  { pattern: 'co2', key: 'laser_co2' },
  { pattern: 'fibra', key: 'laser_fibra' },
  { pattern: 'laser', key: 'laser' },
  { pattern: 'bordado', key: 'bordado' },
  { pattern: 'serigrafia', key: 'serigrafia' },
  { pattern: 'silk', key: 'silk' },
  { pattern: 'dtf', key: 'dtf' },
  { pattern: 'sublima', key: 'sublimacao' },
  { pattern: 'tampografia', key: 'tampografia' },
  { pattern: 'hot_stamping', key: 'hot_stamping' },
  { pattern: 'hot stamping', key: 'hot_stamping' },
  { pattern: 'adesivo', key: 'adesivo' },
  { pattern: 'transfer', key: 'transfer' },
  // "uv" MUST be last — it's a substring of many technique names
  { pattern: 'uv', key: 'uv' },
];

export function getTechniqueFilter(
  techniqueCode?: string | null,
  techniqueName?: string,
): TechniqueFilter {
  if (!techniqueCode && !techniqueName) return TECHNIQUE_FILTERS.default;
  const combined = [techniqueCode, techniqueName].filter(Boolean).join(' ').toLowerCase();
  for (const rule of TECHNIQUE_MATCH_ORDER) {
    if (combined.includes(rule.pattern)) {
      return TECHNIQUE_FILTERS[rule.key];
    }
  }
  return TECHNIQUE_FILTERS.default;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
