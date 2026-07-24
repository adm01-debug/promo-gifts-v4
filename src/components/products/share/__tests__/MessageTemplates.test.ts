import { describe, it, expect } from 'vitest';
import { MESSAGE_TEMPLATES } from '../MessageTemplates';
import type { Product } from '@/types/product-catalog';

const baseProduct = {
  id: 'p1',
  name: 'Squeeze Térmica 500ml',
  description: 'Squeeze de alumínio com tampa rosqueável',
  sku: 'SQZ-001',
  price: 29.9,
  minQuantity: 50,
  stock: 1000,
  stockStatus: 'in-stock' as const,
  images: ['https://example.com/img.jpg'],
  colors: [
    { name: 'Azul', hex: '#0000ff', group: 'Frios' },
    { name: 'Vermelho', hex: '#ff0000', group: 'Quentes' },
  ],
  materials: ['Alumínio'],
  featured: false,
  newArrival: false,
  onSale: false,
  isKit: false,
  category: { id: 1, name: 'Beber' },
  supplier: { id: 's1', name: 'Fornecedor X' },
  tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
} as unknown as Product;

describe('MESSAGE_TEMPLATES', () => {
  it('possui 3 modelos: formal, informal, promocional', () => {
    expect(MESSAGE_TEMPLATES).toHaveLength(3);
    const keys = MESSAGE_TEMPLATES.map((t) => t.key);
    expect(keys).toEqual(['formal', 'informal', 'promotional']);
  });

  it.each(MESSAGE_TEMPLATES)(
    'template %s gera mensagem não vazia com nome, SKU e preço',
    (template) => {
      const msg = template.generate(baseProduct);
      expect(msg.length).toBeGreaterThan(50);
      expect(msg).toContain('Squeeze Térmica');
      expect(msg).toContain('R$');
      expect(msg).toContain('29,90');
    },
  );

  it('template formal inclui SKU e linguagem formal', () => {
    const msg = MESSAGE_TEMPLATES.find((t) => t.key === 'formal')!.generate(baseProduct);
    expect(msg).toContain('SQZ-001');
    expect(msg.toLowerCase()).toMatch(/prezado|atenciosamente/);
  });

  it('template informal inclui emojis', () => {
    const msg = MESSAGE_TEMPLATES.find((t) => t.key === 'informal')!.generate(baseProduct);
    expect(msg).toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it('template promocional inclui termos de urgência', () => {
    const msg = MESSAGE_TEMPLATES.find((t) => t.key === 'promotional')!.generate(baseProduct);
    expect(msg.toLowerCase()).toMatch(/oportunidade|especial|agora/);
  });

  it('lida com produto sem descrição', () => {
    const noDesc = { ...baseProduct, description: null } as Product;
    for (const t of MESSAGE_TEMPLATES) {
      expect(() => t.generate(noDesc)).not.toThrow();
    }
  });

  it('lida com produto sem cores', () => {
    const noColors = { ...baseProduct, colors: [] } as Product;
    for (const t of MESSAGE_TEMPLATES) {
      expect(() => t.generate(noColors)).not.toThrow();
    }
  });

  it('mensagens cabem em 1600 caracteres (limite WhatsApp/Twilio)', () => {
    for (const t of MESSAGE_TEMPLATES) {
      const msg = t.generate(baseProduct);
      expect(msg.length).toBeLessThan(1600);
    }
  });
});
