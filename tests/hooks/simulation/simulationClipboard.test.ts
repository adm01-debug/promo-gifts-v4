/**
 * Contract test for simulationClipboard.
 *
 * Locks in the computed `SimulationOption` shape consumed by the clipboard
 * helpers (techniqueName, colors, width/height, grandTotal, estimatedDays, …).
 * Guards against regressions of the type-drift that previously typed these
 * options with the wrong (document-shaped) `SimulationOption`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimulationOption, Product } from '@/types/simulation';

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/lib/format', () => ({ formatCurrency: (n: number) => `R$${n.toFixed(2)}` }));

import { copyOptionToClipboard, copyAllOptionsToClipboard } from '@/hooks/simulation/simulationClipboard';

const writeText = vi.fn().mockResolvedValue(undefined);

function makeOption(overrides: Partial<SimulationOption> = {}): SimulationOption {
  return {
    id: 'tech-silk-1',
    techniqueId: 'tech-silk',
    techniqueName: 'Serigrafia',
    techniqueCode: 'SILK',
    colors: 2,
    width: 10,
    height: 5,
    positions: 1,
    unitCost: 1,
    setupCost: 50,
    totalPersonalizationCost: 150,
    costPerUnit: 1.5,
    estimatedDays: 5,
    productUnitPrice: 10,
    totalProductCost: 1000,
    grandTotal: 1150,
    grandTotalPerUnit: 11.5,
    priceSource: 'rpc',
    calculatedAt: new Date('2026-01-01').toISOString(),
    rpcAvailable: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  Object.assign(navigator, { clipboard: { writeText } });
});

describe('copyOptionToClipboard', () => {
  it('serializes the computed option fields and resets copiedId after 2s', async () => {
    const setCopiedId = vi.fn();
    await copyOptionToClipboard(makeOption(), 100, setCopiedId);

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('Serigrafia');
    expect(text).toContain('Quantidade: 100 un.');
    expect(text).toContain('10 x 5 cm');
    expect(text).toContain('R$1150.00'); // grandTotal via mocked formatCurrency
    expect(text).toContain('~5 dias');

    expect(setCopiedId).toHaveBeenCalledWith('tech-silk-1');
    vi.advanceTimersByTime(2000);
    expect(setCopiedId).toHaveBeenLastCalledWith(null);
  });
});

describe('copyAllOptionsToClipboard', () => {
  it('sorts options by grandTotal ascending and includes the product header', async () => {
    const product = { id: 'p1', name: 'Caneca', sku: 'SKU1' } as Product;
    const expensive = makeOption({ id: 'b', techniqueName: 'Laser', grandTotal: 2000 });
    const cheap = makeOption({ id: 'a', techniqueName: 'Serigrafia', grandTotal: 500 });

    await copyAllOptionsToClipboard([expensive, cheap], product, 12.5, 100);

    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('Produto: Caneca (SKU1)');
    // cheaper option must appear before the expensive one
    expect(text.indexOf('Serigrafia')).toBeLessThan(text.indexOf('Laser'));
  });

  it('is a no-op when there are no options', async () => {
    await copyAllOptionsToClipboard([], undefined, 0, 0);
    expect(writeText).not.toHaveBeenCalled();
  });
});
