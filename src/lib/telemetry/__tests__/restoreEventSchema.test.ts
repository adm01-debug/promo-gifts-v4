/**
 * Testes unitários — `restoreEventSchema` validator.
 *
 * Cobertura:
 *   - Eventos válidos passam sem violation.
 *   - `correlation_id` obrigatório e string não-vazia em TODOS os eventos.
 *   - `duration_ms` obrigatório e finito >= 0 em ok/failed/skipped.
 *   - `duration_ms` opcional em `restore_start`, mas validado quando presente.
 *   - `restore_result` obrigatório com enum específico por evento.
 *   - Validador é PURO — nunca lança.
 */
import { describe, expect, it } from 'vitest';
import { validateRestoreEvent } from '@/lib/telemetry/restoreEventSchema';

const CID = '11111111-2222-4333-8444-555555555555';

describe('restoreEventSchema — payloads válidos', () => {
  it('restore_start válido', () => {
    expect(
      validateRestoreEvent('restore_start', { correlation_id: CID }),
    ).toEqual({ valid: true, violations: [] });
  });
  it('restore_ok válido (success)', () => {
    expect(
      validateRestoreEvent('restore_ok', {
        correlation_id: CID,
        duration_ms: 123,
        restore_result: 'success',
      }),
    ).toEqual({ valid: true, violations: [] });
  });
  it.each(['success', 'partial', 'deduped', 'ok_no_metrics'])(
    'restore_ok aceita restore_result=%s',
    (r) => {
      const res = validateRestoreEvent('restore_ok', {
        correlation_id: CID,
        duration_ms: 0,
        restore_result: r,
      });
      expect(res.valid).toBe(true);
    },
  );
  it('restore_failed válido', () => {
    expect(
      validateRestoreEvent('restore_failed', {
        correlation_id: CID,
        duration_ms: 500,
        restore_result: 'failed',
      }).valid,
    ).toBe(true);
  });
  it('restore_skipped_empty_snapshot válido', () => {
    expect(
      validateRestoreEvent('restore_skipped_empty_snapshot', {
        correlation_id: CID,
        duration_ms: 0,
        restore_result: 'skipped_empty',
      }).valid,
    ).toBe(true);
  });
});

describe('restoreEventSchema — correlation_id', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string vazia', ''],
    ['só whitespace', '   '],
    ['number', 42],
    ['objeto', { x: 1 }],
  ])('flag violation quando correlation_id=%s', (_label, cid) => {
    const res = validateRestoreEvent('restore_start', { correlation_id: cid });
    expect(res.valid).toBe(false);
    expect(res.violations.map((v) => v.field)).toContain('correlation_id');
  });
});

describe('restoreEventSchema — duration_ms', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negativo', -1],
    ['string', '100'],
  ])('restore_ok flag violation quando duration_ms=%s', (_label, dur) => {
    const res = validateRestoreEvent('restore_ok', {
      correlation_id: CID,
      duration_ms: dur,
      restore_result: 'success',
    });
    expect(res.valid).toBe(false);
    expect(res.violations.map((v) => v.field)).toContain('duration_ms');
  });

  it('restore_start SEM duration_ms é válido', () => {
    expect(
      validateRestoreEvent('restore_start', { correlation_id: CID }).valid,
    ).toBe(true);
  });

  it('restore_start COM duration_ms inválido é flagged', () => {
    const res = validateRestoreEvent('restore_start', {
      correlation_id: CID,
      duration_ms: -5,
    });
    expect(res.valid).toBe(false);
    expect(res.violations.map((v) => v.field)).toContain('duration_ms');
  });
});

describe('restoreEventSchema — restore_result (enum por evento)', () => {
  it('restore_ok rejeita "failed"', () => {
    const res = validateRestoreEvent('restore_ok', {
      correlation_id: CID,
      duration_ms: 0,
      restore_result: 'failed',
    });
    expect(res.valid).toBe(false);
  });
  it('restore_failed rejeita "success"', () => {
    const res = validateRestoreEvent('restore_failed', {
      correlation_id: CID,
      duration_ms: 0,
      restore_result: 'success',
    });
    expect(res.valid).toBe(false);
  });
  it('restore_skipped_empty_snapshot rejeita "success"', () => {
    const res = validateRestoreEvent('restore_skipped_empty_snapshot', {
      correlation_id: CID,
      duration_ms: 0,
      restore_result: 'success',
    });
    expect(res.valid).toBe(false);
  });
  it.each([undefined, null, 42, {}])(
    'restore_ok rejeita restore_result=%s',
    (r) => {
      const res = validateRestoreEvent('restore_ok', {
        correlation_id: CID,
        duration_ms: 0,
        restore_result: r,
      });
      expect(res.valid).toBe(false);
    },
  );
});

describe('restoreEventSchema — pureza', () => {
  it('nunca lança mesmo com payload adversário', () => {
    expect(() =>
      validateRestoreEvent('restore_ok', {
        correlation_id: Symbol('x') as unknown as string,
        duration_ms: {} as unknown as number,
        restore_result: [] as unknown as string,
      }),
    ).not.toThrow();
  });

  it('múltiplas violations coexistem no resultado', () => {
    const res = validateRestoreEvent('restore_ok', {
      correlation_id: '',
      duration_ms: -1,
      restore_result: 'nope',
    });
    expect(res.valid).toBe(false);
    expect(res.violations.length).toBeGreaterThanOrEqual(3);
  });
});
