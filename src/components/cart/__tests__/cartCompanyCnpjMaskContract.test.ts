/**
 * Contrato de formatação · `resolveCartCompanyCnpj` DEVE produzir exatamente
 * o mesmo texto que `maskCnpj(digits)` quando há CNPJ válido — seja vindo do
 * CRM ou do `company_location` cru. Este teste "trava" o contrato para
 * impedir regressões silenciosas (ex.: alguém trocar por `formatCnpj` custom,
 * remover pontuação, ou espelhar dígitos crus na UI).
 *
 * Estratégia: para uma bateria de 20 CNPJs (fixos + gerados) comparamos
 * caractere-a-caractere:
 *   - resolve(cart, CRM_com_cnpj).display  ===  maskCnpj(cnpj)
 *   - resolve(cart, mapaVazio).display     ===  maskCnpj(cnpj)   // via company_location
 *
 * Também garantimos que ruído (pontuação, espaços, prefixo "CNPJ:", ...) no
 * valor de entrada NÃO altera o texto final: ele SEMPRE segue o formato
 * canônico `XX.XXX.XXX/XXXX-XX`.
 */
import { describe, it, expect } from 'vitest';
import { resolveCartCompanyCnpj } from '../cartCompanyCnpj';
import { maskCnpj } from '@/utils/masks';

const FIXED_CNPJS = [
  '38457038000160',
  '11222333000181',
  '00000000000191', // Banco do Brasil
  '60746948000112', // Banco Bradesco
  '33000167000101', // Petrobras
  '02558157000162', // Vivo
  '17155730000164',
  '19131243000197',
  '43776517000180',
  '60701190000104',
];

function generatedCnpj(seed: number): string {
  // Determinístico — 14 dígitos derivados de `seed`.
  const digits: string[] = [];
  let x = seed * 2654435761;
  for (let i = 0; i < 14; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    digits.push(String(x % 10));
  }
  return digits.join('');
}

const ALL_CNPJS = [
  ...FIXED_CNPJS,
  ...Array.from({ length: 10 }, (_, i) => generatedCnpj(i + 1)),
];

const NOISE_WRAPPERS: Array<(raw: string) => string> = [
  (raw) => raw, // cru
  (raw) => maskCnpj(raw), // já mascarado
  (raw) => `  ${maskCnpj(raw)}  `, // espaços
  (raw) => `CNPJ: ${maskCnpj(raw)}`, // prefixo comum em legados
  (raw) => raw.split('').join(' '), // dígitos separados
];

describe('cartCompanyCnpj · contrato com maskCnpj', () => {
  it('CRM: display DEVE ser exatamente maskCnpj(cnpj) para qualquer variação de ruído', () => {
    for (const raw of ALL_CNPJS) {
      const expected = maskCnpj(raw);
      // Garantia sobre o próprio helper — se o formato mudar, este teste
      // também precisa mudar deliberadamente.
      expect(expected).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);

      for (const wrap of NOISE_WRAPPERS) {
        const crmMap = new Map<string, string>([['co-x', wrap(raw)]]);
        const result = resolveCartCompanyCnpj(
          { company_id: 'co-x', company_location: 'Qualquer ramo' },
          crmMap,
        );
        expect(result.isCnpj).toBe(true);
        expect(result.display).toBe(expected);
      }
    }
  });

  it('company_location: display DEVE ser exatamente maskCnpj(cnpj) quando o CRM não entrega', () => {
    for (const raw of ALL_CNPJS) {
      const expected = maskCnpj(raw);
      for (const wrap of NOISE_WRAPPERS) {
        const result = resolveCartCompanyCnpj(
          { company_id: 'co-y', company_location: wrap(raw) },
          new Map(),
        );
        expect(result.isCnpj).toBe(true);
        expect(result.display).toBe(expected);
      }
    }
  });

  it('CRM > company_location: quando ambos têm CNPJ diferente, o do CRM vence e usa maskCnpj', () => {
    const crm = '38457038000160';
    const loc = '11222333000181';
    const result = resolveCartCompanyCnpj(
      { company_id: 'co-z', company_location: loc },
      new Map([['co-z', crm]]),
    );
    expect(result.display).toBe(maskCnpj(crm));
    expect(result.display).not.toBe(maskCnpj(loc));
  });

  it('display NUNCA contém dígitos crus sem pontuação quando é um CNPJ', () => {
    for (const raw of ALL_CNPJS) {
      const result = resolveCartCompanyCnpj(
        { company_id: 'co-w', company_location: raw },
        new Map(),
      );
      expect(result.display).not.toBe(raw);
      expect(result.display).toContain('.');
      expect(result.display).toContain('/');
      expect(result.display).toContain('-');
    }
  });
});
