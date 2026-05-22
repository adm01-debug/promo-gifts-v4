/**
 * Testa o helper `validationErrorResponse` e demais conversores de erro.
 * Garante que TODA Edge Function que delegar a esse helper produzirá um shape
 * idêntico (code/message/fields), com status 422 para validação e 400 para
 * JSON malformado / body vazio / versão desconhecida.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ERROR_CODES,
  invalidJsonResponse,
  missingBodyResponse,
  unsupportedVersionResponse,
  validationErrorResponse,
  zodErrorToFields,
  type ErrorResponseBody,
} from '../../../supabase/functions/_shared/contracts/error-response.ts';

const cors = { 'Access-Control-Allow-Origin': '*' };

async function readBody(res: Response): Promise<ErrorResponseBody> {
  return (await res.json()) as ErrorResponseBody;
}

describe('validationErrorResponse', () => {
  it('retorna 422 com code=VALIDATION_FAILED', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = schema.safeParse({ age: 'oops' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const res = validationErrorResponse(result.error, cors);
    expect(res.status).toBe(422);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const body = await readBody(res);
    expect(body.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(body.message).toMatch(/schema validation/i);
    expect(Array.isArray(body.fields)).toBe(true);
    expect(body.fields.length).toBeGreaterThan(0);
  });

  it('mapeia path Zod com índice numérico para dot-notation (ex: products.0.sku)', () => {
    const schema = z.object({
      products: z.array(z.object({ sku: z.string() })),
    });
    const result = schema.safeParse({ products: [{ sku: 123 }] });
    if (result.success) throw new Error('expected failure');
    const fields = zodErrorToFields(result.error);
    expect(fields.some((f) => f.path === 'products.0.sku')).toBe(true);
  });

  it('campo obrigatório ausente vira code=required (não invalid_type)', () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({});
    if (result.success) throw new Error('expected failure');
    const fields = zodErrorToFields(result.error);
    expect(fields.find((f) => f.path === 'name')?.code).toBe('required');
  });

  it('encadeia extraHeaders (ex: X-Contract-Version + Deprecation)', async () => {
    const schema = z.object({ x: z.string() });
    const r = schema.safeParse({});
    if (r.success) return;
    const res = validationErrorResponse(r.error, cors, {
      'X-Contract-Version': 'v1',
      Deprecation: 'true',
    });
    expect(res.headers.get('X-Contract-Version')).toBe('v1');
    expect(res.headers.get('Deprecation')).toBe('true');
  });
});

describe('invalidJsonResponse', () => {
  it('retorna 400 com code=INVALID_JSON e fields vazio', async () => {
    const res = invalidJsonResponse(cors);
    expect(res.status).toBe(400);
    const body = await readBody(res);
    expect(body.code).toBe(ERROR_CODES.INVALID_JSON);
    expect(body.fields).toEqual([]);
  });
});

describe('missingBodyResponse', () => {
  it('retorna 400 com code=MISSING_BODY e fields vazio', async () => {
    const res = missingBodyResponse(cors);
    expect(res.status).toBe(400);
    const body = await readBody(res);
    expect(body.code).toBe(ERROR_CODES.MISSING_BODY);
    expect(body.fields).toEqual([]);
  });
});

describe('unsupportedVersionResponse', () => {
  it('retorna 400 com code=UNSUPPORTED_VERSION mencionando versões suportadas', async () => {
    const res = unsupportedVersionResponse('v9', ['v1', 'v2'], cors);
    expect(res.status).toBe(400);
    const body = await readBody(res);
    expect(body.code).toBe(ERROR_CODES.UNSUPPORTED_VERSION);
    expect(body.message).toContain('v9');
    expect(body.message).toContain('v1');
    expect(body.message).toContain('v2');
  });
});

describe('shape único', () => {
  it('todas as respostas de erro têm exatamente {code, message, fields}', async () => {
    const schema = z.object({ x: z.string() });
    const r = schema.safeParse({});
    if (r.success) throw new Error();

    const responses = [
      validationErrorResponse(r.error, cors),
      invalidJsonResponse(cors),
      missingBodyResponse(cors),
      unsupportedVersionResponse('v9', ['v1'], cors),
    ];
    for (const res of responses) {
      const body = await readBody(res);
      expect(Object.keys(body).sort()).toEqual(['code', 'fields', 'message']);
      expect(typeof body.code).toBe('string');
      expect(typeof body.message).toBe('string');
      expect(Array.isArray(body.fields)).toBe(true);
    }
  });
});
