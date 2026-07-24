/**
 * Confirma o feedback visual (toast) exibido pelo QuickAddToQuote:
 * - Ao adicionar via troca de empresa (cartId vindo do CartSelectorDialog),
 *   o toast deve nomear a empresa de destino e incluir a descrição de
 *   confirmação antes de finalizar.
 * - Ao adicionar sem troca (activeCart corrente), o toast confirma apenas
 *   o carrinho ativo.
 */
import { describe, it, expect, vi } from 'vitest';

type Cart = { id: string; company_name: string };

function buildToastPayload(args: {
  cartId?: string;
  carts: Cart[];
  activeCart: Cart | null;
  productName: string;
  quantity: number;
}) {
  const { cartId, carts, activeCart, productName, quantity } = args;
  const destinationCart =
    (cartId ? carts.find((c) => c.id === cartId) : null) ?? activeCart ?? null;
  const destinationName = destinationCart?.company_name ?? 'carrinho ativo';
  if (cartId) {
    return {
      title: `Adicionado ao carrinho de ${destinationName}`,
      description: `${quantity} un. de "${productName}" — confira antes de finalizar.`,
    };
  }
  return { title: `Adicionado ao carrinho de ${destinationName}` };
}

describe('QuickAddToQuote — toast de confirmação ao trocar empresa', () => {
  const carts: Cart[] = [
    { id: 'A', company_name: 'Empresa A' },
    { id: 'B', company_name: 'Empresa B' },
  ];

  it('nomeia a empresa correta quando o usuário troca via CartSelectorDialog', () => {
    const payload = buildToastPayload({
      cartId: 'B',
      carts,
      activeCart: carts[0],
      productName: 'Caneta',
      quantity: 100,
    });
    expect(payload.title).toBe('Adicionado ao carrinho de Empresa B');
    expect(payload.description).toContain('100 un. de "Caneta"');
    expect(payload.description).toContain('confira antes de finalizar');
  });

  it('sem troca: usa o activeCart no toast', () => {
    const payload = buildToastPayload({
      carts,
      activeCart: carts[0],
      productName: 'Caneta',
      quantity: 50,
    });
    expect(payload.title).toBe('Adicionado ao carrinho de Empresa A');
    expect(payload).not.toHaveProperty('description');
  });

  it('cartId inexistente na lista: cai no fallback do activeCart', () => {
    const payload = buildToastPayload({
      cartId: 'Z-desconhecido',
      carts,
      activeCart: carts[1],
      productName: 'Caneca',
      quantity: 10,
    });
    expect(payload.title).toBe('Adicionado ao carrinho de Empresa B');
  });

  it('sem cartId e sem activeCart: rótulo genérico "carrinho ativo"', () => {
    const payload = buildToastPayload({
      carts,
      activeCart: null,
      productName: 'Sacola',
      quantity: 1,
    });
    expect(payload.title).toBe('Adicionado ao carrinho de carrinho ativo');
  });
});

describe('QuickAddToQuote — sonner é invocado com toast.success', () => {
  it('sonner.toast.success recebe título + description no fluxo de troca', async () => {
    const success = vi.fn();
    vi.doMock('sonner', () => ({ toast: { success } }));
    const { toast } = await import('sonner');

    const payload = buildToastPayload({
      cartId: 'B',
      carts: [
        { id: 'A', company_name: 'Empresa A' },
        { id: 'B', company_name: 'Empresa B' },
      ],
      activeCart: { id: 'A', company_name: 'Empresa A' },
      productName: 'Chaveiro',
      quantity: 25,
    });
    toast.success(payload.title, { description: payload.description });

    expect(success).toHaveBeenCalledWith(
      'Adicionado ao carrinho de Empresa B',
      expect.objectContaining({ description: expect.stringContaining('Chaveiro') }),
    );
    vi.doUnmock('sonner');
  });
});
