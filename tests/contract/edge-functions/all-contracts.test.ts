/**
 * Testes de contrato parametrizados — itera por TODOS os schemas em
 * `supabase/functions/_shared/contracts/*.contracts.ts` e verifica:
 *
 *  1. examples.valid[] são aceitos (success === true).
 *  2. examples.invalid[] são rejeitados (success === false) e:
 *     - quando `expectedPath` é fornecido, ele aparece em algum issue,
 *     - a conversão para FieldIssue produz shape estável (path/code/message).
 *  3. Matriz negativa auto-derivada: para cada campo top-level required do
 *     ZodObject (quando possível), missing/wrong/empty geram falhas.
 *  4. validationErrorResponse(err) ⇒ 422 + body shape único.
 *
 * Schemas não-ZodObject (discriminated unions, refinements) usam apenas
 * (1)+(2)+(4); a matriz auto (3) é skipped para esses.
 */
import { describe, it, expect } from 'vitest';
import {
  validationErrorResponse,
  zodErrorToFields,
  ERROR_CODES,
} from '../../../supabase/functions/_shared/contracts/error-response.ts';
import type { ContractRegistry } from '../../../supabase/functions/_shared/contracts/versioning.ts';
import { generateNegativeMatrix } from '../_helpers/negative-matrix.ts';

const cors = { 'Access-Control-Allow-Origin': '*' };

// Vite-nativo: carrega todos os contratos com import sync + eager. Devolve
// `{ '/abs/path/foo.contracts.ts': { contracts: ... } }`.
const contractModules = import.meta.glob<{ contracts: ContractRegistry }>(
  '../../../supabase/functions/_shared/contracts/*.contracts.ts',
  { eager: true },
);

const contractEntries = Object.entries(contractModules)
  .map(([path, mod]) => {
    const file = path.split('/').pop() ?? path;
    const name = file.replace(/\.contracts\.ts$/, '');
    return { name, file, mod };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

if (contractEntries.length === 0) {
  throw new Error('Nenhum contrato encontrado — verifique o glob em all-contracts.test.ts');
}

describe.each(contractEntries)('contract: $name', ({ mod, file }) => {
  it('expõe registry `contracts` com pelo menos a versão v1', () => {
    expect(mod.contracts, `${file} não exporta { contracts }`).toBeDefined();
    const versions = Object.keys(mod.contracts);
    expect(versions.length).toBeGreaterThan(0);
    expect(versions[0]).toBe('v1');
  });

  it('examples.valid são todos aceitos pelo schema', () => {
    for (const [version, entry] of Object.entries(mod.contracts)) {
      for (const payload of entry.examples?.valid ?? []) {
        const r = entry.schema.safeParse(payload);
        if (!r.success) {
          throw new Error(
            `[${file}::${version}] payload válido rejeitado:\n` +
              JSON.stringify(payload, null, 2) +
              '\nIssues: ' +
              JSON.stringify(r.error.issues),
          );
        }
      }
    }
  });

  it('examples.invalid são rejeitados; expectedPath aparece quando declarado', async () => {
    for (const [version, entry] of Object.entries(mod.contracts)) {
      for (const { payload, expectedPath } of entry.examples?.invalid ?? []) {
        const r = entry.schema.safeParse(payload);
        expect(
          r.success,
          `[${file}::${version}] payload inválido foi ACEITO: ${JSON.stringify(payload)}`,
        ).toBe(false);
        if (r.success) continue;

        if (expectedPath !== undefined) {
          const paths = r.error.issues.map((i) => i.path.map(String).join('.'));
          expect(
            paths,
            `[${file}::${version}] expectedPath="${expectedPath}" não em ${JSON.stringify(paths)}`,
          ).toContain(expectedPath);
        }

        const res = validationErrorResponse(r.error, cors);
        expect(res.status).toBe(422);
        const body = (await res.json()) as {
          code: string;
          fields: Array<{ path: string; code: string; message: string }>;
        };
        expect(body.code).toBe(ERROR_CODES.VALIDATION_FAILED);
        expect(body.fields.length).toBeGreaterThan(0);
        for (const f of body.fields) {
          expect(typeof f.path).toBe('string');
          expect(typeof f.code).toBe('string');
          expect(typeof f.message).toBe('string');
        }
      }
    }
  });

  it('matriz negativa auto (missing/wrong/empty) — schema não aceita TODAS as variantes', () => {
    const v1 = mod.contracts.v1;
    if (!v1) return;
    const validExample = v1.examples?.valid?.[0];
    if (!validExample || typeof validExample !== 'object') return;

    const matrix = generateNegativeMatrix(
      v1.schema,
      validExample as Record<string, unknown>,
    );
    if (matrix.length === 0) return; // schema não introspectável — coberto por examples.invalid

    const rejections = matrix.filter(
      (c) => !v1.schema.safeParse(c.payload).success,
    );
    expect(
      rejections.length,
      `[${file}] schema aceita TODAS as ${matrix.length} variantes auto — provável buraco`,
    ).toBeGreaterThan(0);
  });

  it('zodErrorToFields produz path em dot-notation (sem brackets)', () => {
    for (const entry of Object.values(mod.contracts)) {
      for (const { payload } of entry.examples?.invalid ?? []) {
        const r = entry.schema.safeParse(payload);
        if (r.success) continue;
        for (const f of zodErrorToFields(r.error)) {
          expect(f.path).not.toMatch(/\[\d+\]/);
        }
      }
    }
  });
});
