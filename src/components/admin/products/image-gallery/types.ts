/**
 * Shared types and constants for ProductImageGallery
 */

import { Star, ImageIcon, ZoomIn, Eye, Layers, Package, Film, Type } from 'lucide-react';

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
}

export const IMAGE_TYPES = [
  { value: 'main', label: 'Principal', icon: Star, color: 'text-warning' },
  { value: 'gallery', label: 'Galeria', icon: ImageIcon, color: 'text-info' },
  { value: 'detail', label: 'Detalhe', icon: ZoomIn, color: 'text-success' },
  { value: 'ambient', label: 'Ambientada', icon: Eye, color: 'text-sky-500' },
  { value: 'component', label: 'Componente', icon: Layers, color: 'text-primary' },
  { value: 'box', label: 'Embalagem', icon: Package, color: 'text-brand-primary' },
  { value: 'mockup', label: 'Mockup', icon: Eye, color: 'text-primary' },
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
}
