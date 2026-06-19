/**
 * Technique color classification utilities
 * Extracted to a separate module to enable tree-shaking of the heavy Dialog component
 */

export type TechniqueCategory = 'laser' | 'serigrafia' | 'digital' | 'other';

export type LaserTone = 'claro' | 'escuro';

export interface TechniqueColorConfig {
  category: TechniqueCategory;
  laserTone?: LaserTone;
  colorCount?: number;
  selectedPantoneIndices?: number[];
  selectedColors?: Array<{ hex: string; pantoneCode: string }>;
  isFullColor?: boolean;
}

/**
 * Determine which category a technique belongs to based on its name/code.
 */
export function classifyTechnique(
  techniqueName?: string,
  techniqueCode?: string | null,
): TechniqueCategory {
  if (!techniqueName && !techniqueCode) return 'other';

  const combined = [techniqueCode, techniqueName].filter(Boolean).join(' ').toLowerCase();

  // Laser detection — must come before UV check since "Laser UV" exists
  if (combined.includes('laser') || combined.includes('fibra') || combined.includes('co2')) {
    // Laser UV is actually a UV technique (full color capable)
    if (combined.includes('laser uv') || combined.includes('uv laser')) {
      return 'digital';
    }
    return 'laser';
  }

  // Serigrafia detection
  if (
    combined.includes('serigrafia') ||
    combined.includes('silk') ||
    combined.includes('tampografia')
  ) {
    return 'serigrafia';
  }

  // Digital / Full color techniques
  if (
    combined.includes('digital') ||
    combined.includes('uv') ||
    combined.includes('sublima') ||
    combined.includes('dtf') ||
    combined.includes('transfer')
  ) {
    return 'digital';
  }

  return 'other';
}

/**
 * Check if a technique requires color configuration dialog
 */
export function techniqueNeedsColorConfig(
  techniqueName?: string,
  techniqueCode?: string | null,
): boolean {
  const cat = classifyTechnique(techniqueName, techniqueCode);
  return cat === 'laser' || cat === 'serigrafia';
}
