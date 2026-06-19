/**
 * Types and constants for ProductEngravingSection
 */
import type React from 'react';
import { Layers, MapPin, Paintbrush, Ruler } from 'lucide-react';
import { TECHNIQUE_ICONS } from '@/types/gravacao';

/** Técnica do catálogo externo (tabela_preco_gravacao_oficial) */
export interface ExternalTechnique {
  id: string;
  /** @deprecated use `name` */
  nome: string;
  name?: string | null;
  codigo_curto?: string | null;
  /** @deprecated use `code` */
  codigo?: string | null;
  code?: string | null;
  /** @deprecated use `group` */
  grupo_tecnica?: string;
  group?: string | null;
  /** @deprecated use `group_name` */
  nome_grupo?: string;
  group_name?: string | null;
  /** @deprecated use `max_colors` */
  max_cores?: number | string | null;
  max_colors?: number | null;
  /** @deprecated use `charges_per_color` */
  cobra_por_cor?: boolean;
  charges_per_color?: boolean | null;
  /** @deprecated use `setup_price` */
  custo_setup?: number | null;
  setup_price?: number | null;
  /** @deprecated use `handling_price` */
  custo_manuseio?: number | null;
  handling_price?: number | null;
  /** @deprecated use `active` */
  ativo?: boolean;
  active?: boolean | null;
}

/** Registro de print_area_techniques (BD externo) */
export interface PrintAreaTechnique {
  id: string;
  product_id: string;
  /** @deprecated use `price_table_id` */
  tabela_preco_id: string;
  price_table_id?: string | null;
  /** @deprecated use `location_code` (são equivalentes) */
  location_code: string;
  location_name: string | null;
  location_order: number | null;
  max_width: number | null;
  max_height: number | null;
  is_curved: boolean;
  shape: string;
  technique_order: number;
  /** @deprecated use `is_active` */
  is_active: boolean;
  ativo?: boolean | null;
  notes: string | null;
  unit_cost: number | null;
  created_at?: string;
  updated_at?: string;
}

/** Área enriquecida com dados da técnica (para exibição) */
export interface EnrichedArea extends PrintAreaTechnique {
  technique_name: string;
  technique_code: string;
  technique_group: string;
  max_colors: number | null;
  setup_cost: number | null;
  charges_per_color: boolean;
}

export type WizardStep = 'list' | 'component' | 'location' | 'technique' | 'details';

export const WIZARD_STEPS: Array<{ id: WizardStep; label: string; icon: React.ElementType }> = [
  { id: 'component', label: 'Componente', icon: Layers },
  { id: 'location', label: 'Local', icon: MapPin },
  { id: 'technique', label: 'Técnica', icon: Paintbrush },
  { id: 'details', label: 'Detalhes', icon: Ruler },
];

export const COMMON_COMPONENTS = [
  { code: 'CORPO', name: 'Corpo', icon: '📦' },
  { code: 'TAMPA', name: 'Tampa', icon: '🔲' },
  { code: 'MANGA', name: 'Manga', icon: '👕' },
  { code: 'BOLSO', name: 'Bolso', icon: '👜' },
  { code: 'CAIXA', name: 'Caixa/Embalagem', icon: '📦' },
  { code: 'ALCA', name: 'Alça', icon: '🔗' },
  { code: 'BASE', name: 'Base', icon: '⬜' },
  { code: 'CANETA', name: 'Caneta/Clip', icon: '🖊️' },
  { code: 'OUTRO', name: 'Outro', icon: '✏️' },
];

export const COMMON_LOCATIONS = [
  { code: 'FRENTE', name: 'Frente' },
  { code: 'VERSO', name: 'Verso / Costas' },
  { code: 'LADO-A', name: 'Lado A (Esquerdo)' },
  { code: 'LADO-B', name: 'Lado B (Direito)' },
  { code: 'CENTRO', name: 'Centro' },
  { code: 'SUPERIOR', name: 'Superior / Topo' },
  { code: 'INFERIOR', name: 'Inferior / Base' },
  { code: '360', name: '360° (Envolvente)' },
  { code: 'INTERNO', name: 'Interno' },
  { code: 'CIRCULAR', name: 'Circular' },
  { code: 'TAMPA', name: 'Tampa' },
  { code: 'CLIP', name: 'Clip' },
];

export function getTechniqueIcon(code: string): string {
  const upper = code?.toUpperCase() ?? '';
  return TECHNIQUE_ICONS[upper] || '🔧';
}

const TECHNIQUE_COLOR_MAP: Record<string, string> = {
  SERIGRAFIA: 'from-blue-500/20 to-blue-600/10 border-info/30',
  SER: 'from-blue-500/20 to-blue-600/10 border-info/30',
  SC: 'from-blue-500/20 to-blue-600/10 border-info/30',
  LASER: 'from-destructive/20 to-destructive/10 border-destructive/30',
  FB: 'from-destructive/20 to-destructive/10 border-destructive/30',
  UV: 'from-primary/20 to-primary/10 border-primary/30',
  TAMPOGRAFIA: 'from-success/20 to-success/10 border-success/30',
  TAMP: 'from-success/20 to-success/10 border-success/30',
  BORDADO: 'from-yellow-500/20 to-yellow-600/10 border-warning/30',
  BD: 'from-yellow-500/20 to-yellow-600/10 border-warning/30',
  SUBLIMACAO: 'from-pink-500/20 to-primary/10 border-pink-500/30',
  SUB: 'from-pink-500/20 to-primary/10 border-pink-500/30',
  HOT_STAMPING: 'from-brand-primary/20 to-brand-primary/10 border-brand-primary/30',
  TRANSFER: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  ADESIVO: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30',
} as const;

export function getTechniqueColor(code: string): string {
  const upper = code?.toUpperCase() ?? '';
  for (const [key, val] of Object.entries(TECHNIQUE_COLOR_MAP)) {
    if (upper.includes(key)) return val;
  }
  return 'from-muted/40 to-muted/20 border-border/50';
}

export interface DetailFormState {
  max_width: number | null;
  max_height: number | null;
  is_curved: boolean;
  shape: string;
  unit_cost: number | null;
  notes: string;
  is_active: boolean;
}

export const DEFAULT_DETAIL_FORM: DetailFormState = {
  max_width: null,
  max_height: null,
  is_curved: false,
  shape: 'rectangle',
  unit_cost: null,
  notes: '',
  is_active: true,
};
