/**
 * colorContrast — utilitários de contraste WCAG para o swatch de cor da proposta (#9).
 * @fix_version proposal-color-swatch-9-2026-06
 */

function channelLin(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa WCAG (0..1) de um hex #RRGGBB. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return 0.2126 * channelLin(r) + 0.7152 * channelLin(g) + 0.0722 * channelLin(b);
}

/** Razão de contraste WCAG entre dois hex (1..21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** True apenas para hex no formato #RRGGBB. */
export function isHex6(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Cor da borda do swatch (WCAG 1.4.11 — contornos ≥3:1). Se o preenchimento tem
 * menos de 3:1 de contraste com o branco (cor clara que "sumiria" no fundo), usa
 * #767676 (~4.5:1 no branco) para garantir o contorno; senão, borda sutil (o
 * próprio swatch já contrasta com o branco).
 */
export function swatchBorderColor(hex: string): string {
  return contrastRatio(hex, '#ffffff') < 3 ? '#767676' : 'rgba(0,0,0,0.25)';
}
