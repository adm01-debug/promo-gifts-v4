import { describe, expect, it } from 'vitest';
import { matchReplenishments } from '@/lib/inventory/supplier-reliability/matching';
import type {
  ActualArrival,
  PromisedReplenishment,
} from '@/lib/inventory/supplier-reliability/types';

function P(
  id: string,
  sourceId: string,
  promisedDate: string,
  promisedQuantity: number,
  slot: 1 | 2 | 3 | 4 | 5 | 6 = 1,
): PromisedReplenishment {
  return {
    id,
    sourceId,
    supplierId: 'sup',
    variantId: 'var',
    slot,
    promisedDate,
    promisedQuantity,
    observedAt: '2026-01-01T00:00:00Z',
  };
}
function A(
  id: string,
  sourceId: string,
  receivedAt: string,
  receivedQuantity: number,
): ActualArrival {
  return { id, sourceId, supplierId: 'sup', variantId: 'var', receivedQuantity, receivedAt };
}

describe('matchReplenishments — pareamento básico', () => {
  it('pareia chegada com promessa exata no mesmo dia', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-20', 5000)],
      [A('a1', 's1', '2026-07-20T08:00:00Z', 5000)],
    );
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].delayDays).toBe(0);
    expect(r.matches[0].fulfillmentRatio).toBe(1);
    expect(r.unmatchedPromises).toHaveLength(0);
    expect(r.orphanArrivals).toHaveLength(0);
  });

  it('respeita janela de 15d (chegada 16d atrasada vira orphan + expired)', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-01', 1000)],
      [A('a1', 's1', '2026-07-17T00:00:00Z', 1000)], // 16 dias
    );
    expect(r.matches).toHaveLength(0);
    expect(r.orphanArrivals).toHaveLength(1);
  });

  it('pareia adiantamento (delay negativo)', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-20', 1000)],
      [A('a1', 's1', '2026-07-18T00:00:00Z', 1000)],
    );
    expect(r.matches[0].delayDays).toBe(-2);
  });

  it('NÃO pareia chegada com source diferente', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-20', 1000)],
      [A('a1', 's2', '2026-07-20T00:00:00Z', 1000)],
    );
    expect(r.matches).toHaveLength(0);
    expect(r.orphanArrivals).toHaveLength(1);
    expect(r.unmatchedPromises).toHaveLength(1);
  });
});

describe('matchReplenishments — múltiplas promessas competindo', () => {
  it('chegada escolhe promessa mais próxima', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-10', 500), P('p2', 's1', '2026-07-22', 500)],
      [A('a1', 's1', '2026-07-20T00:00:00Z', 500)], // mais perto de p2 (2d) que p1 (10d)
    );
    expect(r.matches[0].promise.id).toBe('p2');
    expect(r.unmatchedPromises.map((u) => u.promise.id)).toContain('p1');
  });

  it('empate em distância vai para menor diferença de quantidade', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-20', 1000), P('p2', 's1', '2026-07-20', 500)],
      [A('a1', 's1', '2026-07-20T00:00:00Z', 480)],
    );
    expect(r.matches[0].promise.id).toBe('p2');
  });

  it('chegadas mais antigas consomem promessas primeiro (FIFO)', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-20', 100), P('p2', 's1', '2026-08-01', 100)],
      [
        A('a2', 's1', '2026-08-02T00:00:00Z', 100),
        A('a1', 's1', '2026-07-19T00:00:00Z', 100),
      ],
    );
    // ordenação interna por receivedAt asc: a1 consome p1, a2 consome p2
    expect(r.matches.find((m) => m.arrival.id === 'a1')?.promise.id).toBe('p1');
    expect(r.matches.find((m) => m.arrival.id === 'a2')?.promise.id).toBe('p2');
  });
});

describe('matchReplenishments — chegada parcial e excesso', () => {
  it('chegada parcial: fulfillmentRatio < 1', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-20', 1000)],
      [A('a1', 's1', '2026-07-20T00:00:00Z', 400)],
    );
    expect(r.matches[0].fulfillmentRatio).toBeCloseTo(0.4);
  });

  it('chegada com excesso: fulfillmentRatio capado em 1', () => {
    const r = matchReplenishments(
      [P('p1', 's1', '2026-07-20', 1000)],
      [A('a1', 's1', '2026-07-20T00:00:00Z', 3000)],
    );
    expect(r.matches[0].fulfillmentRatio).toBe(1);
  });
});

describe('matchReplenishments — promessas pending vs expired', () => {
  it('promessa futura sem chegada vira pending', () => {
    const future = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    const r = matchReplenishments([P('p1', 's1', future, 100)], []);
    expect(r.unmatchedPromises[0].reason).toBe('pending');
  });

  it('promessa passada (>window) sem chegada vira expired', () => {
    const past = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const r = matchReplenishments([P('p1', 's1', past, 100)], []);
    expect(r.unmatchedPromises[0].reason).toBe('expired');
  });
});

describe('matchReplenishments — determinismo', () => {
  it('produz mesmo resultado independente da ordem de input', () => {
    const ps = [
      P('p1', 's1', '2026-07-20', 100),
      P('p2', 's1', '2026-07-21', 200),
      P('p3', 's1', '2026-07-22', 300),
    ];
    const as = [
      A('a1', 's1', '2026-07-21T00:00:00Z', 100),
      A('a2', 's1', '2026-07-22T00:00:00Z', 200),
      A('a3', 's1', '2026-07-23T00:00:00Z', 300),
    ];
    const r1 = matchReplenishments(ps, as);
    const r2 = matchReplenishments([...ps].reverse(), [...as].reverse());
    expect(r1.matches.map((m) => [m.arrival.id, m.promise.id])).toEqual(
      r2.matches.map((m) => [m.arrival.id, m.promise.id]),
    );
  });
});
