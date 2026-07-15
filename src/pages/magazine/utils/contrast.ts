/**
 * Utilitários de contraste WCAG e validação de HEX para o módulo Magazine.
 * Tudo puro / testável, sem dependências externas.
 */

export function normalizeHex(input: string): string {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return '';
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== '';
}

function hexToRgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055)**2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** Razão de contraste WCAG (1 a 21). */
export function contrastRatio(fg: string, bg: string): number {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return 1;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WcagLevel = 'AA-large' | 'AA' | 'AAA' | 'fail';

export function wcagLevel(fg: string, bg: string): WcagLevel {
  const r = contrastRatio(fg, bg);
  if (r >= 7) return 'AAA';
  if (r >= 4.5) return 'AA';
  if (r >= 3) return 'AA-large';
  return 'fail';
}

export const WCAG_LABEL: Record<WcagLevel, string> = {
  AAA: 'AAA · contraste excelente',
  AA: 'AA · aprovado',
  'AA-large': 'AA apenas para texto grande',
  fail: 'Falha WCAG · legibilidade baixa',
};

/** Presets curados de paleta usados no picker de identidade. */
export const BRAND_PRESETS: Array<{
  name: string;
  primary: string;
  secondary: string;
  text: string;
}> = [
  { name: 'Editorial', primary: '#0f172a', secondary: '#dc2626', text: '#111111' },
  { name: 'Corporativo', primary: '#0c2340', secondary: '#c9a84c', text: '#0f172a' },
  { name: 'Executivo', primary: '#0d0d0d', secondary: '#c9a84c', text: '#111111' },
  { name: 'Moderno', primary: '#1e293b', secondary: '#0ea5e9', text: '#0f172a' },
  { name: 'Vibrante', primary: '#111827', secondary: '#f97316', text: '#111827' },
  { name: 'Sóbrio', primary: '#111111', secondary: '#6366f1', text: '#111111' },
];
