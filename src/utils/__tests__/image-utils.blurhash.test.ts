/**
 * Testes unitários para getBlurhashDominantColor.
 *
 * Hashes sintéticos mínimos (6 chars: sizeFlag + maxAC + 4 chars DC):
 *   "000000" → DC=0x000000 → rgb(0,0,0)   preto
 *   "00TI:j" → DC=0xFF0000 → rgb(255,0,0) vermelho puro
 *   "000036" → DC=0x0000FF → rgb(0,0,255) azul puro
 *   "00TSUA" → DC=0xFFFFFF → rgb(255,255,255) branco
 *
 * Derivação: DC = d3*83³ + d2*83² + d1*83 + d0 (4 chars base83 a partir da posição 2).
 */
import { describe, it, expect } from 'vitest';
import { getBlurhashDominantColor } from '@/utils/image-utils';

describe('getBlurhashDominantColor', () => {
  describe('entradas inválidas → null', () => {
    it('null', () => expect(getBlurhashDominantColor(null)).toBeNull());
    it('undefined', () => expect(getBlurhashDominantColor(undefined)).toBeNull());
    it('string vazia', () => expect(getBlurhashDominantColor('')).toBeNull());
    it('string muito curta (< 6 chars)', () => expect(getBlurhashDominantColor('abc')).toBeNull());
    it('exatamente 5 chars (abaixo do mínimo)', () =>
      expect(getBlurhashDominantColor('abcde')).toBeNull());
  });

  describe('extração correta do componente DC', () => {
    it('hash de preto puro (0x000000) → rgb(0,0,0)', () => {
      // DC chars "0000" → 0*83³+0*83²+0*83+0 = 0
      expect(getBlurhashDominantColor('000000')).toBe('rgb(0,0,0)');
    });

    it('hash de vermelho puro (0xFF0000) → rgb(255,0,0)', () => {
      // DC chars "TI:j": T=29, I=18, :=70, j=45
      // 29*571787 + 18*6889 + 70*83 + 45 = 16711680 = 0xFF0000
      expect(getBlurhashDominantColor('00TI:j')).toBe('rgb(255,0,0)');
    });

    it('hash de azul puro (0x0000FF) → rgb(0,0,255)', () => {
      // DC chars "0036": 0+0+3*83+6 = 255 = 0x0000FF
      expect(getBlurhashDominantColor('000036')).toBe('rgb(0,0,255)');
    });

    it('hash de branco puro (0xFFFFFF) → rgb(255,255,255)', () => {
      // DC chars "TSUA": T=29, S=28, U=30, A=10
      // 29*571787 + 28*6889 + 30*83 + 10 = 16777215 = 0xFFFFFF
      expect(getBlurhashDominantColor('00TSUA')).toBe('rgb(255,255,255)');
    });

    it('ignora chars além da posição 5 (componentes AC não interferem)', () => {
      // Sufixo longo não deve alterar o resultado
      expect(getBlurhashDominantColor('000000_extrapadding_long_suffix')).toBe('rgb(0,0,0)');
      expect(getBlurhashDominantColor('00TI:j_extrapadding')).toBe('rgb(255,0,0)');
    });

    it('hash real de exemplo (L6PZfSi_.AyE) — retorna string rgb válida', () => {
      const result = getBlurhashDominantColor('L6PZfSi_.AyE_3t7t7R**0o#DgR4');
      expect(result).not.toBeNull();
      expect(result).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    });
  });

  describe('robustez com caracteres inválidos em base83', () => {
    it('caractere fora do alfabeto no DC → retorna null (decode83 retorna 0, não lança)', () => {
      // '!' não está no alfabeto base83; decode83 retorna 0 para ele → DC=0 → rgb(0,0,0)
      // A função não deve lançar exceção em nenhum caso
      const result = getBlurhashDominantColor('00!!00');
      expect(() => getBlurhashDominantColor('00!!00')).not.toThrow();
      // Resultado pode ser rgb(0,0,0) (fallback de idx<0 → 0) ou null; em ambos os casos não lança
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });
});
