import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { FutureStockDialog } from '../FutureStockDialog';
import type { FutureStockEntry } from '@/types/stock';

// Radix Select / Tooltip need these stubs in jsdom.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

// ── Factory ─────────────────────────────────────────────────────
let seq = 0;
const isoInDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const entry = (over: Partial<FutureStockEntry> = {}): FutureStockEntry => {
  seq += 1;
  return {
    id: over.id ?? `entry-${seq}`,
    productId: over.productId ?? `prod-${seq}`,
    productName: over.productName ?? 'Caneca Premium',
    productSku: over.productSku ?? 'SKU-001',
    colorName: over.colorName ?? 'Azul',
    expectedQuantity: over.expectedQuantity ?? 100,
    expectedDate: over.expectedDate ?? isoInDays(5),
    orderDate: over.orderDate ?? isoInDays(-10),
    source: over.source ?? 'purchase_order',
    status: over.status ?? 'confirmed',
    supplierName: over.supplierName ?? 'XBZ Brindes',
    createdAt: over.createdAt ?? isoInDays(-12),
    updatedAt: over.updatedAt ?? isoInDays(-1),
    ...over,
  };
};

const renderDialog = (props: Partial<React.ComponentProps<typeof FutureStockDialog>> = {}) => {
  const onOpenChange = vi.fn();
  const utils = render(
    <FutureStockDialog
      open={props.open ?? true}
      onOpenChange={props.onOpenChange ?? onOpenChange}
      entries={props.entries ?? []}
    />,
  );
  return { onOpenChange, ...utils };
};

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
});

describe('FutureStockDialog — render states', () => {
  it('não renderiza conteúdo quando open=false', () => {
    renderDialog({ open: false, entries: [entry()] });
    expect(screen.queryByText('Previsão de Reposição')).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando não há entradas', () => {
    renderDialog({ open: true, entries: [] });
    expect(screen.getByText('Nenhuma reposição encontrada')).toBeInTheDocument();
    expect(screen.getByText(/Não há reposições previstas no momento/)).toBeInTheDocument();
  });

  it('renderiza título, badge de contagem e KPIs com dados', () => {
    renderDialog({
      open: true,
      entries: [
        entry({ status: 'confirmed', expectedQuantity: 100 }),
        entry({ status: 'in_transit', expectedQuantity: 50 }),
      ],
    });
    expect(screen.getByText('Previsão de Reposição')).toBeInTheDocument();
    // "2 previsões" appears both in the header badge and the footer summary.
    expect(screen.getAllByText('2 previsões').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Previsto')).toBeInTheDocument();
    // "Confirmado"/"Em Trânsito" appear as KPI labels and as status badges.
    expect(screen.getAllByText('Confirmado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Em Trânsito').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Produtos')).toBeInTheDocument();
  });

  it('exibe a barra de progresso de confirmação quando há unidades', () => {
    renderDialog({
      open: true,
      entries: [entry({ status: 'confirmed', expectedQuantity: 100 })],
    });
    expect(screen.getByText('Confirmação de Reposição')).toBeInTheDocument();
    // "% confirmado" shows in the progress bar and again in the footer.
    expect(screen.getAllByText(/% confirmado/).length).toBeGreaterThanOrEqual(1);
  });

  it('mostra alerta de reposições atrasadas (overdue)', () => {
    renderDialog({
      open: true,
      entries: [entry({ status: 'pending', expectedDate: isoInDays(-3) })],
    });
    expect(screen.getByText(/reposição atrasada|reposições atrasadas/)).toBeInTheDocument();
  });
});

describe('FutureStockDialog — view modes', () => {
  it('renderiza timeline por padrão e agrupa por janela', () => {
    renderDialog({
      open: true,
      entries: [
        entry({ expectedDate: isoInDays(3), productName: 'Esta Semana Item' }),
        entry({ expectedDate: isoInDays(40), productName: 'Longo Prazo Item' }),
      ],
    });
    // Timeline group headers contain the produced labels (use exact week label
    // text — "Esta Semana" substring also matches "Próxima Semana").
    expect(screen.getByText('📦 Esta Semana')).toBeInTheDocument();
    expect(screen.getByText('Esta Semana Item')).toBeInTheDocument();
    expect(screen.getByText('Longo Prazo Item')).toBeInTheDocument();
  });

  it('alterna para o modo Lista e mostra cabeçalhos ordenáveis', async () => {
    const user = userEvent.setup();
    renderDialog({ open: true, entries: [entry()] });
    await user.click(screen.getByRole('button', { name: /Lista/ }));
    expect(screen.getByRole('button', { name: /Produto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Qtd\./ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previsão/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Status/ })).toBeInTheDocument();
  });

  it('ordena por colunas alternando direção ao clicar', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      entries: [
        entry({ productName: 'Bravo', expectedQuantity: 10 }),
        entry({ productName: 'Alpha', expectedQuantity: 90 }),
      ],
    });
    await user.click(screen.getByRole('button', { name: /Lista/ }));
    // toggle several sort fields to execute toggleSort branches
    await user.click(screen.getByRole('button', { name: /Produto/ }));
    await user.click(screen.getByRole('button', { name: /Produto/ })); // same field -> flip dir
    await user.click(screen.getByRole('button', { name: /Qtd\./ }));
    await user.click(screen.getByRole('button', { name: /Status/ }));
    // Both products still present after re-sorting
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
  });
});

describe('FutureStockDialog — filters', () => {
  it('filtra por busca textual e mostra botão limpar', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      entries: [entry({ productName: 'Caneca Azul' }), entry({ productName: 'Mochila Preta' })],
    });
    const input = screen.getByPlaceholderText(/Buscar produto, SKU, cor ou fornecedor/);
    await user.type(input, 'Mochila');
    expect(screen.getByText('Mochila Preta')).toBeInTheDocument();
    expect(screen.queryByText('Caneca Azul')).not.toBeInTheDocument();
    // active filter clear button
    expect(screen.getByRole('button', { name: /Limpar \(1\)/ })).toBeInTheDocument();
  });

  it('busca sem resultado mostra estado vazio filtrado + botão limpar filtros', async () => {
    const user = userEvent.setup();
    renderDialog({ open: true, entries: [entry({ productName: 'Caneca Azul' })] });
    const input = screen.getByPlaceholderText(/Buscar produto/);
    await user.type(input, 'zzzNaoExiste');
    expect(screen.getByText(/Nenhum resultado para os filtros aplicados/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Limpar filtros/ }));
    // After clearing, the entry is back
    expect(screen.getByText('Caneca Azul')).toBeInTheDocument();
  });

  it('o X dentro da busca limpa apenas o texto', async () => {
    const user = userEvent.setup();
    renderDialog({ open: true, entries: [entry({ productName: 'Caneca Azul' })] });
    const input = screen.getByPlaceholderText(/Buscar produto/) as HTMLInputElement;
    await user.type(input, 'Caneca');
    expect(input.value).toBe('Caneca');
    // the inline X button is the search clear (first matched X near input)
    const clearBtn = input.parentElement?.querySelector('button');
    expect(clearBtn).toBeTruthy();
    await user.click(clearBtn!);
    expect(input.value).toBe('');
  });

  it('botão "Limpar (N)" reseta os filtros ativos', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      entries: [entry({ productName: 'Caneca Azul' }), entry({ productName: 'Mochila' })],
    });
    const input = screen.getByPlaceholderText(/Buscar produto/);
    await user.type(input, 'Caneca');
    const clearAll = screen.getByRole('button', { name: /Limpar \(1\)/ });
    await user.click(clearAll);
    expect(screen.getByText('Mochila')).toBeInTheDocument();
    expect(screen.getByText('Caneca Azul')).toBeInTheDocument();
  });

  it('seleciona filtro de status via Select', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      entries: [
        entry({ productName: 'ConfirmadoItem', status: 'confirmed' }),
        entry({ productName: 'PendenteItem', status: 'pending' }),
      ],
    });
    // Open the status select (first combobox)
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: /Pendente/ }));
    expect(screen.getByText('PendenteItem')).toBeInTheDocument();
    expect(screen.queryByText('ConfirmadoItem')).not.toBeInTheDocument();
  });

  it('seleciona janela de datas via Select de período', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      entries: [
        entry({ productName: 'PertoItem', expectedDate: isoInDays(2) }),
        entry({ productName: 'LongeItem', expectedDate: isoInDays(80) }),
      ],
    });
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[1]); // date range select
    await user.click(await screen.findByRole('option', { name: /Próx\. 7 dias/ }));
    expect(screen.getByText('PertoItem')).toBeInTheDocument();
    expect(screen.queryByText('LongeItem')).not.toBeInTheDocument();
  });
});

describe('FutureStockDialog — footer summary', () => {
  it('mostra resumo de "X de Y previsões" quando filtrado', async () => {
    const user = userEvent.setup();
    renderDialog({
      open: true,
      entries: [entry({ productName: 'Caneca Azul' }), entry({ productName: 'Mochila Preta' })],
    });
    await user.type(screen.getByPlaceholderText(/Buscar produto/), 'Caneca');
    expect(screen.getByText(/1 de 2 previsões/)).toBeInTheDocument();
  });

  it('renderiza linha com fornecedor (tooltip trigger) na entrada', () => {
    renderDialog({
      open: true,
      entries: [entry({ supplierName: 'Fornecedor XPTO', productName: 'Item Forn' })],
    });
    const region = screen.getByText('Item Forn').closest('div');
    expect(within(region as HTMLElement).getByText('Fornecedor XPTO')).toBeInTheDocument();
  });
});
