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

function capitalizeWord(word: string): string {
  if (!word) return word;
  // Preserva tokens já totalmente maiúsculos (siglas) e tokens numéricos.
  if (/^[0-9]+[A-Z]*$/.test(word)) return word.toUpperCase();
  if (word.length <= 3 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
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

export function formatEngravingTitle(input: FormatEngravingTitleInput): string {
  const raw =
    firstNonEmpty(input.nomeTabela, input.techniqueName, input.groupName) ??
    (input.fallback ?? 'Gravação confirmada');

  const parts = raw
    .replace(SEPARATOR_RE, ' | ')
    .split('|')
    .map(normalizeSegment)
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : (input.fallback ?? 'Gravação confirmada');
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}
