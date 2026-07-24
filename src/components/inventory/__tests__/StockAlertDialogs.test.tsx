import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { OutOfStockDialog, LowStockDialog } from '../StockAlertDialogs';
import type { StockAlert } from '@/types/stock';

// Radix Dialog usa pointer capture APIs ausentes no jsdom.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

const alert = (over: Partial<StockAlert> = {}): StockAlert => ({
  id: over.id ?? `a-${Math.random()}`,
  type: over.type ?? 'out_of_stock',
  severity: over.severity ?? 'error',
  productId: over.productId ?? 'p1',
  productName: over.productName ?? 'Caneca Branca',
  productSku: over.productSku ?? 'SKU-001',
  title: over.title ?? 'Sem estoque',
  message: over.message ?? 'Produto esgotado',
  currentStock: over.currentStock ?? 0,
  threshold: over.threshold ?? 10,
  createdAt: over.createdAt ?? '2026-06-15T00:00:00.000Z',
  ...over,
});

describe('OutOfStockDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não renderiza conteúdo quando open=false', () => {
    render(
      <OutOfStockDialog
        open={false}
        onOpenChange={vi.fn()}
        alerts={[alert()]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />,
    );
    expect(screen.queryByText('Alertas Críticos')).not.toBeInTheDocument();
  });

  it('renderiza título, badge com contagem e cards quando open=true', () => {
    render(
      <OutOfStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[
          alert({ id: 'a1', productName: 'Caneca X', type: 'out_of_stock' }),
          alert({ id: 'a2', productName: 'Caneta Y', type: 'out_of_stock' }),
        ]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Alertas Críticos')).toBeInTheDocument();
    expect(screen.getByText('Caneca X')).toBeInTheDocument();
    expect(screen.getByText('Caneta Y')).toBeInTheDocument();
    // badge no título + bloco "Alertas" do summary mostram "2"
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('exibe estado vazio quando não há alertas e desabilita "Limpar Todos"', () => {
    render(
      <OutOfStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Nenhum alerta crítico')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Dispensar todos os alertas críticos' }),
    ).toBeDisabled();
  });

  it('exibe a contagem de "Esgotados" no summary quando há out_of_stock', () => {
    render(
      <OutOfStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[alert({ id: 'a1', type: 'out_of_stock' })]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Esgotados')).toBeInTheDocument();
  });

  it('dispara onDismiss com o id do alerta ao clicar no X do card', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <OutOfStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[alert({ id: 'alvo', productName: 'Mochila Z' })]}
        onDismiss={onDismiss}
        onDismissAll={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Dispensar alerta de Mochila Z' }));
    expect(onDismiss).toHaveBeenCalledWith('alvo');
  });

  it('dispara onDismissAll ao clicar em "Limpar Todos"', async () => {
    const user = userEvent.setup();
    const onDismissAll = vi.fn();
    render(
      <OutOfStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[alert({ id: 'a1' })]}
        onDismiss={vi.fn()}
        onDismissAll={onDismissAll}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Dispensar todos os alertas críticos' }));
    expect(onDismissAll).toHaveBeenCalledTimes(1);
  });
});

describe('LowStockDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza título e estado vazio próprio quando não há alertas', () => {
    render(
      <LowStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Alertas de Estoque Baixo')).toBeInTheDocument();
    expect(screen.getByText('Nenhum alerta de estoque baixo')).toBeInTheDocument();
  });

  it('exibe a contagem de "Baixo" no summary para alertas low_stock/critical', () => {
    render(
      <LowStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[
          alert({ id: 'l1', type: 'low_stock', severity: 'warning', productName: 'Pen Drive' }),
          alert({ id: 'l2', type: 'critical', severity: 'warning', productName: 'Squeeze' }),
        ]}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Baixo')).toBeInTheDocument();
    expect(screen.getByText('Pen Drive')).toBeInTheDocument();
    expect(screen.getByText('Squeeze')).toBeInTheDocument();
  });

  it('dispara onDismissAll ao clicar em "Limpar Todos"', async () => {
    const user = userEvent.setup();
    const onDismissAll = vi.fn();
    render(
      <LowStockDialog
        open
        onOpenChange={vi.fn()}
        alerts={[alert({ id: 'l1', type: 'low_stock', severity: 'warning' })]}
        onDismiss={vi.fn()}
        onDismissAll={onDismissAll}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Dispensar todos os alertas de estoque baixo' }),
    );
    expect(onDismissAll).toHaveBeenCalledTimes(1);
  });
});
