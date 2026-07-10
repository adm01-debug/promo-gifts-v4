/**
 * Testes unitários exaustivos para `resolveCartCompanyCnpj`.
 *
 * Cobrem os quatro cenários da regra + edge cases levantados pelo PO:
 *  - CRM entrega CNPJ (formatado, cru, com espaços, com pontuação)
 *  - CRM entrega valor inválido (curto, com letras, null, undefined) → fallback
 *  - `company_location` guarda CNPJ cru (carrinho novo)
 *  - `company_location` guarda ramo (carrinho legado)
 *  - Serviço indisponível: mapa vazio → cai para company_location
 *  - Serviço com timeout: mapa apenas com IDs de outras empresas → não vaza
 *  - Whitespace-only company_location → null
 *  - Nada disponível → null (consumidor suprime o <p>)
 */
import { describe, it, expect } from 'vitest';
import { resolveCartCompanyCnpj } from '../cartCompanyCnpj';

const VALID_CNPJ_RAW = '38457038000160';
const VALID_CNPJ_MASKED = '38.457.038/0001-60';

const OTHER_CNPJ_RAW = '11222333000181';
const OTHER_CNPJ_MASKED = '11.222.333/0001-81';

function makeCart(overrides: Partial<{ company_id: string; company_location: string | null }> = {}) {
  return {
    company_id: 'co-1',
    company_location: null,
    ...overrides,
  };
}

describe('resolveCartCompanyCnpj', () => {
  describe('caminho 1 — CRM entrega CNPJ (fonte preferida)', () => {
    it('CNPJ cru (14 dígitos) é mascarado para exibição', () => {
      const map = new Map([['co-1', VALID_CNPJ_RAW]]);
      expect(resolveCartCompanyCnpj(makeCart(), map)).toEqual({
        display: VALID_CNPJ_MASKED,
        isCnpj: true,
      });
    });

    it('CNPJ já mascarado é re-normalizado e mascarado consistentemente', () => {
      const map = new Map([['co-1', VALID_CNPJ_MASKED]]);
      expect(resolveCartCompanyCnpj(makeCart(), map)).toEqual({
        display: VALID_CNPJ_MASKED,
        isCnpj: true,
      });
    });

    it('CNPJ com espaços/pontuação parcial é normalizado', () => {
      const map = new Map([['co-1', ' 38.457.038/0001-60 ']]);
      expect(resolveCartCompanyCnpj(makeCart(), map)).toEqual({
        display: VALID_CNPJ_MASKED,
        isCnpj: true,
      });
    });

    it('CRM tem prioridade sobre company_location (mesmo se company_location for outro CNPJ)', () => {
      const map = new Map([['co-1', VALID_CNPJ_RAW]]);
      const cart = makeCart({ company_location: OTHER_CNPJ_RAW });
      expect(resolveCartCompanyCnpj(cart, map)).toEqual({
        display: VALID_CNPJ_MASKED,
        isCnpj: true,
      });
    });
  });

  describe('caminho 2 — company_location guarda CNPJ (carrinhos novos)', () => {
    it('CNPJ cru é mascarado', () => {
      const cart = makeCart({ company_location: VALID_CNPJ_RAW });
      expect(resolveCartCompanyCnpj(cart, new Map())).toEqual({
        display: VALID_CNPJ_MASKED,
        isCnpj: true,
      });
    });

    it('CNPJ já mascarado também funciona', () => {
      const cart = makeCart({ company_location: VALID_CNPJ_MASKED });
      expect(resolveCartCompanyCnpj(cart, new Map())).toEqual({
        display: VALID_CNPJ_MASKED,
        isCnpj: true,
      });
    });

    it('lookup CRM inválido (curto) NÃO sobrescreve CNPJ do company_location', () => {
      const map = new Map([['co-1', '123']]);
      const cart = makeCart({ company_location: VALID_CNPJ_RAW });
      expect(resolveCartCompanyCnpj(cart, map)).toEqual({
        display: VALID_CNPJ_MASKED,
        isCnpj: true,
      });
    });
  });

  describe('caminho 3 — fallback ramo de atividade (carrinhos legados)', () => {
    it('ramo é retornado sem máscara e marcado como não-CNPJ', () => {
      const cart = makeCart({ company_location: 'Peças automotivas | Indústria' });
      expect(resolveCartCompanyCnpj(cart, new Map())).toEqual({
        display: 'Peças automotivas | Indústria',
        isCnpj: false,
      });
    });

    it('CRM sem entrada para essa empresa → cai para ramo', () => {
      const map = new Map([['outra-empresa', VALID_CNPJ_RAW]]);
      const cart = makeCart({ company_location: 'Energia Solar' });
      expect(resolveCartCompanyCnpj(cart, map)).toEqual({
        display: 'Energia Solar',
        isCnpj: false,
      });
    });

    it('CRM entrada null/undefined → cai para ramo (serviço indisponível parcial)', () => {
      const map = new Map<string, string | null | undefined>([
        ['co-1', null],
        ['co-2', undefined],
      ]);
      const cart1 = makeCart({ company_id: 'co-1', company_location: 'Ramo A' });
      const cart2 = makeCart({ company_id: 'co-2', company_location: 'Ramo B' });
      expect(resolveCartCompanyCnpj(cart1, map).display).toBe('Ramo A');
      expect(resolveCartCompanyCnpj(cart2, map).display).toBe('Ramo B');
    });

    it('CRM entrada com dígitos insuficientes (< 14) → cai para ramo', () => {
      const map = new Map([['co-1', '38457038']]);
      const cart = makeCart({ company_location: 'Cooperativas' });
      expect(resolveCartCompanyCnpj(cart, map)).toEqual({
        display: 'Cooperativas',
        isCnpj: false,
      });
    });

    it('CRM entrada com > 14 dígitos: normalizeCnpj trunca em 14, ainda é CNPJ válido', () => {
      // Comportamento SSOT de normalizeCnpj: slice(0,14). Documentado aqui para
      // que qualquer mudança em masks.ts falhe este teste explicitamente.
      const map = new Map([['co-1', '384570380001601234']]);
      const cart = makeCart({ company_location: 'Ramo' });
      const out = resolveCartCompanyCnpj(cart, map);
      expect(out.isCnpj).toBe(true);
      expect(out.display).toBe(VALID_CNPJ_MASKED);
    });
  });

  describe('caminho 4 — nada para exibir', () => {
    it('company_location null + CRM vazio → display null', () => {
      expect(resolveCartCompanyCnpj(makeCart(), new Map())).toEqual({
        display: null,
        isCnpj: false,
      });
    });

    it('company_location "" (string vazia) → display null', () => {
      const cart = makeCart({ company_location: '' });
      expect(resolveCartCompanyCnpj(cart, new Map())).toEqual({
        display: null,
        isCnpj: false,
      });
    });

    it('company_location "   " (whitespace) → display null', () => {
      const cart = makeCart({ company_location: '   ' });
      expect(resolveCartCompanyCnpj(cart, new Map())).toEqual({
        display: null,
        isCnpj: false,
      });
    });

    it('CRM entrada com apenas letras (sem dígitos) → display null se location também vazio', () => {
      const map = new Map([['co-1', 'abc']]);
      expect(resolveCartCompanyCnpj(makeCart(), map)).toEqual({
        display: null,
        isCnpj: false,
      });
    });
  });

  describe('resiliência — serviço CRM em vários estados', () => {
    it('cache com muitos IDs, sem o do carrinho → não vaza CNPJ de outra empresa', () => {
      const map = new Map([
        ['co-2', OTHER_CNPJ_RAW],
        ['co-3', VALID_CNPJ_RAW],
      ]);
      const cart = makeCart({ company_id: 'co-1', company_location: 'Setor X' });
      const out = resolveCartCompanyCnpj(cart, map);
      expect(out.display).toBe('Setor X');
      expect(out.display).not.toContain(OTHER_CNPJ_MASKED);
      expect(out.display).not.toContain(VALID_CNPJ_MASKED);
    });

    it('serviço indisponível (mapa vazio) preserva comportamento legado (ramo)', () => {
      const cart = makeCart({ company_location: 'Ramo Legado' });
      expect(resolveCartCompanyCnpj(cart, new Map()).display).toBe('Ramo Legado');
    });

    it('serviço lento (mapa parcialmente populado) atende o que já tem', () => {
      const map = new Map([['co-2', VALID_CNPJ_RAW]]);
      const cart1 = makeCart({ company_id: 'co-1', company_location: 'Ramo A' });
      const cart2 = makeCart({ company_id: 'co-2', company_location: 'Ramo B' });
      expect(resolveCartCompanyCnpj(cart1, map).isCnpj).toBe(false);
      expect(resolveCartCompanyCnpj(cart2, map).isCnpj).toBe(true);
      expect(resolveCartCompanyCnpj(cart2, map).display).toBe(VALID_CNPJ_MASKED);
    });
  });
});
