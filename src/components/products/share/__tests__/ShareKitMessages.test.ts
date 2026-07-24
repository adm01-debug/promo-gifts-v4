import { describe, it, expect } from 'vitest';
import { generateKitCompleteMessage, generateItemMessage } from '../ShareKitDialog';
import type { Product, KitComponent } from '@/types/product-catalog';

const mockProduct = {
  name: 'Kit Gourmet',
  sku: 'KIT-GOU',
  description: 'Um kit delicioso.',
  price: 250.0,
  minQuantity: 20,
  stockStatus: 'in-stock',
  kitItems: [
    { productName: 'Vinho Tinto', quantity: 1 },
    { productName: 'Taça de Cristal', quantity: 2 },
  ],
} as unknown as Product;

const mockItem = {
  productName: 'Vinho Tinto',
  description: 'Vinho chileno reserva.',
  material: 'Vidro/Líquido',
  weightG: 1200,
} as unknown as KitComponent;

const normalize = (s: string) =>
  s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('ShareKitDialog Message Generation Logic', () => {
  describe('generateKitCompleteMessage', () => {
    it('deve incluir o nome do kit e SKU', () => {
      const msg = normalize(generateKitCompleteMessage(mockProduct));
      expect(msg).toContain('Kit Gourmet');
      expect(msg).toContain('KIT-GOU');
    });

    it('deve listar todos os componentes com numeração e quantidade', () => {
      const msg = normalize(generateKitCompleteMessage(mockProduct));
      expect(msg).toContain('1. Vinho Tinto (1 un)');
      expect(msg).toContain('2. Taça de Cristal (2 un)');
    });

    it('deve formatar o preço corretamente em BRL', () => {
      const msg = normalize(generateKitCompleteMessage(mockProduct));
      expect(msg).toContain('R$ 250,00');
    });

    it('deve mostrar status de pronta entrega', () => {
      const msg = generateKitCompleteMessage(mockProduct);
      expect(msg).toContain('✅ Pronta entrega');
    });

    it('deve lidar com kitItems nulo ou vazio', () => {
      const emptyKit = { ...mockProduct, kitItems: [] } as unknown as Product;
      const msg = generateKitCompleteMessage(emptyKit);
      expect(msg).toContain('Consultar itens');
    });
  });

  describe('generateItemMessage', () => {
    it('deve conter o nome do item e o nome do kit de origem', () => {
      const msg = normalize(generateItemMessage(mockProduct, mockItem));
      expect(msg).toContain('Vinho Tinto');
      expect(msg).toContain('Parte do Kit: Kit Gourmet');
    });

    it('deve incluir material e peso se presentes', () => {
      const msg = normalize(generateItemMessage(mockProduct, mockItem));
      expect(msg).toContain('🧵 Material: Vidro/Líquido');
      expect(msg).toContain('⚖️ Peso: 1200g');
    });

    it('deve ocultar material e peso se ausentes', () => {
      const minimalItem = { productName: 'Item' } as KitComponent;
      const msg = normalize(generateItemMessage(mockProduct, minimalItem));
      expect(msg).not.toContain('🧵 Material:');
      expect(msg).not.toContain('⚖️ Peso:');
    });

    it('deve mencionar que o investimento é do kit completo', () => {
      const msg = normalize(generateItemMessage(mockProduct, mockItem));
      expect(msg).toContain('Kit completo a partir de R$ 250,00');
    });
  });
});
