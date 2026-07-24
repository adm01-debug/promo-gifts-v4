import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuoteItems } from '@/hooks/quotes/useQuoteItems';

type QuoteProduct = Parameters<ReturnType<typeof useQuoteItems>['addProductWithColor']>[0];

/**
 * Adicionar um produto pela busca deve respeitar a quantidade mínima de pedido
 * do fornecedor (B2B). Antes a qty inicial era sempre 1, permitindo enviar
 * orçamentos com quantidade inviável para produtos com mínimo de 50/100.
 */
describe('useQuoteItems — quantidade mínima de pedido', () => {
  it('usa minQuantity como quantidade inicial ao adicionar via busca', () => {
    const { result } = renderHook(() => useQuoteItems());

    const product = {
      id: 'prod-min-100',
      name: 'Caneta Personalizada',
      sku: 'CAN-100',
      price: 2.5,
      images: [],
      minQuantity: 100,
    } satisfies QuoteProduct;

    act(() => {
      result.current.addProductWithColor(product, null);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(100);
  });

  it('cai para 1 quando o produto não tem minQuantity', () => {
    const { result } = renderHook(() => useQuoteItems());

    const product = {
      id: 'prod-no-min',
      name: 'Brinde Avulso',
      sku: 'AVL-1',
      price: 10,
      images: [],
    } satisfies QuoteProduct;

    act(() => {
      result.current.addProductWithColor(product, null);
    });

    expect(result.current.items[0].quantity).toBe(1);
  });

  it('nunca inicia abaixo de 1, mesmo com minQuantity inválido (0)', () => {
    const { result } = renderHook(() => useQuoteItems());

    const product = {
      id: 'prod-min-0',
      name: 'Produto',
      sku: 'P-0',
      price: 5,
      images: [],
      minQuantity: 0,
    } satisfies QuoteProduct;

    act(() => {
      result.current.addProductWithColor(product, null);
    });

    expect(result.current.items[0].quantity).toBe(1);
  });

  it('cliques subsequentes incrementam de 1 em 1 a partir do mínimo', () => {
    const { result } = renderHook(() => useQuoteItems());

    const product = {
      id: 'prod-min-50',
      name: 'Squeeze',
      sku: 'SQZ-50',
      price: 8,
      images: [],
      minQuantity: 50,
    } satisfies QuoteProduct;

    act(() => {
      result.current.addProductWithColor(product, null);
    });
    act(() => {
      result.current.addProductWithColor(product, null);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(51);
  });
});
