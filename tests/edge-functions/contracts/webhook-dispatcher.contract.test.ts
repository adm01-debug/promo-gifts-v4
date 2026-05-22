/**
 * Contract tests — webhook-dispatcher (v1 + v2).
 *
 * Cobre:
 *   - v1: schema atual { event, payload, replay_delivery_id, test_mode, test_webhook_id }
 *   - v2: priority, dedupe_window_ms, event_id, mutual-exclusion estrita
 *   - Casos negativos: event vazio, UUIDs inválidos, combinações ilegais
 *   - Default values aplicados (priority="normal")
 */

import { describe, expect, it } from 'vitest';
import {
  WebhookDispatcherV1Schema,
  WebhookDispatcherV2Schema,
  WebhookDispatcherSchemaByVersion,
  WebhookDispatcherVersions,
} from '../../../supabase/functions/_shared/contracts/webhook-dispatcher';

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';

// ===========================================================================
// v1
// ===========================================================================

describe('webhook-dispatcher v1 — válidos', () => {
  it('aceita event + payload mínimo', () => {
    expect(
      WebhookDispatcherV1Schema.safeParse({
        event: 'product.created',
        payload: { id: 'p1' },
      }).success,
    ).toBe(true);
  });

  it('aceita event sem payload', () => {
    expect(WebhookDispatcherV1Schema.safeParse({ event: 'ping' }).success).toBe(true);
  });

  it('aceita replay mode', () => {
    expect(
      WebhookDispatcherV1Schema.safeParse({
        event: 'replay',
        replay_delivery_id: VALID_UUID_1,
      }).success,
    ).toBe(true);
  });

  it('aceita test_mode + test_webhook_id', () => {
    expect(
      WebhookDispatcherV1Schema.safeParse({
        event: 'test',
        test_mode: true,
        test_webhook_id: VALID_UUID_2,
      }).success,
    ).toBe(true);
  });
});

describe('webhook-dispatcher v1 — inválidos', () => {
  it('rejeita event vazio', () => {
    const res = WebhookDispatcherV1Schema.safeParse({ event: '' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) => i.path[0] === 'event')).toBe(true);
  });

  it('rejeita event ausente', () => {
    expect(WebhookDispatcherV1Schema.safeParse({}).success).toBe(false);
  });

  it('rejeita replay_delivery_id que não é UUID', () => {
    const res = WebhookDispatcherV1Schema.safeParse({
      event: 'x',
      replay_delivery_id: 'not-a-uuid',
    });
    expect(res.success).toBe(false);
  });
});

// ===========================================================================
// v2
// ===========================================================================

describe('webhook-dispatcher v2 — válidos', () => {
  it('aplica default priority="normal"', () => {
    const res = WebhookDispatcherV2Schema.safeParse({ event: 'evt' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.priority).toBe('normal');
  });

  it('aceita priority="high"', () => {
    const res = WebhookDispatcherV2Schema.safeParse({
      event: 'evt',
      priority: 'high',
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.priority).toBe('high');
  });

  it('aceita dedupe_window_ms dentro do range', () => {
    expect(
      WebhookDispatcherV2Schema.safeParse({
        event: 'evt',
        dedupe_window_ms: 5000,
      }).success,
    ).toBe(true);
  });

  it('aceita event_id como UUID', () => {
    expect(
      WebhookDispatcherV2Schema.safeParse({
        event: 'evt',
        event_id: VALID_UUID_1,
      }).success,
    ).toBe(true);
  });
});

describe('webhook-dispatcher v2 — inválidos', () => {
  it('rejeita priority inválida', () => {
    const res = WebhookDispatcherV2Schema.safeParse({
      event: 'x',
      priority: 'critical',
    });
    expect(res.success).toBe(false);
  });

  it('rejeita dedupe_window_ms > 60000', () => {
    expect(
      WebhookDispatcherV2Schema.safeParse({
        event: 'x',
        dedupe_window_ms: 90000,
      }).success,
    ).toBe(false);
  });

  it('rejeita dedupe_window_ms negativo', () => {
    expect(
      WebhookDispatcherV2Schema.safeParse({ event: 'x', dedupe_window_ms: -1 }).success,
    ).toBe(false);
  });

  it('rejeita test_mode + replay_delivery_id simultaneamente', () => {
    const res = WebhookDispatcherV2Schema.safeParse({
      event: 'x',
      test_mode: true,
      test_webhook_id: VALID_UUID_1,
      replay_delivery_id: VALID_UUID_2,
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) =>
      i.message.includes('apenas um modo'),
    )).toBe(true);
  });

  it('rejeita test_mode sem test_webhook_id', () => {
    const res = WebhookDispatcherV2Schema.safeParse({
      event: 'x',
      test_mode: true,
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) =>
      i.path.join('.') === 'test_webhook_id',
    )).toBe(true);
  });
});

// ===========================================================================
// Manifesto e retrocompat
// ===========================================================================

describe('webhook-dispatcher — retrocompat', () => {
  it('manifesto inclui v1 e v2', () => {
    expect(WebhookDispatcherVersions).toEqual(['v1', 'v2']);
    expect(WebhookDispatcherSchemaByVersion.v1).toBeDefined();
    expect(WebhookDispatcherSchemaByVersion.v2).toBeDefined();
  });

  it('payloads v1 mais simples continuam aceitos em v1', () => {
    const v1Payloads = [
      { event: 'a' },
      { event: 'b', payload: { x: 1 } },
      { event: 'c', replay_delivery_id: VALID_UUID_1 },
    ];
    for (const p of v1Payloads) {
      expect(WebhookDispatcherV1Schema.safeParse(p).success).toBe(true);
    }
  });
});
