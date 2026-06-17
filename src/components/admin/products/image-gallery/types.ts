/**
 * Shared types and constants for ProductImageGallery
 */

import {
  Star,
  ImageIcon,
  ZoomIn,
  Eye,
  Layers,
  Package,
  Film,
  Type,
  Palette,
  Tag,
  Crop,
  Archive,
} from 'lucide-react';

export interface ExternalImage {
  id: string;
  product_id: string;
  url_cdn?: string;
  url_original?: string;
  url?: string;
  alt_text?: string;
  title_text?: string;
  image_type?: string;
  is_primary?: boolean;
  is_og_image?: boolean;
  display_order?: number;
  caption?: string;
  format?: string;
  width_px?: number;
  height_px?: number;
  file_size_bytes?: number;
  color_id?: string;
  variant_id?: string;
  supplier_code?: string;
  is_active?: boolean;
  applies_to_color?: boolean;
  // Cloudflare Images sync
  cf_image_id?: string;
  cf_sync_status?: 'pending' | 'syncing' | 'verified' | 'missing' | 'failed' | 'skipped';
  // Perceptual hash for duplicate detection
  content_hash?: string;
  // Blurhash placeholder for progressive loading
  blurhash?: string;
}

export const IMAGE_TYPES = [
  { value: 'main', label: 'Principal', icon: Star, color: 'text-warning' },
  { value: 'gallery', label: 'Galeria', icon: ImageIcon, color: 'text-info' },
  { value: 'product', label: 'Variação de cor', icon: Palette, color: 'text-teal-500' },
  { value: 'detail', label: 'Detalhe', icon: ZoomIn, color: 'text-success' },
  { value: 'ambient', label: 'Ambientada', icon: Eye, color: 'text-sky-500' },
  { value: 'component', label: 'Componente', icon: Layers, color: 'text-primary' },
  { value: 'box', label: 'Embalagem', icon: Package, color: 'text-brand-primary' },
  { value: 'pouch', label: 'Bolsa', icon: Archive, color: 'text-slate-400' },
  { value: 'mockup', label: 'Mockup', icon: Eye, color: 'text-primary' },
  { value: 'location', label: 'Posicionamento', icon: Crop, color: 'text-slate-400' },
  { value: 'area', label: 'Área de gravação', icon: Tag, color: 'text-slate-400' },
  { value: 'video', label: 'Vídeo', icon: Film, color: 'text-destructive' },
  { value: 'set', label: 'Conjunto', icon: Layers, color: 'text-success' },
  { value: 'logo', label: 'Logo', icon: Type, color: 'text-primary' },
];

export type FilterMode = 'all' | 'general' | 'by-variant' | string;

export interface VariantInfo {
  id: string;
  color_name: string | null;
  color_hex: string | null;
  supplier_code?: string;
  name: string;
}

export interface GalleryStats {
  byType: Map<string, number>;
  byVariant: Map<string, number>;
  withAlt: number;
  withoutVariant: number;
  total: number;
  cfVerified: number;
  cfPending: number;
  withBlurhash: number;
}
