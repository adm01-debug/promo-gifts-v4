/**
 * Color matching utility — finds nearest Pantone color using Delta-E (CIE76)
 *
 * Converts RGB → Lab color space, then calculates Euclidean distance
 * to find the closest Pantone match from the catalog.
 */

import { PANTONE_CATALOG, type PantoneColor } from '@/data/pantone-coated';

// ─── RGB → Lab conversion ────────────────────────────────────────────

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // Normalize to 0-1
  let rr = r / 255,
    gg = g / 255,
    bb = b / 255;

  // sRGB → linear
  rr = rr > 0.04045 ? ((rr + 0.055) / 1.055) ** 2.4 : rr / 12.92;
  gg = gg > 0.04045 ? ((gg + 0.055) / 1.055) ** 2.4 : gg / 12.92;
  bb = bb > 0.04045 ? ((bb + 0.055) / 1.055) ** 2.4 : bb / 12.92;

  // Linear RGB → XYZ (D65)
  const x = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047;
  const y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.072175;
  const z = (rr * 0.0193339 + gg * 0.119192 + bb * 0.9503041) / 1.08883;

  // XYZ → Lab
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const L = 116 * f(y) - 16;
  const a = 500 * (f(x) - f(y));
  const bLab = 200 * (f(y) - f(z));

  return [L, a, bLab];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Delta-E (CIE76) — Euclidean distance in Lab space
function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt((lab1[0] - lab2[0]) ** 2 + (lab1[1] - lab2[1]) ** 2 + (lab1[2] - lab2[2]) ** 2);
}

// ─── Pre-compute Lab values for catalog ──────────────────────────────

interface PantoneWithLab extends PantoneColor {
  lab: [number, number, number];
}

let _catalogWithLab: PantoneWithLab[] | null = null;

function getCatalogWithLab(): PantoneWithLab[] {
  if (!_catalogWithLab) {
    _catalogWithLab = PANTONE_CATALOG.map((p) => ({
      ...p,
      lab: rgbToLab(p.r, p.g, p.b),
    }));
  }
  return _catalogWithLab;
}

// ─── Public API ──────────────────────────────────────────────────────

export interface PantoneMatch {
  pantoneCode: string;
  pantoneHex: string;
  deltaE: number;
}

/**
 * Find the closest Pantone color to a given hex code.
 * Returns the top N matches sorted by Delta-E (lower = better match).
 */
export function findNearestPantone(hex: string, topN: number = 5): PantoneMatch[] {
  const [r, g, b] = hexToRgb(hex);
  const targetLab = rgbToLab(r, g, b);
  const catalog = getCatalogWithLab();

  const scored = catalog.map((p) => ({
    pantoneCode: p.code,
    pantoneHex: p.hex,
    deltaE: deltaE(targetLab, p.lab),
  }));

  scored.sort((a, b) => a.deltaE - b.deltaE);
  return scored.slice(0, topN);
}

/**
 * Find the single best Pantone match for a hex color.
 */
export function getBestPantoneMatch(hex: string): PantoneMatch {
  return findNearestPantone(hex, 1)[0];
}
