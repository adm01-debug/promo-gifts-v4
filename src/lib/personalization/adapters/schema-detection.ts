import { logger } from '@/lib/logger';
/**
 * Schema detection — Identifica a versão do payload de gravação.
 *
 * Centraliza a heurística que antes vivia dentro de `mapPriceResponseToFlat`
 * em `useGravacaoPriceV2.ts`. Adicionalmente:
 *  - Suporta um terceiro formato hipotético (`v7-new`) com nomes de colunas
 *    em inglês, para podermos absorver a migração do back sem caçar
 *    consumidores manualmente.
 *  - Mantém um contador in-memory por versão detectada, exposto no `window`
 *    em ambiente browser (`window.__personalizationSchemaStats`) para
 *    sabermos quando podemos remover tradutores antigos.
 */

export type PriceSchemaVersion = 'v5.9-nested' | 'v6.x-flat' | 'v7-new' | 'unknown';

export type SchemaStats = Record<PriceSchemaVersion, number>;

export interface ContractMismatchEntry {
  contract: string;
  missing: string[];
  extras: string[];
  at: number;
}

export interface FullSchemaStats extends SchemaStats {
  /** Contador por nome de coluna PT legado detectado em payloads brutos. */
  legacyFieldsSeen: Record<string, number>;
  /** Contagem de mismatches por contrato. */
  contractMismatches: Record<string, number>;
  /** Buffer circular dos últimos 20 desvios detectados. */
  recentMismatches: ContractMismatchEntry[];
}

const stats: SchemaStats = {
  'v5.9-nested': 0,
  'v6.x-flat': 0,
  'v7-new': 0,
  unknown: 0,
};

const legacyFieldsSeen: Record<string, number> = {};
const contractMismatches: Record<string, number> = {};
const recentMismatches: ContractMismatchEntry[] = [];
const MAX_RECENT = 20;

// Aviso "unknown" deduplicado por sessão para não poluir o console.
const warnedKeys = new Set<string>();

function publishStats() {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (
      window as unknown as { __personalizationSchemaStats?: FullSchemaStats }
    ).__personalizationSchemaStats = {
      ...stats,
      legacyFieldsSeen: { ...legacyFieldsSeen },
      contractMismatches: { ...contractMismatches },
      recentMismatches: [...recentMismatches],
    };
  }
}

function bumpStat(version: PriceSchemaVersion) {
  stats[version] += 1;
  publishStats();
}

export function recordLegacyField(name: string): void {
  legacyFieldsSeen[name] = (legacyFieldsSeen[name] ?? 0) + 1;
  publishStats();
}

export function getLegacyFieldsSeen(): Readonly<Record<string, number>> {
  return { ...legacyFieldsSeen };
}

/**
 * Registra desvio entre payload e contrato esperado.
 */
export function recordContractMismatch(
  contract: string,
  missing: string[],
  extras: string[],
): void {
  contractMismatches[contract] = (contractMismatches[contract] ?? 0) + 1;
  recentMismatches.push({ contract, missing, extras, at: Date.now() });
  if (recentMismatches.length > MAX_RECENT) recentMismatches.shift();
  publishStats();
}

export function getContractMismatches(): Readonly<Record<string, number>> {
  return { ...contractMismatches };
}

export function getRecentMismatches(): readonly ContractMismatchEntry[] {
  return [...recentMismatches];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Detecta a versão do payload retornado por `fn_get_customization_price`.
 */
export function detectPriceSchema(
  resp: Record<string, unknown> | null | undefined,
): PriceSchemaVersion {
  if (!resp || !isObject(resp)) {
    bumpStat('unknown');
    return 'unknown';
  }

  // v5.9-nested: campo `area` é um objeto com `id`
  if (isObject(resp.area) && 'id' in resp.area) {
    bumpStat('v5.9-nested');
    return 'v5.9-nested';
  }

  // v6.x-flat: campos em PT direto na raiz
  if ('preco_unitario' in resp || 'valor_gravacao' in resp || 'total_cobrado' in resp) {
    bumpStat('v6.x-flat');
    return 'v6.x-flat';
  }

  // v7-new (hipotético): nomes em inglês na raiz
  if ('unit_price' in resp && ('subtotal_pieces' in resp || 'total_charged' in resp)) {
    bumpStat('v7-new');
    return 'v7-new';
  }

  bumpStat('unknown');
  return 'unknown';
}

/**
 * Aviso deduplicado por chave (1x por sessão por chave).
 */
export function warnUnknownSchemaOnce(key: string, payload?: unknown): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);

  logger.warn(
    `[personalization/adapters] Payload com schema desconhecido (${key}). ` +
      'Verifique se o backend mudou a estrutura — adapter está caindo no fallback v6.x-flat.',
    payload,
  );
}

/**
 * Snapshot dos contadores (útil para testes).
 */
export function getSchemaStats(): Readonly<SchemaStats> {
  return { ...stats };
}

/**
 * Reset dos contadores (testes).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function __resetSchemaStatsForTests(): void {
  stats['v5.9-nested'] = 0;
  stats['v6.x-flat'] = 0;
  stats['v7-new'] = 0;
  stats.unknown = 0;
  for (const k of Object.keys(legacyFieldsSeen)) delete legacyFieldsSeen[k];
  for (const k of Object.keys(contractMismatches)) delete contractMismatches[k];
  recentMismatches.length = 0;
  warnedKeys.clear();
}
