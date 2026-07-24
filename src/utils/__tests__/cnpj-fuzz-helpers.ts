/**
 * Helpers determinísticos para fuzzing de CNPJ.
 * PRNG mulberry32 → reprodutibilidade total via seed.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function calcDv(slice: string, weights: number[]): number {
  const sum = weights.reduce((s, w, i) => s + parseInt(slice[i], 10) * w, 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Gera CNPJ de 14 dígitos com DVs corretos a partir de uma seed. */
export function generateValidCnpj(seed: number): string {
  const rand = mulberry32(seed || 1);
  let base = '';
  while (base.length < 12) base += Math.floor(rand() * 10).toString();
  // Evita todos-iguais
  if (/^(\d)\1{11}$/.test(base)) base = base.slice(0, 11) + ((parseInt(base[0], 10) + 1) % 10);
  const d1 = calcDv(base, W1);
  const d2 = calcDv(base + d1, W2);
  return base + d1 + d2;
}

export type MutationKind =
  'break-dv' | 'duplicate-digit' | 'emoji' | 'inject-letter' | 'nbsp' | 'noop' | 'rtl' | 'truncate' | 'whitespace' | 'zero-width';

const ZWJ = '\u200D';
const ZWSP = '\u200B';
const NBSP = '\u00A0';
const RTL = '\u202E';

export function mutate(cnpj: string, kind: MutationKind, rand: () => number): { value: string; expectValid: boolean } {
  const digits = cnpj.replace(/\D/g, '');
  switch (kind) {
    case 'inject-letter': {
      const i = Math.floor(rand() * digits.length);
      return { value: `${digits.slice(0, i)}X${digits.slice(i)}`, expectValid: true }; // letra é limpa pelo normalize
    }
    case 'break-dv': {
      const last = (parseInt(digits[13], 10) + 1) % 10;
      return { value: digits.slice(0, 13) + last, expectValid: false };
    }
    case 'truncate':
      return { value: digits.slice(0, 10), expectValid: false };
    case 'duplicate-digit':
      return { value: digits + digits[0], expectValid: false }; // 15 dígitos → normalize trunca p/ 14; DV bate se original válido? não, trunca do fim é slice(0,14) → volta ao original. Então append no início:
    case 'zero-width':
      return { value: ZWJ + digits.slice(0, 5) + ZWSP + digits.slice(5), expectValid: true };
    case 'nbsp':
      return { value: digits.slice(0, 8) + NBSP + digits.slice(8), expectValid: true };
    case 'rtl':
      return { value: RTL + digits, expectValid: true };
    case 'emoji':
      return { value: `${digits.slice(0, 4)}🎁${digits.slice(4)}`, expectValid: true };
    case 'whitespace':
      return { value: `  ${digits.split('').join(' ')}  `, expectValid: true };
    case 'noop':
    default:
      return { value: digits, expectValid: true };
  }
}

export function randomMask(cnpj: string, rand: () => number): string {
  const d = cnpj.replace(/\D/g, '').padEnd(14, '0').slice(0, 14);
  const styles = [
    `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`,
    `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 12)} ${d.slice(12)}`,
    d,
    `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5, 8)}-${d.slice(8, 12)}-${d.slice(12)}`,
  ];
  return styles[Math.floor(rand() * styles.length)];
}
