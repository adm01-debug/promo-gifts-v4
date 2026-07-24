/**
 * Fuzz tests (property-based, fast-check) — telemetria de restore.
 *
 * Objetivos:
 *   1) `normalizeCorrelationId` — para QUALQUER entrada, o retorno é sempre
 *      string não-vazia. Para entradas inválidas, o retorno bate UUID v4.
 *   2) `validateRestoreEvent` — nunca lança; violations sempre têm shape
 *      estável (`{ field, reason, got }`); `duration_ms` e `correlation_id`
 *      no OUTPUT (quando presentes em campo obrigatório) só passam quando
 *      tipos/limites forem respeitados.
 *   3) `createRestoreLogger.emit` — para qualquer payload, o evento emitido
 *      no logger nunca tem `correlation_id` undefined nem `duration_ms` com
 *      tipo errado (o helper injeta `schema_version` e reporta violation
 *      sem quebrar o fluxo).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/telemetry/structuredLogger', async () => {
  const mod = await import('@/test/mockStructuredLogger');
  return mod.structuredLoggerMockFactory();
});

import {
  isUuidV4,
  normalizeCorrelationId,
  UUID_V4_REGEX,
  isValidCorrelationId,
} from '@/lib/telemetry/correlationId';
import {
  RESTORE_EVENT_SCHEMA_VERSION,
  validateRestoreEvent,
  type RestoreEventName,
} from '@/lib/telemetry/restoreEventSchema';
import { createRestoreLogger } from '@/lib/telemetry/restoreLogger';
import {
  resetStructuredLoggerMock,
  findLoggerEventsByScope,
} from '@/test/mockStructuredLogger';

const anythingButNonEmptyString = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constantFrom('', ' ', '\t', '\n', '  \t\n  '),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.object(),
  fc.array(fc.integer()),
);

const anyValue = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.constant(undefined),
  fc.constant(null),
  fc.object(),
  fc.array(fc.anything()),
);

const eventName: fc.Arbitrary<RestoreEventName> = fc.constantFrom(
  'restore_start',
  'restore_ok',
  'restore_failed',
  'restore_skipped_empty_snapshot',
);

describe('fuzz — normalizeCorrelationId', () => {
  it('para QUALQUER entrada inválida, retorno é UUID v4 canônico', () => {
    fc.assert(
      fc.property(anythingButNonEmptyString, (input) => {
        const out = normalizeCorrelationId(input);
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(0);
        expect(UUID_V4_REGEX.test(out)).toBe(true);
        expect(isUuidV4(out)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('para QUALQUER string não-vazia após trim, retorno === entrada (verbatim)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (input) => {
          expect(normalizeCorrelationId(input)).toBe(input);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('output SEMPRE passa em isValidCorrelationId', () => {
    fc.assert(
      fc.property(anyValue, (input) => {
        expect(isValidCorrelationId(normalizeCorrelationId(input))).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe('fuzz — validateRestoreEvent', () => {
  it('nunca lança e retorna shape estável para QUALQUER payload', () => {
    fc.assert(
      fc.property(
        eventName,
        fc.dictionary(fc.string(), anyValue),
        (event, fields) => {
          const res = validateRestoreEvent(event, fields);
          expect(res).toHaveProperty('valid');
          expect(res).toHaveProperty('violations');
          expect(typeof res.valid).toBe('boolean');
          expect(Array.isArray(res.violations)).toBe(true);
          for (const v of res.violations) {
            expect(typeof v.field).toBe('string');
            expect(typeof v.reason).toBe('string');
            expect(v).toHaveProperty('got');
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('correlation_id inválido SEMPRE gera violation "correlation_id"', () => {
    fc.assert(
      fc.property(eventName, anythingButNonEmptyString, (event, badCid) => {
        const res = validateRestoreEvent(event, {
          correlation_id: badCid,
          duration_ms: 0,
          restore_result:
            event === 'restore_failed'
              ? 'failed'
              : event === 'restore_skipped_empty_snapshot'
                ? 'skipped_empty'
                : 'success',
        });
        expect(res.valid).toBe(false);
        expect(res.violations.map((v) => v.field)).toContain('correlation_id');
      }),
      { numRuns: 300 },
    );
  });

  it('duration_ms inválido em ok/failed/skipped SEMPRE gera violation', () => {
    const badDur = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.constant(Number.NaN),
      fc.constant(Number.POSITIVE_INFINITY),
      fc.constant(Number.NEGATIVE_INFINITY),
      fc.integer({ max: -1 }),
      fc.string(),
      fc.boolean(),
    );
    fc.assert(
      fc.property(
        fc.constantFrom<RestoreEventName>(
          'restore_ok',
          'restore_failed',
          'restore_skipped_empty_snapshot',
        ),
        badDur,
        (event, dur) => {
          const res = validateRestoreEvent(event, {
            correlation_id: 'valid-cid',
            duration_ms: dur,
            restore_result:
              event === 'restore_failed'
                ? 'failed'
                : event === 'restore_skipped_empty_snapshot'
                  ? 'skipped_empty'
                  : 'success',
          });
          expect(res.violations.map((v) => v.field)).toContain('duration_ms');
        },
      ),
      { numRuns: 300 },
    );
  });

  it('schema_version não-inteiro SEMPRE gera violation; ausente SEMPRE passa', () => {
    fc.assert(
      fc.property(
        eventName,
        fc.oneof(
          fc.constant(null),
          fc.constant(Number.NaN),
          fc.constant(1.5),
          fc.constant(0),
          fc.constant(-1),
          fc.string(),
          fc.boolean(),
          fc.object(),
        ),
        (event, badSv) => {
          const res = validateRestoreEvent(event, {
            correlation_id: 'valid-cid',
            duration_ms: 0,
            restore_result:
              event === 'restore_failed'
                ? 'failed'
                : event === 'restore_skipped_empty_snapshot'
                  ? 'skipped_empty'
                  : 'success',
            schema_version: badSv,
          });
          expect(res.violations.map((v) => v.field)).toContain('schema_version');
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('fuzz — createRestoreLogger.emit', () => {
  const restore = createRestoreLogger('fuzz.restore');

  beforeEach(() => resetStructuredLoggerMock());

  it('correlation_id emitido é SEMPRE string não-vazia (mesmo com input inválido)', () => {
    fc.assert(
      fc.property(anythingButNonEmptyString, (badCid) => {
        resetStructuredLoggerMock();
        restore.emit('info', 'restore_start', {
          correlation_id: restore.normalizeCorrelationId(badCid),
          items_total: 1,
        });
        const events = findLoggerEventsByScope('fuzz.restore').filter(
          (e) => e.event === 'restore_start',
        );
        expect(events).toHaveLength(1);
        const cid = events[0].fields.correlation_id;
        expect(typeof cid).toBe('string');
        expect((cid as string).trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it('duration_ms emitido é finito >=0 quando gerado por elapsedMs()', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), (ms) => {
        resetStructuredLoggerMock();
        const cid = restore.generateCorrelationId();
        restore.emit('info', 'restore_ok', {
          correlation_id: cid,
          duration_ms: ms,
          restore_result: 'success',
          items_total: 1,
          items_inserted: 1,
        });
        const ev = findLoggerEventsByScope('fuzz.restore').find(
          (e) => e.event === 'restore_ok',
        )!;
        expect(typeof ev.fields.duration_ms).toBe('number');
        expect(Number.isFinite(ev.fields.duration_ms as number)).toBe(true);
        expect(ev.fields.duration_ms as number).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('schema_version injetado é SEMPRE o canônico (RESTORE_EVENT_SCHEMA_VERSION)', () => {
    fc.assert(
      fc.property(eventName, (event) => {
        resetStructuredLoggerMock();
        const cid = restore.generateCorrelationId();
        const payload: Record<string, unknown> = {
          correlation_id: cid,
          duration_ms: 10,
          restore_result:
            event === 'restore_failed'
              ? 'failed'
              : event === 'restore_skipped_empty_snapshot'
                ? 'skipped_empty'
                : event === 'restore_start'
                  ? undefined
                  : 'success',
        };
        restore.emit(event === 'restore_failed' ? 'error' : 'info', event, payload);
        const ev = findLoggerEventsByScope('fuzz.restore').find(
          (e) => e.event === event,
        )!;
        expect(ev.fields.schema_version).toBe(RESTORE_EVENT_SCHEMA_VERSION);
      }),
      { numRuns: 100 },
    );
  });
});

describe('schema_version — compat regressiva', () => {
  const CID = '11111111-2222-4333-8444-555555555555';

  it('evento LEGADO sem schema_version continua válido (v1 → v2 sem quebrar)', () => {
    const res = validateRestoreEvent('restore_ok', {
      correlation_id: CID,
      duration_ms: 42,
      restore_result: 'success',
      // schema_version ausente — payload de versão antiga
    });
    expect(res.valid).toBe(true);
  });

  it('evento com schema_version=1 (legado explícito) passa', () => {
    const res = validateRestoreEvent('restore_failed', {
      correlation_id: CID,
      duration_ms: 100,
      restore_result: 'failed',
      schema_version: 1,
    });
    expect(res.valid).toBe(true);
  });

  it('evento com schema_version=RESTORE_EVENT_SCHEMA_VERSION (canônico) passa', () => {
    const res = validateRestoreEvent('restore_ok', {
      correlation_id: CID,
      duration_ms: 0,
      restore_result: 'success',
      schema_version: RESTORE_EVENT_SCHEMA_VERSION,
    });
    expect(res.valid).toBe(true);
  });

  it.each([1.5, 0, -1, 'v2', true, null, Number.NaN])(
    'schema_version=%s → violation',
    (sv) => {
      const res = validateRestoreEvent('restore_ok', {
        correlation_id: CID,
        duration_ms: 0,
        restore_result: 'success',
        schema_version: sv,
      });
      expect(res.valid).toBe(false);
      expect(res.violations.map((v) => v.field)).toContain('schema_version');
    },
  );

  it('helper createRestoreLogger.emit injeta schema_version quando ausente e RESPEITA override do caller', () => {
    resetStructuredLoggerMock();
    const restore = createRestoreLogger('sv.compat');
    restore.emit('info', 'restore_start', { correlation_id: CID });
    restore.emit('info', 'restore_start', {
      correlation_id: CID,
      schema_version: 1, // caller pinou versão antiga (ex.: replay)
    });
    const evs = findLoggerEventsByScope('sv.compat').filter(
      (e) => e.event === 'restore_start',
    );
    expect(evs).toHaveLength(2);
    expect(evs[0].fields.schema_version).toBe(RESTORE_EVENT_SCHEMA_VERSION);
    expect(evs[1].fields.schema_version).toBe(1);
  });
});
