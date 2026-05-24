import { describe, it, expect } from 'vitest';
import { 
  calculateItemPersonalizationTotal, 
  calculateItemTotal, 
  calculateSubtotal, 
  applyMarkup, 
  calculateDiscountAmount,
  calculateRealDiscountPercent
} from '../../src/logic/quotes/calculations';

describe('Cálculos de Orçamento (Unit Tests)', () => {
  
  describe('calculateItemPersonalizationTotal', () => {
    it('deve somar corretamente os custos de personalização', () => {
      const item = {
        personalizations: [
          { total_cost: 10.50 },
          { total_cost: 5.00 }
        ]
      };
      expect(calculateItemPersonalizationTotal(item)).toBe(15.50);
    });

    it('deve retornar 0 se não houver personalizações', () => {
      expect(calculateItemPersonalizationTotal({ personalizations: [] })).toBe(0);
      expect(calculateItemPersonalizationTotal({})).toBe(0);
    });
  });

  describe('calculateItemTotal', () => {
    it('deve calcular o total do item (quantidade * preço + gravações)', () => {
      const params = {
        quantity: 100,
        unitPrice: 2.50,
        personalizations: [{ total_cost: 50 }]
      };
      // (100 * 2.5) + 50 = 250 + 50 = 300
      expect(calculateItemTotal(params)).toBe(300);
    });

    it('caso de borda: quantidade zero', () => {
      expect(calculateItemTotal({ quantity: 0, unitPrice: 10 })).toBe(0);
    });
  });

  describe('applyMarkup', () => {
    it('deve aplicar markup corretamente', () => {
      expect(applyMarkup(100, 10)).toBe(110);
      expect(applyMarkup(100, 50)).toBe(150);
    });

    it('deve limitar o markup ao máximo de 50%', () => {
      expect(applyMarkup(100, 60)).toBe(150);
    });

    it('deve ignorar markups negativos', () => {
      expect(applyMarkup(100, -10)).toBe(100);
    });
    
    it('deve arredondar para 2 casas decimais', () => {
      expect(applyMarkup(33.33, 10)).toBe(36.66); // 33.33 * 1.1 = 36.663 -> 36.66
    });
  });

  describe('calculateDiscountAmount', () => {
    it('deve calcular desconto percentual', () => {
      expect(calculateDiscountAmount(200, 'percent', 10)).toBe(20);
    });

    it('deve retornar valor fixo se for tipo "amount"', () => {
      expect(calculateDiscountAmount(200, 'amount', 50)).toBe(50);
    });
  });

  describe('calculateRealDiscountPercent', () => {
    it('deve calcular o desconto real sobre o subtotal original', () => {
      // Subtotal real: 100, Subtotal apresentado (com markup): 120, Desconto: 30
      // Valor final: 120 - 30 = 90
      // Desconto sobre o real: (100 - 90) / 100 = 10%
      expect(calculateRealDiscountPercent(100, 120, 30)).toBe(10);
    });

    it('deve retornar 0 se o subtotal real for 0', () => {
      expect(calculateRealDiscountPercent(0, 100, 10)).toBe(0);
    });
  });

  describe('Casos de Borda e Precisão Avançados', () => {
    it('deve lidar com descontos negativos (tratar como zero)', () => {
      expect(calculateDiscountAmount(100, 'percent', -10)).toBe(0);
      expect(calculateDiscountAmount(100, 'amount', -50)).toBe(0);
    });

    it('deve limitar markup excessivo ao teto de 50%', () => {
      expect(applyMarkup(100, 1000)).toBe(150);
      expect(applyMarkup(100, 50.00001)).toBe(150);
    });

    it('deve lidar com valores nulos ou undefined em todas as funções', () => {
      // @ts-ignore
      expect(applyMarkup(100, null)).toBe(100);
      // @ts-ignore
      expect(applyMarkup(null, 10)).toBe(0);
      // @ts-ignore
      expect(calculateDiscountAmount(null, 'percent', 10)).toBe(0);
      // @ts-ignore
      expect(calculateDiscountAmount(100, 'percent', null)).toBe(0);
      // @ts-ignore
      expect(calculateSubtotal(null)).toBe(0);
      expect(calculateSubtotal([])).toBe(0);
    });

    it('deve manter alta precisão e arredondamento correto (ABNT/Financeiro)', () => {
      // 10.125 deve arredondar para 10.13 se usarmos Math.round com 2 casas
      expect(applyMarkup(10, 1.25)).toBe(10.13); 
      
      // Teste com muitos decimais e arredondamento para cima/baixo
      expect(applyMarkup(10.124, 10)).toBe(11.14); // 10.124 * 1.1 = 11.1364 -> 11.14
      expect(applyMarkup(10.121, 10)).toBe(11.13); // 10.121 * 1.1 = 11.1331 -> 11.13
    });

    it('deve calcular o desconto real com precisão de 2 casas decimais no percentual', () => {
      // Subtotal real: 100, apresentado: 110 (markup 10%), desconto: 15
      // Final: 110 - 15 = 95
      // Desconto Real: (100 - 95) / 100 = 5%
      expect(calculateRealDiscountPercent(100, 110, 15)).toBe(5);

      // Valores quebrados
      // Subtotal real: 33.33, apresentado: 36.66, desconto: 5
      // Final: 31.66
      // Desconto Real: (33.33 - 31.66) / 33.33 = 1.67 / 33.33 = 0.050105... -> 5.01%
      expect(calculateRealDiscountPercent(33.33, 36.66, 5)).toBe(5.01);
    });

    it('arredonda quantidades fracionadas para 2 casas (contrato monetário)', () => {
      const params = {
        quantity: 0.3333,
        unitPrice: 10.5555
      };
      // calculateItemTotal aplica round2 (arredondamento monetário half-up):
      // 0.3333 * 10.5555 = 3.51814815 -> arredondado a centavos = 3.52.
      expect(calculateItemTotal(params)).toBe(3.52);
    });
  });
});

