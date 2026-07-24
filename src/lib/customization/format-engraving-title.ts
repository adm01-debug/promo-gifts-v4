/**
 * Formatação canônica do título da gravação exibido no cabeçalho
 * de uma técnica confirmada (ex.: "Fiber Laser | Plana").
 *
 * Regras:
 *  - Normaliza separadores comuns (`|`, `/`, `-`, `–`, `—`) para " | ".
 *  - Colapsa espaços múltiplos e faz trim.
 *  - Aplica capitalização por palavra, preservando siglas já em CAIXA ALTA
 *    (ex.: "3D", "UV", "DTF") e mantendo dígitos intactos.
 *  - Fallbacks encadeados: `nomeTabela` → `techniqueName` → `groupName` → `fallback`.
 */

export interface FormatEngravingTitleInput {
  nomeTabela?: string | null;
  techniqueName?: string | null;
  groupName?: string | null;
  fallback?: string;
}

const SEPARATOR_RE = /\s*[|/\-–—]\s*/g;
const WHITESPACE_RE = /\s+/g;
const ACRONYMS = new Set([
  'UV',
  'DTF',
  'DTG',
  'CNC',
  'LED',
  'PVC',
  'ABS',
  'PU',
  '3D',
  '2D',
  '4D',
]);

function capitalizeWord(word: string): string {
  if (!word) return word;
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  // Preserva tokens numéricos com sufixo (ex.: "3D", "10ML").
  if (/^[0-9]+[A-Za-z]+$/.test(word)) return word.toUpperCase();
  // Preserva siglas já em CAIXA ALTA (2-4 letras).
  if (word.length <= 4 && word === upper && /[A-Z]/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeSegment(segment: string): string {
  return segment
    .replace(WHITESPACE_RE, ' ')
    .trim()
    .split(' ')
    .map(capitalizeWord)
    .join(' ');
}

const DEFAULT_FALLBACK = 'Gravação confirmada';

export function formatEngravingTitle(input: FormatEngravingTitleInput): string {
  const source = firstNonEmpty(input.nomeTabela, input.techniqueName, input.groupName);
  if (!source) return input.fallback ?? DEFAULT_FALLBACK;

  const parts = source
    .replace(SEPARATOR_RE, ' | ')
    .split('|')
    .map(normalizeSegment)
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : (input.fallback ?? DEFAULT_FALLBACK);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}
