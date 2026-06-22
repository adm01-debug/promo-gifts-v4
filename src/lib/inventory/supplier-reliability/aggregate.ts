/**
 * Agregação por fornecedor: combina extract → match → score em uma única função
 * pura. Resultado pronto para a UI.
 */

import type {
  ActualArrival,
  MatchingResult,
  PromisedReplenishment,
  ReliabilityConfig,
  SupplierReliability,
} from './types';
import { matchReplenishments } from './matching';
import { bandFromScore, computeWindow, filterMatchesByWindow } from './score';

export interface SupplierMeta {
  id: string;
  name: string;
}

export interface AggregateInput {
  promises: readonly PromisedReplenishment[];
  arrivals: readonly ActualArrival[];
  suppliers: readonly SupplierMeta[];
  config?: Partial<ReliabilityConfig>;
  /** Para testes determinísticos. Default: new Date(). */
  now?: Date;
}

export interface AggregateResult {
  bySupplier: SupplierReliability[];
  matching: MatchingResult;
}

export function aggregateReliability(input: AggregateInput): AggregateResult {
  const { promises, arrivals, suppliers, config, now = new Date() } = input;
  const matching = matchReplenishments(promises, arrivals, config);

  // Index por supplier
  const promiseBySupplier = new Map<string, PromisedReplenishment[]>();
  for (const p of promises) {
    const arr = promiseBySupplier.get(p.supplierId) ?? [];
    arr.push(p);
    promiseBySupplier.set(p.supplierId, arr);
  }
  const arrivalBySupplier = new Map<string, ActualArrival[]>();
  for (const a of arrivals) {
    const arr = arrivalBySupplier.get(a.supplierId) ?? [];
    arr.push(a);
    arrivalBySupplier.set(a.supplierId, arr);
  }
  const matchesBySupplier = new Map<string, typeof matching.matches>();
  for (const m of matching.matches) {
    const arr = matchesBySupplier.get(m.promise.supplierId) ?? [];
    arr.push(m);
    matchesBySupplier.set(m.promise.supplierId, arr);
  }
  const orphansBySupplier = new Map<string, number>();
  for (const o of matching.orphanArrivals) {
    orphansBySupplier.set(
      o.arrival.supplierId,
      (orphansBySupplier.get(o.arrival.supplierId) ?? 0) + 1,
    );
  }
  const expiredBySupplier = new Map<string, number>();
  for (const u of matching.unmatchedPromises) {
    if (u.reason !== 'expired') continue;
    expiredBySupplier.set(
      u.promise.supplierId,
      (expiredBySupplier.get(u.promise.supplierId) ?? 0) + 1,
    );
  }

  const todayIso = now.toISOString().slice(0, 10);
  const supplierIds = new Set<string>();
  for (const s of suppliers) supplierIds.add(s.id);
  for (const id of promiseBySupplier.keys()) supplierIds.add(id);
  for (const id of arrivalBySupplier.keys()) supplierIds.add(id);

  const nameById = new Map(suppliers.map((s) => [s.id, s.name]));

  const bySupplier: SupplierReliability[] = [];
  for (const supplierId of supplierIds) {
    const supplierPromises = promiseBySupplier.get(supplierId) ?? [];
    const supplierArrivals = arrivalBySupplier.get(supplierId) ?? [];
    const supplierMatches = matchesBySupplier.get(supplierId) ?? [];

    // Próxima promessa: menor promisedDate ≥ today, ainda não consumida
    const consumed = new Set(supplierMatches.map((m) => m.promise.id));
    const future = supplierPromises
      .filter((p) => !consumed.has(p.id) && p.promisedDate >= todayIso)
      .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
    const nextPromise = future[0] ?? null;

    const overall = computeWindow(supplierMatches, config);
    const last30d = computeWindow(filterMatchesByWindow(supplierMatches, 30, now), config);
    const last90d = computeWindow(filterMatchesByWindow(supplierMatches, 90, now), config);

    bySupplier.push({
      supplierId,
      supplierName: nameById.get(supplierId) ?? '(sem nome)',
      totalPromises: supplierPromises.length,
      totalArrivals: supplierArrivals.length,
      matchedCount: supplierMatches.length,
      orphanArrivalsCount: orphansBySupplier.get(supplierId) ?? 0,
      expiredPromisesCount: expiredBySupplier.get(supplierId) ?? 0,
      nextPromise,
      overall,
      last30d,
      last90d,
      band: bandFromScore(overall.score, config),
    });
  }

  // Ordena por score desc (unknown vai pro fim) → fornecedores mais confiáveis no topo
  bySupplier.sort((a, b) => {
    const sa = a.overall.score ?? -1;
    const sb = b.overall.score ?? -1;
    if (sb !== sa) return sb - sa;
    return a.supplierName.localeCompare(b.supplierName, 'pt-BR');
  });

  return { bySupplier, matching };
}
