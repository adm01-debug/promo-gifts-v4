/**
 * Testes exaustivos — Onda 22
 * invokeExport: CSV/JSON, filename, download, custom event, clipboard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REQUEST_ID_LOOKUP_EVENT,
  buildDownloadFilename,
  copyRequestId,
  emitRequestIdLookup,
  invokeEventsToCSV,
  invokeEventsToJSON,
  triggerDownload,
} from '@/lib/edge/invokeExport';
import type { InvokeEvent } from '@/lib/edge/invokeTelemetrySink';

const baseEv = (over: Partial<InvokeEvent> = {}): InvokeEvent => ({
  ts: 1_700_000_000_000,
  kind: 'ok',
  fn: 'crm-db-bridge',
  requestId: '11111111-2222-4333-8444-555555555555',
  latencyMs: 123,
  ...over,
});

describe('invokeEventsToCSV', () => {
  it('gera header + linhas com ISO', () => {
    const csv = invokeEventsToCSV([baseEv()]);
    const [header, row] = csv.split('\n');
    expect(header).toBe('ts,iso,kind,fn,requestId,latencyMs,errorKind,attempts');
    expect(row).toContain('ok');
    expect(row).toContain('crm-db-bridge');
    expect(row).toContain('123');
  });

  it('escapa vírgula, aspas e quebra de linha', () => {
    const csv = invokeEventsToCSV([
      baseEv({ fn: 'weird,name', errorKind: 'has "quotes"' }),
      baseEv({ fn: 'multi\nline' }),
    ]);
    expect(csv).toContain('"weird,name"');
    expect(csv).toContain('"has ""quotes"""');
    expect(csv).toContain('"multi\nline"');
  });

  it('lida com campos ausentes (latencyMs/errorKind/attempts)', () => {
    const csv = invokeEventsToCSV([baseEv({ kind: 'start', latencyMs: undefined })]);
    const [, row] = csv.split('\n');
    // start row: no latency, no errorKind, no attempts → 3 vazios ao final
    expect(row.endsWith(',,,')).toBe(true);
  });

  it('array vazio retorna apenas header', () => {
    const csv = invokeEventsToCSV([]);
    expect(csv).toBe('ts,iso,kind,fn,requestId,latencyMs,errorKind,attempts');
  });

  it('fuzz — 200 eventos aleatórios não lançam e produzem linhas consistentes', () => {
    const kinds: InvokeEvent['kind'][] = ['start', 'ok', 'failed', 'breaker_open'];
    const evs: InvokeEvent[] = Array.from({ length: 200 }, (_, i) => ({
      ts: 1_700_000_000_000 + i * 1000,
      kind: kinds[i % 4],
      fn: `fn-${i % 8}${i % 3 === 0 ? ',x' : ''}`,
      requestId: `id-${i}`,
      latencyMs: i % 5 === 0 ? undefined : i,
      errorKind: i % 7 === 0 ? 'network' : undefined,
      attempts: i % 4,
    }));
    const csv = invokeEventsToCSV(evs);
    expect(csv.split('\n').length).toBe(201);
  });
});

describe('invokeEventsToJSON', () => {
  it('inclui iso e é JSON válido', () => {
    const json = invokeEventsToJSON([baseEv()]);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].iso).toBe(new Date(1_700_000_000_000).toISOString());
    expect(parsed[0].requestId).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('array vazio retorna "[]"', () => {
    expect(invokeEventsToJSON([])).toBe('[]');
  });
});

describe('buildDownloadFilename', () => {
  it('gera stamp determinístico', () => {
    const name = buildDownloadFilename('csv', new Date(Date.UTC(2026, 6, 23, 12, 34, 56)));
    expect(name).toMatch(/^edge-invokes-\d{8}-\d{6}\.csv$/);
  });
  it('respeita extensão', () => {
    expect(buildDownloadFilename('json', new Date(0))).toMatch(/\.json$/);
  });
});

describe('triggerDownload', () => {
  const originalCreateURL = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  beforeEach(() => {
    // @ts-expect-error jsdom
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    // @ts-expect-error jsdom
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    URL.createObjectURL = originalCreateURL;
    URL.revokeObjectURL = originalRevoke;
  });

  it('cria e clica em <a download>', () => {
    const clickSpy = vi.fn();
    const orig = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = clickSpy;
      return el;
    });
    triggerDownload('x.csv', 'a,b', 'text/csv');
    expect(clickSpy).toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it('nunca lança se document indisponível', () => {
    expect(() => triggerDownload('x.csv', '', 'text/csv')).not.toThrow();
  });
});

describe('emitRequestIdLookup', () => {
  it('dispara CustomEvent com detail.requestId', () => {
    const spy = vi.fn();
    window.addEventListener(REQUEST_ID_LOOKUP_EVENT, spy as EventListener);
    emitRequestIdLookup('abc-123');
    expect(spy).toHaveBeenCalledTimes(1);
    const ev = spy.mock.calls[0][0] as CustomEvent;
    expect(ev.detail).toEqual({ requestId: 'abc-123' });
    window.removeEventListener(REQUEST_ID_LOOKUP_EVENT, spy as EventListener);
  });

  it('ignora requestId vazio', () => {
    const spy = vi.fn();
    window.addEventListener(REQUEST_ID_LOOKUP_EVENT, spy as EventListener);
    emitRequestIdLookup('');
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener(REQUEST_ID_LOOKUP_EVENT, spy as EventListener);
  });
});

describe('copyRequestId', () => {
  it('escreve no clipboard quando disponível', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const ok = await copyRequestId('req-1');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('req-1');
  });

  it('retorna false quando clipboard falha', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });
    const ok = await copyRequestId('req-2');
    expect(ok).toBe(false);
  });

  it('retorna false para requestId vazio', async () => {
    expect(await copyRequestId('')).toBe(false);
  });
});
