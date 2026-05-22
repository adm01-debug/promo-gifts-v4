/**
 * Contract tests — formato único de erro de validação 422.
 *
 * Cobre:
 *   - VALIDATION_FAILED  com fields[] estável (path/message/code)
 *   - INVALID_JSON       (parse error)
 *   - EMPTY_BODY         (body vazio)
 *   - UNSUPPORTED_VERSION (versão desconhecida)
 *   - paths em arrays/objetos aninhados (dot-notation)
 *   - api_version anotada na resposta
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  emptyBodyError400,
  invalidJsonError400,
  unsupportedVersionError400,
  validationError422,
  zodErrorToFields,
} from '../../../supabase/functions/_shared/api-errors';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe('api-errors — zodErrorToFields', () => {
  it('flatten paths em dot-notation para campos top-level', () => {
    const schema = z.object({ sku: z.string(), price: z.number() });
    const res = schema.safeParse({ sku: 'X', price: 'NaN' });
    expect(res.success).toBe(false);
    if (res.success) return;
    const fields = zodErrorToFields(res.error);
    const priceErr = fields.find((f) => f.path === 'price');
    expect(priceErr).toBeDefined();
    expect(priceErr!.code).toBe('invalid_type');
  });

  it('flatten paths em arrays e objetos aninhados', () => {
    const schema = z.object({
      images: z.array(z.object({ url: z.string().url() })),
    });
    const res = schema.safeParse({ images: [{ url: 'not-a-url' }] });
    expect(res.success).toBe(false);
    if (res.success) return;
    const fields = zodErrorToFields(res.error);
    expect(fields.some((f) => f.path === 'images.0.url')).toBe(true);
  });

  it('campo ausente vira issue em "required"', () => {
    const schema = z.object({ sku: z.string(), name: z.string() });
    const res = schema.safeParse({ sku: 'X' });
    expect(res.success).toBe(false);
    if (res.success) return;
    const fields = zodErrorToFields(res.error);
    expect(fields.find((f) => f.path === 'name')).toBeDefined();
  });
});

describe('api-errors — validationError422', () => {
  it('retorna 422 com payload { code, message, fields[], api_version }', async () => {
    const schema = z.object({ sku: z.string() });
    const result = schema.safeParse({});
    if (result.success) throw new Error('expected failure');
    const res = validationError422(result.error, { corsHeaders, apiVersion: 'v1' });
    expect(res.status).toBe(422);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const body = await readJson(res);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(typeof body.message).toBe('string');
    expect(Array.isArray(body.fields)).toBe(true);
    expect(body.fields.length).toBeGreaterThan(0);
    expect(body.fields[0]).toHaveProperty('path');
    expect(body.fields[0]).toHaveProperty('message');
    expect(body.api_version).toBe('v1');
  });

  it('preserva CORS headers passados', async () => {
    const schema = z.object({ x: z.string() });
    const result = schema.safeParse({});
    if (result.success) throw new Error('unreachable');
    const res = validationError422(result.error, {
      corsHeaders: { ...corsHeaders, 'X-Custom': 'yes' },
    });
    expect(res.headers.get('X-Custom')).toBe('yes');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('aceita override de mensagem', async () => {
    const schema = z.object({ x: z.string() });
    const result = schema.safeParse({});
    if (result.success) throw new Error('unreachable');
    const res = validationError422(result.error, {
      corsHeaders,
      message: 'Mensagem customizada do endpoint',
    });
    const body = await readJson(res);
    expect(body.message).toBe('Mensagem customizada do endpoint');
  });
});

describe('api-errors — invalidJsonError400 / emptyBodyError400', () => {
  it('INVALID_JSON com status 400 e fields vazio', async () => {
    const res = invalidJsonError400({ corsHeaders });
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toBe('INVALID_JSON');
    expect(body.fields).toEqual([]);
  });

  it('EMPTY_BODY com status 400 e fields vazio', async () => {
    const res = emptyBodyError400({ corsHeaders });
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toBe('EMPTY_BODY');
    expect(body.fields).toEqual([]);
  });
});

describe('api-errors — unsupportedVersionError400', () => {
  it('lista versões suportadas na mensagem', async () => {
    const res = unsupportedVersionError400('v9', ['v1', 'v2'], { corsHeaders });
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toBe('UNSUPPORTED_VERSION');
    expect(body.message).toContain('v9');
    expect(body.message).toContain('v1');
    expect(body.message).toContain('v2');
  });
});
