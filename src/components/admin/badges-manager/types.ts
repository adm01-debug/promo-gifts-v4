/**
 * Tipos, vocabulários e helpers visuais do módulo de Gestão de Badges (Cadastros).
 * Fonte de dados: tabela public.product_badge_definitions (registro canônico).
 */
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Clock,
  Crown,
  Flame,
  Folder,
  FolderTree,
  Gift,
  Globe,
  Hash,
  HelpCircle,
  Layers,
  Package,
  PackageX,
  Palette,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';
/**
 * Forma explícita da row de public.product_badge_definitions.
 * Definida standalone (NÃO derivada do Database gerado) de propósito: o arquivo
 * src/integrations/supabase/types.ts é regenerado/sobrescrito automaticamente e
 * nem sempre contém esta tabela — derivar dele reintroduz a regressão de tipos
 * (a tabela foi removida do Database por commits automáticos, quebrando o gate de TS).
 */
export interface BadgeDefinition {
  id: string;
  badge_key: string;
  name: string;
  short_label: string | null;
  description: string;
  business_rule: string;
  category: string;
  source_kind: string;
  data_source: string;
  placements: string[];
  surfaces: string[];
  icon_lucide: string | null;
  icon_emoji: string | null;
  color_token: string;
  class_bg: string | null;
  class_text: string | null;
  class_border: string | null;
  priority: number;
  sort_order: number;
  config: Json;
  supports_expiration: boolean;
  is_enabled: boolean;
  is_system: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type BadgeDefinitionInsert = Partial<BadgeDefinition> &
  Pick<BadgeDefinition, 'badge_key' | 'category' | 'name' | 'source_kind'>;
export type BadgeDefinitionUpdate = Partial<BadgeDefinition>;

export const BADGE_CATEGORIES = [
  'status_estoque',
  'novidade',
  'curadoria',
  'comercial',
  'inteligencia',
  'atributo',
  'acao',
  'sistema',
] as const;
export type BadgeCategory = (typeof BADGE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  status_estoque: 'Status de estoque',
  novidade: 'Novidade',
  curadoria: 'Curadoria',
  comercial: 'Comercial',
  inteligencia: 'Inteligência de mercado',
  atributo: 'Atributo',
  acao: 'Ação',
  sistema: 'Sistema',
};

export const SOURCE_KINDS = [
  'computed',
  'manual',
  'pipeline',
  'intelligence',
  'ui_only',
  'hybrid',
] as const;
export const SOURCE_KIND_LABELS: Record<string, string> = {
  computed: 'Computado',
  manual: 'Manual',
  pipeline: 'Pipeline',
  intelligence: 'Inteligência',
  ui_only: 'Somente UI',
  hybrid: 'Híbrido',
};

export const PLACEMENTS = [
  'card_header_left',
  'card_header_right',
  'card_body',
  'card_footer',
  'corner_bl',
  'corner_br',
  'intelligence_panel',
  'product_detail',
  'catalog',
] as const;
export const PLACEMENT_LABELS: Record<string, string> = {
  card_header_left: 'Card · topo esq.',
  card_header_right: 'Card · topo dir.',
  card_body: 'Card · corpo',
  card_footer: 'Card · rodapé',
  corner_bl: 'Card · canto inf. esq.',
  corner_br: 'Card · canto inf. dir.',
  intelligence_panel: 'Painel de inteligência',
  product_detail: 'Detalhe do produto',
  catalog: 'Catálogo (geral)',
};

export const SURFACES = [
  'catalog',
  'super_filter',
  'product_detail',
  'novelties',
  'comparison',
  'quote_builder',
  'inventory',
] as const;
export const SURFACE_LABELS: Record<string, string> = {
  catalog: 'Catálogo',
  super_filter: 'Super Filtro',
  product_detail: 'Detalhe do produto',
  novelties: 'Novidades',
  comparison: 'Comparar',
  quote_builder: 'Orçamento',
  inventory: 'Estoque',
};

export const COLOR_TOKENS = [
  'neutral',
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'stone',
  'brand',
] as const;

export interface ColorClasses {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

/**
 * Classes Tailwind ESTÁTICAS por token (o JIT precisa das strings literais no código).
 */
export const COLOR_TOKEN_CLASSES: Record<string, ColorClasses> = {
  neutral: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  orange: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  amber: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  yellow: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  teal: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200', dot: 'bg-teal-500' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500' },
  indigo: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  violet: {
    bg: 'bg-violet-100',
    text: 'text-violet-800',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  pink: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200', dot: 'bg-pink-500' },
  stone: {
    bg: 'bg-stone-100',
    text: 'text-stone-700',
    border: 'border-stone-200',
    dot: 'bg-stone-500',
  },
  brand: {
    bg: 'bg-primary/15',
    text: 'text-primary',
    border: 'border-primary/30',
    dot: 'bg-primary',
  },
};

const NEUTRAL_CLASSES: ColorClasses = COLOR_TOKEN_CLASSES.neutral;

export function colorClasses(token: string | null | undefined): ColorClasses {
  if (!token) return NEUTRAL_CLASSES;
  return COLOR_TOKEN_CLASSES[token] ?? NEUTRAL_CLASSES;
}

const ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Clock,
  Crown,
  Flame,
  Folder,
  FolderTree,
  Gift,
  Globe,
  Hash,
  Layers,
  Package,
  PackageX,
  Palette,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  Trophy,
  Users,
  Zap,
};

export const ICON_OPTIONS: string[] = Object.keys(ICON_MAP).sort();

export function resolveBadgeIcon(name: string | null | undefined): LucideIcon {
  if (name) {
    const found = ICON_MAP[name];
    if (found) return found;
  }
  return HelpCircle;
}
