/**
 * Contract tests — product-webhook (v1 + v2).
 *
 * Cobre:
 *   - Payload v1 válido (action=upsert, action=sync, action=delete, action=batch_upsert)
 *   - Payload v2 válido (idempotency_key obrigatório, correlation_id opcional)
 *   - Casos negativos: campo ausente, tipo errado, valor vazio, enum inválido
 *   - Mutual-exclusion v2: product XOR products XOR external_ids
 *   - Compatibilidade retroativa: v1 não regrediu (mesmo conjunto de actions)
 *   - Forward compat: campos extras em v1 são preservados (passthrough)
 */

import { describe, expect, it } from 'vitest';
import {
  ProductWebhookV1Schema,
  ProductWebhookV2Schema,
  ProductWebhookSchemaByVersion,
  ProductWebhookVersions,
} from '../../../supabase/functions/_shared/contracts/product-webhook';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validProduct = {
  sku: 'PG-001',
  name: 'Caneca Térmica',
  price: 49.9,
};

const validProductRich = {
  sku: 'PG-002',
  name: 'Mochila',
  description: 'Mochila técnica 30L',
  price: 199.9,
  min_quantity: 10,
  category_id: 12,
  category_name: 'Bolsas',
  stock: 500,
  is_active: true,
  images: ['https://cdn.example.com/mochila-1.jpg'],
  colors: [{ name: 'Preto', hex: '#000000', group: 'neutro' }],
  materials: ['Poliéster'],
  tags: { tecnico: ['outdoor', 'esportivo'] },
};

// ===========================================================================
// v1
// ===========================================================================

describe('product-webhook v1 — válidos', () => {
  it('aceita action=upsert + product', () => {
    const res = ProductWebhookV1Schema.safeParse({ action: 'upsert', product: validProduct });
    expect(res.success).toBe(true);
  });

  it('aceita action=batch_upsert + products[]', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'batch_upsert',
      products: [validProduct, validProductRich],
    });
    expect(res.success).toBe(true);
  });

  it('aceita action=delete + external_ids', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'delete',
      external_ids: ['ext-1', 'ext-2'],
    });
    expect(res.success).toBe(true);
  });

  it('aceita action=sync (legado)', () => {
    const res = ProductWebhookV1Schema.safeParse({ action: 'sync' });
    expect(res.success).toBe(true);
  });

  it('aceita produto com payload rico (todos campos opcionais)', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'upsert',
      product: validProductRich,
    });
    expect(res.success).toBe(true);
  });
});

describe('product-webhook v1 — inválidos', () => {
  it('rejeita body vazio (action faltando)', () => {
    const res = ProductWebhookV1Schema.safeParse({});
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) => i.path[0] === 'action')).toBe(true);
  });

  it('rejeita enum inválido em action', () => {
    const res = ProductWebhookV1Schema.safeParse({ action: 'invalid-action' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues[0].code).toBe('invalid_enum_value');
  });

  it('rejeita price como string', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'upsert',
      product: { ...validProduct, price: '49.9' },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const issue = res.error.issues.find((i) => i.path.join('.') === 'product.price');
    expect(issue?.code).toBe('invalid_type');
  });

  it('rejeita sku vazio', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'upsert',
      product: { ...validProduct, sku: '' },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) => i.path.join('.') === 'product.sku')).toBe(true);
  });

  it('rejeita price negativo', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'upsert',
      product: { ...validProduct, price: -1 },
    });
    expect(res.success).toBe(false);
  });

  it('rejeita images com URL inválida', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'upsert',
      product: { ...validProduct, images: ['not-a-url'] },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const issue = res.error.issues.find((i) =>
      i.path.join('.').startsWith('product.images.'),
    );
    expect(issue).toBeDefined();
  });

  it('rejeita array de products acima do limite (500)', () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => ({
      ...validProduct,
      sku: `SKU-${i}`,
    }));
    const res = ProductWebhookV1Schema.safeParse({
      action: 'batch_upsert',
      products: tooMany,
    });
    expect(res.success).toBe(false);
  });
});

// ===========================================================================
// v2
// ===========================================================================

describe('product-webhook v2 — válidos', () => {
  it('aceita upsert + idempotency_key + product', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'upsert',
      idempotency_key: 'idemp-abc-12345',
      product: validProduct,
    });
    expect(res.success).toBe(true);
  });

  it('aceita upsert + idempotency_key + products[]', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'upsert',
      idempotency_key: 'idemp-abc-12345',
      products: [validProduct, validProductRich],
    });
    expect(res.success).toBe(true);
  });

  it('aceita delete + external_ids', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'delete',
      idempotency_key: 'idemp-del-12345',
      external_ids: ['ext-1'],
    });
    expect(res.success).toBe(true);
  });

  it('aceita correlation_id opcional', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'upsert',
      idempotency_key: 'idemp-corr-12345',
      correlation_id: 'trace-id-987',
      product: validProduct,
    });
    expect(res.success).toBe(true);
  });
});

describe('product-webhook v2 — inválidos', () => {
  it('rejeita falta de idempotency_key', () => {
    const res = ProductWebhookV2Schema.safeParse({ action: 'upsert', product: validProduct });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) => i.path[0] === 'idempotency_key')).toBe(true);
  });

  it('rejeita idempotency_key muito curto (<8 chars)', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'upsert',
      idempotency_key: 'short',
      product: validProduct,
    });
    expect(res.success).toBe(false);
  });

  it('rejeita action=sync (foi removida em v2)', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'sync',
      idempotency_key: 'idemp-12345678',
    });
    expect(res.success).toBe(false);
  });

  it('rejeita action=batch_upsert (foi removida em v2; usar products[])', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'batch_upsert',
      idempotency_key: 'idemp-12345678',
      products: [validProduct],
    });
    expect(res.success).toBe(false);
  });

  it('rejeita product E products simultâneos (mutual exclusion)', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'upsert',
      idempotency_key: 'idemp-mutex-12345',
      product: validProduct,
      products: [validProductRich],
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) =>
      i.message.includes('exatamente um'),
    )).toBe(true);
  });

  it('rejeita upsert + external_ids (external_ids é só para delete)', () => {
    const res = ProductWebhookV2Schema.safeParse({
      action: 'upsert',
      idempotency_key: 'idemp-12345678',
      external_ids: ['e1'],
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) =>
      i.message.includes('action=delete'),
    )).toBe(true);
  });
});

// ===========================================================================
// Retrocompatibilidade
// ===========================================================================

describe('product-webhook — retrocompat', () => {
  it('manifesto de versões expõe v1 e v2', () => {
    expect(ProductWebhookVersions).toEqual(['v1', 'v2']);
    expect(ProductWebhookSchemaByVersion.v1).toBeDefined();
    expect(ProductWebhookSchemaByVersion.v2).toBeDefined();
  });

  it('payload v1 válido continua válido após introdução do v2', () => {
    const payload = { action: 'upsert' as const, product: validProduct };
    expect(ProductWebhookV1Schema.safeParse(payload).success).toBe(true);
  });

  it('payload v1 NÃO valida em v2 sem idempotency_key (sinaliza migração)', () => {
    const payload = { action: 'upsert', product: validProduct };
    expect(ProductWebhookV2Schema.safeParse(payload).success).toBe(false);
  });

  it('campo extra desconhecido em v1 é silenciosamente removido (passthrough seguro)', () => {
    const res = ProductWebhookV1Schema.safeParse({
      action: 'upsert',
      product: validProduct,
      extra_field_from_future: 'ignored',
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect((res.data as Record<string, unknown>).extra_field_from_future).toBeUndefined();
  });
});
