/**
 * In-memory client cache for immutable-ish reference entities
 * (categories, suppliers, material_types) during a navigation session.
 *
 * Goals:
 *  - Eliminate repeated bridge calls for the same id during a session.
 *  - Allow batch lookup: pass a list of ids → returns cached map + only
 *    fetches the missing ones in a single `id=in.(...)` request.
 *  - Cheap TTL so long-lived tabs eventually refresh.
 *
 * Not persisted to localStorage on purpose: keeps things simple and avoids
 * staleness across deploys / data fixes.
 */
import { invokeExternalDb } from './bridge';
import { logger } from '@/lib/logger';

type Entity = 'categories' | 'suppliers' | 'material_types';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes — refs change rarely
const INFLIGHT = new Map<string, Promise<unknown>>();
/**
 * Per-id in-flight tracking. Quando a chamada A pede [a,b,c] e antes dela
 * resolver chega B pedindo [b,c,d], B reaproveita as promises de b e c em
 * vez de disparar nova bridge — só `d` vai pra rede.
 */
const INFLIGHT_BY_ID: Record<
  Entity,
  Map<string, Promise<{ id: string; name: string; code?: string } | undefined>>
> = {
  categories: new Map(),
  suppliers: new Map(),
  material_types: new Map(),
};
const STORE: Record<
  Entity,
  Map<string, CacheEntry<{ id: string; name: string; code?: string }>>
> = {
  categories: new Map(),
  suppliers: new Map(),
  material_types: new Map(),
};

function now() {
  return Date.now();
}

function getFresh<T extends { id: string; name: string; code?: string }>(
  entity: Entity,
  id: string,
): T | undefined {
  const e = STORE[entity].get(id);
  if (!e) return undefined;
  if (e.expiresAt < now()) {
    STORE[entity].delete(id);
    return undefined;
  }
  return e.value as T;
}

function put(entity: Entity, rec: { id: string; name: string; code?: string }) {
  STORE[entity].set(rec.id, { value: rec, expiresAt: now() + TTL_MS });
}

const SELECT_BY_ENTITY: Record<Entity, string> = {
  categories: 'id, name',
  suppliers: 'id, name, code',
  material_types: 'id, name',
};

/**
 * Returns a Map<id, record> for the requested ids, fetching only the missing
 * ones in a single bridge call. De-duplicates concurrent requests via INFLIGHT.
 */
export async function getCachedByIds<T extends { id: string; name: string; code?: string }>(
  entity: Entity,
  ids: string[],
): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const missing: string[] = [];
  /** ids cuja resposta vamos esperar de outra chamada já em voo. */
  const awaitedFromOthers: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    const hit = getFresh<T>(entity, raw);
    if (hit) {
      out.set(raw, hit);
      continue;
    }
    if (INFLIGHT_BY_ID[entity].has(raw)) awaitedFromOthers.push(raw);
    else missing.push(raw);
  }

  // Reaproveita promises por id em voo (sem disparar rede).
  const piggybackPromises: Array<Promise<void>> = [];
  for (const id of awaitedFromOthers) {
    const p = INFLIGHT_BY_ID[entity].get(id);
    if (!p) {
      missing.push(id);
      continue;
    }
    piggybackPromises.push(
      p.then((rec) => {
        if (rec) out.set(id, rec as T);
      }),
    );
  }

  if (missing.length === 0) {
    if (piggybackPromises.length) await Promise.all(piggybackPromises);
    return out;
  }

  const key = `${entity}::${[...missing].sort().join(',')}`;
  const inflight = INFLIGHT.get(key) as Promise<T[]> | undefined;
  let records: T[];
  if (inflight) {
    records = await inflight;
  } else {
    const p = (async () => {
      const inFilter = `in.(${missing.join(',')})`;
      const res = await invokeExternalDb<T>({
        table: entity,
        operation: 'select',
        select: SELECT_BY_ENTITY[entity],
        filters: { id: inFilter },
        limit: Math.max(missing.length, 20),
      });
      return res.records;
    })()
      .catch((err) => {
        logger.warn(`[immutableCache] fetch failed for ${entity}:`, err);
        return [] as T[];
      })
      .finally(() => {
        INFLIGHT.delete(key);
      });
    INFLIGHT.set(key, p);

    // Registra resolvers individuais por id para piggyback de chamadas concorrentes.
    const resolvers = new Map<string, (rec: T | undefined) => void>();
    for (const id of missing) {
      const perId = new Promise<T | undefined>((resolve) => {
        resolvers.set(id, resolve);
      });
      INFLIGHT_BY_ID[entity].set(id, perId);
    }
    p.then((recs) => {
      const byId = new Map(recs.map((r) => [r.id, r]));
      for (const id of missing) {
        const r = byId.get(id);
        resolvers.get(id)?.(r);
        INFLIGHT_BY_ID[entity].delete(id);
      }
    });

    records = await p;
  }

  for (const rec of records) {
    if (rec?.id) {
      put(entity, rec);
      out.set(rec.id, rec);
    }
  }

  if (piggybackPromises.length) await Promise.all(piggybackPromises);
  return out;
}

/** Convenience for a single id. */
export async function getCachedById<T extends { id: string; name: string; code?: string }>(
  entity: Entity,
  id: string,
): Promise<T | undefined> {
  const map = await getCachedByIds<T>(entity, [id]);
  return map.get(id);
}

/** Manual invalidation (useful after admin edits). */
export function invalidateImmutableCache(entity?: Entity) {
  if (entity) STORE[entity].clear();
  else {
    STORE.categories.clear();
    STORE.suppliers.clear();
    STORE.material_types.clear();
  }
}

/** Synchronous cache peek (no fetch). Returns undefined if missing or stale. */
export function getFreshFromCacheSafe<T extends { id: string; name: string; code?: string }>(
  entity: Entity,
  id: string,
): T | undefined {
  return getFresh<T>(entity, id);
}

/** Synchronous cache write (used after a successful bridge fetch). */
export function putInCacheSafe(entity: Entity, rec: { id: string; name: string; code?: string }) {
  if (rec?.id && rec?.name) put(entity, rec);
}

/** Debug snapshot. */
export function immutableCacheStats() {
  return {
    categories: STORE.categories.size,
    suppliers: STORE.suppliers.size,
    material_types: STORE.material_types.size,
  };
}
