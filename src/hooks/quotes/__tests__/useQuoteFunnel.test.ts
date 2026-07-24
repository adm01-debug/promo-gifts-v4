/**
 * Testes — useQuoteFunnel
 *
 * Hook puramente funcional (useMemo) que calcula contagens por etapa
 * do funil de orçamentos: draft → sent → viewed → approved → converted.
 *
 * Invariantes:
 *   - quotes=[] → todos counts 0, avgCycleDays=null
 *   - total = quotes.length
 *   - sentTotal = sent + pending + pending_approval + approved + converted
 *   - viewedTotal = viewed qualifying + approved + converted
 *   - approvedTotal = approved + converted
 *   - rateFromPrev: % relativa à etapa anterior, null para draft
 *   - funil cumulativo (etapas incluem as posteriores)
 *   - avgCycleDays: média de dias created_at → updated_at para aprovados/convertidos
 *   - viewedMap sem entrada → viewed = 0 (exceto approved + converted)
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useQuoteFunnel } from '../useQuoteFunnel';
import type { Quote } from '@/hooks/quotes';

function q(id: string, status: string, daysAgo = 0): Quote {
  const created = new Date(Date.now() - (daysAgo + 7) * 86400000).toISOString();
  const updated = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return { id, status, created_at: created, updated_at: updated } as Quote;
}

describe('useQuoteFunnel — funil de orçamentos', () => {
  // Estado vazio
  it('quotes vazio: todos counts=0, avgCycleDays=null, total=0', () => {
    const { result } = renderHook(() => useQuoteFunnel([], {}));
    const { stages, avgCycleDays, total } = result.current;
    expect(total).toBe(0);
    expect(avgCycleDays).toBeNull();
    expect(stages).not.toHaveLength(0);
    for (const s of stages) expect(s.count).toBe(0);
  });

  it('draft rateFromPrev = null (primeira etapa)', () => {
    const { result } = renderHook(() => useQuoteFunnel([q('1', 'draft')], {}));
    const draft = result.current.stages.find((s) => s.id === 'draft');
    expect(draft?.rateFromPrev).toBeNull();
  });

  // Total
  it('total = quotes.length (inclui todos os status)', () => {
    const quotes = [q('1', 'draft'), q('2', 'sent'), q('3', 'converted')];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    expect(result.current.total).toBe(3);
  });

  // Funil cumulativo
  it('sentTotal inclui sent + pending + approved + converted', () => {
    const quotes = [
      q('1', 'draft'),
      q('2', 'sent'),
      q('3', 'pending'),
      q('4', 'approved'),
      q('5', 'converted'),
    ];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    const sent = result.current.stages.find((s) => s.id === 'sent');
    // sent(1) + pending(1) + approved(1) + converted(1) = 4
    expect(sent?.count).toBe(4);
  });

  it('approvedTotal = approved + converted', () => {
    const quotes = [q('1', 'draft'), q('2', 'approved'), q('3', 'converted')];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    const approved = result.current.stages.find((s) => s.id === 'approved');
    expect(approved?.count).toBe(2); // approved(1) + converted(1)
  });

  it('converted count = somente converted', () => {
    const quotes = [q('1', 'approved'), q('2', 'converted'), q('3', 'converted')];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    const conv = result.current.stages.find((s) => s.id === 'converted');
    expect(conv?.count).toBe(2);
  });

  // viewedMap
  it('viewedTotal soma qualifying (com viewedMap) + approved + converted', () => {
    const quotes = [
      q('1', 'sent'), // qualifying se em viewedMap
      q('2', 'pending'), // qualifying se em viewedMap
      q('3', 'approved'), // sempre conta no viewedTotal
    ];
    const viewedMap = { '1': { viewedAt: '2026-01-01' } }; // q1 viewed
    const { result } = renderHook(() => useQuoteFunnel(quotes, viewedMap));
    const viewed = result.current.stages.find((s) => s.id === 'viewed');
    // q1(viewed via map) + q3(approved, sempre) = 2
    expect(viewed?.count).toBe(2);
  });

  it('viewed = 0 quando viewedMap vazio e nao ha approved/converted', () => {
    const quotes = [q('1', 'sent'), q('2', 'draft')];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    const viewed = result.current.stages.find((s) => s.id === 'viewed');
    expect(viewed?.count).toBe(0);
  });

  // rateFromPrev
  it('rateFromPrev de sent = (sentTotal / total) * 100', () => {
    // 2 de 4 quotes sao sent
    const quotes = [q('1', 'draft'), q('2', 'draft'), q('3', 'sent'), q('4', 'sent')];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    const sent = result.current.stages.find((s) => s.id === 'sent');
    expect(sent?.rateFromPrev).toBeCloseTo(50, 1); // 2/4 = 50%
  });

  it('rateFromPrev = 0 quando etapa anterior tem 0 items', () => {
    // Nenhum quote enviado, calcular viewed
    const quotes = [q('1', 'draft')];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    const viewed = result.current.stages.find((s) => s.id === 'viewed');
    expect(viewed?.rateFromPrev).toBe(0); // sentTotal=0
  });

  // avgCycleDays
  it('avgCycleDays: media de dias entre created_at e updated_at para aprovados', () => {
    // q1: 7 dias de ciclo (criado 14 dias atrás, updated 7 dias atrás)
    // q2: 3 dias de ciclo (criado 10 dias atrás, updated 7 dias atrás)
    const q1 = q('1', 'approved', 7); // daysAgo=7 → 7 dias de ciclo
    const q2 = q('2', 'converted', 7); // mesmo ciclo = 7 dias
    const { result } = renderHook(() => useQuoteFunnel([q1, q2], {}));
    // Ambos têm 7 dias de ciclo (created_at = 14 dias atrás, updated_at = 7 dias atrás)
    expect(result.current.avgCycleDays).toBeCloseTo(7, 0);
  });

  it('avgCycleDays = null quando nao ha quotes aprovadas/convertidas', () => {
    const quotes = [q('1', 'draft'), q('2', 'sent')];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    expect(result.current.avgCycleDays).toBeNull();
  });

  // 5 etapas corretas
  it('retorna exatamente 5 etapas na ordem correta', () => {
    const { result } = renderHook(() => useQuoteFunnel([], {}));
    const ids = result.current.stages.map((s) => s.id);
    expect(ids).toEqual(['draft', 'sent', 'viewed', 'approved', 'converted']);
  });
});
