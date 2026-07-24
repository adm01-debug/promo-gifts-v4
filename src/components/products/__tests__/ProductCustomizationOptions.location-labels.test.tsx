/**
 * Garante o layout clean dos 3 botões de Local de gravação:
 *  - sem subtítulo "Lado único"
 *  - sem "Volta toda"
 *  - botão circular exibe "CIRCULAR 360°"
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductCustomizationOptions } from '../ProductCustomizationOptions';

vi.mock('@/hooks/products/useProductCustomizationOptions', () => ({
  useProductCustomizationOptions: () => ({
    data: {
      locations: [
        { location_code: 'LADO_A', location_name: 'LADO A', options: [] },
        { location_code: 'LADO_B', location_name: 'LADO B', options: [] },
        { location_code: 'CIRCULAR', location_name: 'CIRCULAR', options: [] },
      ],
      techniques: [],
      sizes: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../customization/LocationPanel', () => ({
  LocationPanel: () => null,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ProductCustomizationOptions — rótulos clean dos locais', () => {
  it('não renderiza "Lado único" nem "Volta toda"', () => {
    renderWithClient(<ProductCustomizationOptions productId="p1" />);
    expect(screen.queryByText(/Lado único/i)).toBeNull();
    expect(screen.queryByText(/Volta toda/i)).toBeNull();
  });

  it('renderiza LADO A, LADO B e CIRCULAR 360°', () => {
    renderWithClient(<ProductCustomizationOptions productId="p1" />);
    expect(screen.getByRole('button', { name: /LADO A/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /LADO B/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /CIRCULAR 360°/i })).toBeTruthy();
  });
});
