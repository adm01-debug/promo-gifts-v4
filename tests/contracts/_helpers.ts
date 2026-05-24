/**
 * Helpers de teste de contrato. Esses utilitários não dependem do runtime Deno;
 * funcionam em vitest porque o pacote `_shared/contracts` usa apenas `Request` /
 * `Response` (Web API, disponíveis em Node 20+).
 *
 * Vitest resolve `https://esm.sh/zod@...` → `zod` (npm) via alias em
 * `vitest.config.ts`.
 */

import { expect } from 'vitest';
import type { ContractError } from '../../supabase/functions/_shared/contracts/errors';

export function makeRequest(opts: {
  method?: string;
  url?: string;
  body?: unknown | string;
  headers?: Record<string, string>;
}): Request {
  const headers = new Headers(opts.headers ?? {});
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (typeof opts.body === 'string') {
      body = opts.body;
    } else {
      body = JSON.stringify(opts.body);
      if (!headers.has('content-type'))
        headers.set('content-type', 'application/json');
    }
  }
  return new Request(opts.url ?? 'https://edge.local/fn', {
    method: opts.method ?? 'POST',
    headers,
    body,
  });
}

export async function readBody(res: Response): Promise<ContractError> {
  return (await res.json()) as ContractError;
}

/** Assert helper: a resposta segue o formato canônico de erro. */
export async function expectContractError(
  res: Response,
  expected: {
    status: number;
    code: ContractError['code'];
    fieldPaths?: string[];
  }
): Promise<ContractError> {
  expect(res.status).toBe(expected.status);
  const body = await readBody(res);
  expect(body).toMatchObject({
    code: expected.code,
    message: expect.any(String),
    fields: expect.any(Array),
  });
  if (expected.fieldPaths) {
    const paths = body.fields.map((f) => f.path);
    for (const expectedPath of expected.fieldPaths) {
      expect(paths).toContain(expectedPath);
    }
  }
  return body;
}
