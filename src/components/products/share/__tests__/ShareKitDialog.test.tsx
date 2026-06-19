import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareKitDialog } from '../ShareKitDialog';
import type { Product } from '@/types/product-catalog';

vi.mock('@/hooks/ui', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../whatsapp', () => ({
  openWhatsAppShare: vi.fn(() => ({ url: 'https://wa.me/x', opened: true })),
}));

vi.mock('../ShareContactSelector', () => ({
  ShareContactSelector: ({ onSelect }: { selection?: unknown; onSelect: (s: unknown) => void }) => (
    <div data-testid="contact-selector">
      <button
        onClick={() =>
          onSelect({
            companyId: 'c1',
            companyName: 'ACME',
            contactPhone: '11999998888',
            contactName: 'João',
          })
        }
      >
        select-valid
      </button>
      <button
        onClick={() => onSelect({ companyId: 'c1', companyName: 'ACME', contactPhone: '123' })}
      >
        select-invalid
      </button>
      <button onClick={() => onSelect(null)}>clear</button>
    </div>
  ),
}));

const kitProduct: Product = {
  id: 'kit-1',
  name: 'Kit Boas Vindas',
  description: 'Kit completo de onboarding',
  sku: 'KIT-001',
  price: 150,
  minQuantity: 10,
  stock: 500,
  stockStatus: 'in-stock',
  images: ['https://example.com/kit.jpg'],
  isKit: true,
  kitItems: [
    {
      id: 'i1',
      productId: 'p1',
      productName: 'Squeeze',
      quantity: 1,
      sku: 'SQZ',
      imageUrl: 'https://example.com/sqz.jpg',
    },
    { id: 'i2', productId: 'p2', productName: 'Caderno', quantity: 1, sku: 'CAD', imageUrl: '' }, // sem imagem
  ],
  category: { id: 1, name: 'Kits' },
  supplier: { id: 's1', name: 'Fornecedor' },
  colors: [],
  materials: [],
  featured: false,
  newArrival: false,
  onSale: false,
  tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
} as unknown as Product;

describe('ShareKitDialog - modo COMPLETE', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza com título "Enviar KIT Completo"', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="complete" />);
    expect(screen.getByText('Enviar KIT Completo')).toBeInTheDocument();
  });

  it('gera mensagem com lista de componentes do kit', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="complete" />);
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox');
    expect(textarea.value).toContain('Squeeze');
    expect(textarea.value).toContain('Caderno');
    expect(textarea.value).toContain('Kit Boas Vindas');
    expect(textarea.value).toContain('KIT-001');
  });

  it('mostra botão Enviar habilitado quando não há contato', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="complete" />);
    const btn = screen.getByRole('button', { name: /Enviar WhatsApp/i });
    expect(btn).not.toBeDisabled();
  });

  it('desabilita botão Enviar quando telefone inválido', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="complete" />);
    fireEvent.click(screen.getByText('select-invalid'));
    const btn = screen.getByRole('button', { name: /Enviar WhatsApp/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/muito curto/i)).toBeInTheDocument();
  });

  it('habilita botão quando telefone válido', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="complete" />);
    fireEvent.click(screen.getByText('select-valid'));
    const btn = screen.getByRole('button', { name: /Enviar WhatsApp/i });
    expect(btn).not.toBeDisabled();
  });
});

describe('ShareKitDialog - modo SEPARATE', () => {
  it('renderiza grid de itens do kit', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="separate" />);
    expect(screen.getByText('Enviar Itens Separados')).toBeInTheDocument();
    expect(screen.getByText('Squeeze')).toBeInTheDocument();
    expect(screen.getByText('Caderno')).toBeInTheDocument();
  });

  it('não exibe formulário até item ser selecionado', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="separate" />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('gera mensagem específica ao selecionar item com imagem', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="separate" />);
    fireEvent.click(screen.getByText('Squeeze').closest('button')!);
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox');
    expect(textarea.value).toContain('Squeeze');
    expect(textarea.value).toContain('Parte do Kit: Kit Boas Vindas');
  });

  it('aplica fallback de imagem quando componente não tem imageUrl', () => {
    render(<ShareKitDialog open onOpenChange={vi.fn()} product={kitProduct} mode="separate" />);
    fireEvent.click(screen.getByText('Caderno').closest('button')!);
    // O preview deve ainda funcionar mesmo sem image_url (usa fallback da imagem principal)
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('ShareKitDialog - edge cases', () => {
  it('lida com kitItems vazio sem quebrar', () => {
    const emptyKit = { ...kitProduct, kitItems: [] } as Product;
    expect(() =>
      render(<ShareKitDialog open onOpenChange={vi.fn()} product={emptyKit} mode="complete" />),
    ).not.toThrow();
  });

  it('lida com kitItems undefined sem quebrar', () => {
    const noKit = { ...kitProduct, kitItems: undefined } as unknown as Product;
    expect(() =>
      render(<ShareKitDialog open onOpenChange={vi.fn()} product={noKit} mode="separate" />),
    ).not.toThrow();
  });
});
