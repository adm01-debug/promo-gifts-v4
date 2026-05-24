import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  invalidJsonResponse,
  missingBodyResponse,
  unsupportedVersionResponse,
  validationErrorResponse,
  zodErrorToFieldIssues,
  zodValidationErrorResponse,
} from '../../supabase/functions/_shared/contracts/errors';

describe('contracts/errors — formato único de resposta', () => {
  it('missingBodyResponse → 400 com code=missing_body e fields=[]', async () => {
    const res = missingBodyResponse();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      code: 'missing_body',
      message: expect.any(String),
      fields: [],
    });
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('invalidJsonResponse → 400 com code=invalid_json', async () => {
    const res = invalidJsonResponse();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('invalid_json');
  });

  it('validationErrorResponse → 422 com fields preservados', async () => {
    const res = validationErrorResponse([
      { path: 'product.sku', message: 'Required', code: 'invalid_type' },
    ]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('validation_failed');
    expect(body.fields).toHaveLength(1);
    expect(body.fields[0].path).toBe('product.sku');
  });

  it('unsupportedVersionResponse → 406 listando versões suportadas', async () => {
    const res = unsupportedVersionResponse('99', ['1', '2']);
    expect(res.status).toBe(406);
    const body = await res.json();
    expect(body.code).toBe('unsupported_version');
    expect(body.message).toContain('99');
    expect(body.message).toContain('1, 2');
  });

  it('zodErrorToFieldIssues converte paths aninhados e índices', () => {
    const schema = z.object({
      product: z.object({
        sku: z.string(),
        images: z.array(z.string().url()),
      }),
    });
    const r = schema.safeParse({
      product: { sku: 123, images: ['not-a-url', 'https://ok.com'] },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issues = zodErrorToFieldIssues(r.error);
      const paths = issues.map((i) => i.path);
      expect(paths).toContain('product.sku');
      expect(paths).toContain('product.images[0]');
    }
  });

  it('zodValidationErrorResponse propaga corsHeaders e versão', async () => {
    const schema = z.object({ sku: z.string() });
    const r = schema.safeParse({});
    if (r.success) throw new Error('expected failure');
    const res = zodValidationErrorResponse(r.error, {
      corsHeaders: { 'access-control-allow-origin': '*' },
      version: '2',
    });
    expect(res.status).toBe(422);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('x-contract-version')).toBe('2');
    const body = await res.json();
    expect(body.version).toBe('2');
  });

  it('payload de validação inclui campo received quando explicitado', async () => {
    const res = validationErrorResponse([
      {
        path: 'qty',
        message: 'must be positive',
        code: 'too_small',
        received: -1,
      },
    ]);
    const body = await res.json();
    expect(body.fields[0].received).toBe(-1);
  });
});
