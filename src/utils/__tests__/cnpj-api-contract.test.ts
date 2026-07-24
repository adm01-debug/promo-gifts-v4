/**
 * Testes de contrato de "API" (SSOT client-side + Zod) que roda antes de
 * todo insert/update em fornecedor e produto. Esta é a barreira que
 * `useSuppliersManager` e `useNewSupplierForm` invocam antes de chamar o
 * Supabase — se ela rejeitar, nada trafega.
 *
 * Objetivo: garantir que os endpoints de create/edit de fornecedor e
 * produto rejeitam CNPJ com não-dígitos, DVs inválidos, contagem
 * incorreta de dígitos e todos-iguais, retornando exatamente as mensagens
 * inline exibidas na UI.
 */
import { describe, it, expect } from 'vitest';
import {
  cnpjOptionalSchema,
  assertPersistableCnpj,
} from '@/utils/cnpj-schema';

interface Case {
  label: string;
  input: string | null | undefined;
  errorRegex: RegExp;
}

const REJECTED: Case[] = [
  // Não-dígitos que, após normalizar, resultam em < 14 dígitos.
  { label: 'só letras', input: 'ABCDEFGHIJKLMN', errorRegex: /14 d[ií]gitos/i },
  { label: 'letras + dígitos < 14', input: 'abc02931668000', errorRegex: /14 d[ií]gitos/i },
  { label: 'símbolos + dígitos < 14', input: '###02.931.668/00', errorRegex: /14 d[ií]gitos/i },
  // Nota: 'apenas espaços' → null (opcional) por design do schema — não é erro.
  // Contagem inválida.
  { label: 'menos de 14', input: '02931668000', errorRegex: /14 d[ií]gitos/i },
  // DVs inválidos.
  { label: 'DV errado canônico', input: '02.931.668/0001-00', errorRegex: /inv[aá]lido/i },
  { label: 'DV errado dígitos-only', input: '02931668000100', errorRegex: /inv[aá]lido/i },
  // Todos-iguais.
  { label: 'todos-iguais 0', input: '00000000000000', errorRegex: /inv[aá]lido/i },
  { label: 'todos-iguais 1', input: '11111111111111', errorRegex: /inv[aá]lido/i },
  { label: 'todos-iguais 9', input: '99999999999999', errorRegex: /inv[aá]lido/i },
];

const ACCEPTED: Array<{ label: string; input: string; expected: string }> = [
  { label: 'canônico mascarado', input: '02.931.668/0001-88', expected: '02931668000188' },
  { label: 'canônico dígitos-only', input: '02931668000188', expected: '02931668000188' },
  { label: 'canônico com espaços', input: '  02.931.668/0001-88  ', expected: '02931668000188' },
  { label: 'canônico com letras extras', input: '02.931.668/0001-88XYZ', expected: '02931668000188' },
];

describe('CNPJ — contrato de API (create/edit fornecedor + produto)', () => {
  describe('assertPersistableCnpj rejeita entradas inválidas', () => {
    for (const c of REJECTED) {
      it(`rejeita: ${c.label}`, () => {
        expect(() => assertPersistableCnpj(c.input)).toThrow(c.errorRegex);
      });
    }
  });

  describe('cnpjOptionalSchema.safeParse retorna erro com mensagem UI', () => {
    for (const c of REJECTED) {
      it(`safeParse falha e mensagem casa: ${c.label}`, () => {
        const r = cnpjOptionalSchema.safeParse(c.input);
        expect(r.success).toBe(false);
        if (!r.success) {
          expect(r.error.issues[0]?.message).toMatch(c.errorRegex);
        }
      });
    }
  });

  describe('valores aceitos retornam dígitos-only (nada de máscara persistida)', () => {
    for (const c of ACCEPTED) {
      it(`aceita e normaliza: ${c.label}`, () => {
        const persisted = assertPersistableCnpj(c.input);
        expect(persisted).toBe(c.expected);
        expect(persisted).toMatch(/^\d{14}$/);
      });
    }
  });

  describe('coerção de vazio/null/undefined → null (opcional)', () => {
    for (const v of ['', '   ', null, undefined] as const) {
      it(`vazio (${JSON.stringify(v)}) → null`, () => {
        expect(assertPersistableCnpj(v)).toBeNull();
      });
    }
  });
});
