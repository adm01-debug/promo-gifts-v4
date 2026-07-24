/**
 * Variant matching helpers — usados pelo SyncedZoomGallery e ComparisonDuelView
 * para sincronizar troca de variante entre produtos comparados.
 */

interface ColorLike {
  name?: string | null;
  hex?: string | null;
}

/** Normaliza nome de cor para comparação (lowercase, sem acentos). */
export function normalizeColorName(name?: string | null): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Distância euclidiana entre duas cores hex (0-441). Útil para matching. */
export function hexDistance(hexA?: string | null, hexB?: string | null): number {
  if (!hexA || !hexB) return Infinity;
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return Infinity;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

/**
 * Encontra o índice da melhor cor correspondente em "colors".
 * Retorna -1 se nada bater.
 */
export function findMatchingColorIndex(target: ColorLike, colors: ColorLike[]): number {
  if (colors.length === 0) return -1;
  // 1) Match exato por nome
  const targetName = normalizeColorName(target.name);
  if (targetName) {
    const idx = colors.findIndex((c) => normalizeColorName(c.name) === targetName);
    if (idx >= 0) return idx;
  }
  // 2) Match por hex próximo (distância < 30)
  if (target.hex) {
    let bestIdx = -1;
    let bestDist = 30;
    colors.forEach((c, i) => {
      const d = hexDistance(target.hex, c.hex);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) return bestIdx;
  }
  return -1;
}
