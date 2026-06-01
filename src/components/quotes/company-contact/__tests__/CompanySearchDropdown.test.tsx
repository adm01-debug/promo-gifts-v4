import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompanySearchDropdown } from '../CompanySearchDropdown';
import { useQuery } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSearchHistory } from '@/hooks/common';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/hooks/common', () => ({
  useSearchHistory: vi.fn(),
}));

vi.mock('@/lib/crm-db', () => ({
  selectCrm: vi.fn().mockResolvedValue([]),
  searchCrm: vi.fn().mockResolvedValue([]),
}));

const mockCompanies = [
  { id: '1', name: 'Alpha Corp', razao_social: 'Alpha S.A.', cnpj: '111', logo_url: null },
  { id: '2', name: 'Beta Solutions', razao_social: 'Beta Ltda', cnpj: '222', logo_url: null },
  { id: '3', name: 'Gamma Ltd', razao_social: 'Gamma Ltda', cnpj: '333', logo_url: null },
];

const mockHistory = [
  {
    id: '1',
    label: 'Alpha Corp',
    type: 'company',
    metadata: { cnpj: '111' },
    timestamp: Date.now(),
  },
  {
    id: '2',
    label: 'Beta Solutions',
    type: 'company',
    metadata: { cnpj: '22.222.222/0001-22' },
    timestamp: Date.now(),
  },
];

describe('CompanySearchDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useQuery as any).mockReturnValue({
      data: mockCompanies,
      isLoading: false,
    });

    (useSearchHistory as any).mockReturnValue({
      history: mockHistory,
      addToHistory: vi.fn(),
      removeFromHistory: vi.fn(),
      clearHistory: vi.fn(),
    });
  });

  it('should render history section when opening with no search term', async () => {
    render(
      <CompanySearchDropdown
        companyId=""
        selectedCompany={null}
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />,
    );

    const input = screen.getByTestId('company-search-input');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByTestId('search-history-section')).toBeInTheDocument();
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
    });
  });

  it('should prioritize history matches when searching', async () => {
    render(
      <CompanySearchDropdown
        companyId=""
        selectedCompany={null}
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />,
    );

    const input = screen.getByTestId('company-search-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Alpha' } });

    // The component should show history matches first
    // In our implementation, we filter history and add it to seen
    // If it matches history, it appears at the top
    await waitFor(() => {
      const results = screen.getAllByRole('button');
      // "Sem empresa" is first, then history match, then others
      expect(results[1]).toHaveTextContent('Alpha Corp');
    });
  });

  it('should filter and prioritize history matches when searching by CNPJ', async () => {
    render(
      <CompanySearchDropdown
        companyId=""
        selectedCompany={null}
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />,
    );

    const input = screen.getByTestId('company-search-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '111' } }); // CNPJ of Alpha Corp in history

    await waitFor(() => {
      const results = screen.getAllByRole('button');
      // Should find Alpha Corp via history CNPJ match
      expect(results[1]).toHaveTextContent('Alpha Corp');
      expect(results[1]).toHaveTextContent('111');
    });
  });

  it('should filter correctly by partial CNPJ, masked/unmasked and show only regular results for non-history items', async () => {
    render(
      <CompanySearchDropdown
        companyId=""
        selectedCompany={null}
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />,
    );

    const input = screen.getByTestId('company-search-input');
    fireEvent.focus(input);

    // 1. Partial CNPJ search (company 1: "111", search for "11")
    fireEvent.change(input, { target: { value: '11' } });
    await waitFor(() => {
      expect(screen.getByTestId('company-option-1')).toBeInTheDocument();
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
    });

    // 2. Masked CNPJ search (company 2 in history has mask)
    fireEvent.change(input, { target: { value: '22.222' } });
    await waitFor(() => {
      expect(screen.getByTestId('company-option-2')).toBeInTheDocument();
      expect(screen.getByText('Beta Solutions')).toBeInTheDocument();
    });

    // 3. Unmasked CNPJ search (company 2 digits only)
    fireEvent.change(input, { target: { value: '22222' } });
    await waitFor(() => {
      expect(screen.getByTestId('company-option-2')).toBeInTheDocument();
    });

    // 4. CNPJ not in history (company 3: "333")
    fireEvent.change(input, { target: { value: '333' } });
    await waitFor(() => {
      expect(screen.getByTestId('company-option-3')).toBeInTheDocument();
    });
  });

  it('should highlight the selected company in history and regular list', async () => {
    render(
      <CompanySearchDropdown
        companyId="1" // Alpha is selected
        selectedCompany={null} // Not showing the "selected" state card to keep dropdown open
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />,
    );

    const input = screen.getByTestId('company-search-input');
    fireEvent.focus(input);

    await waitFor(() => {
      const alphaHistoryItem = screen.getByTestId('history-item-1');
      expect(alphaHistoryItem).toHaveClass('bg-primary/10');
      expect(alphaHistoryItem).toHaveClass('border-l-primary');
    });
  });

  it('should maintain highlight after clearing search', async () => {
    render(
      <CompanySearchDropdown
        companyId="1"
        selectedCompany={null}
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />,
    );

    const input = screen.getByTestId('company-search-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'NonExistent' } });

    await waitFor(() => {
      expect(screen.queryByTestId('history-item-1')).not.toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      const alphaHistoryItem = screen.getByTestId('history-item-1');
      expect(alphaHistoryItem).toBeInTheDocument();
      expect(alphaHistoryItem).toHaveClass('bg-primary/10');
    });
  });

  it('should maintain highlighted state and show history while loading new results', async () => {
    // 1. Setup mock to simulate slow search
    (useQuery as any).mockImplementation((options: any) => {
      if (options.queryKey[0] === 'quote-companies-search') {
        return { data: [], isLoading: true }; // Always loading
      }
      return { data: mockCompanies, isLoading: false };
    });

    render(
      <CompanySearchDropdown
        companyId="1"
        selectedCompany={null}
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />,
    );

    const input = screen.getByTestId('company-search-input');
    fireEvent.focus(input);

    // Initial state: show history
    await waitFor(() => {
      expect(screen.getByTestId('search-history-section')).toBeInTheDocument();
    });

    // 2. Type to trigger search (which will be "loading" based on our mock)
    fireEvent.change(input, { target: { value: 'Alpha' } });

    // History match for 'Alpha' should still be visible and highlighted while server results are "loading"
    // Note: When searching, history items are merged into the main list if they match
    await waitFor(() => {
      const alphaItem = screen.getByTestId('company-option-1');
      expect(alphaItem).toBeInTheDocument();
      expect(alphaItem).toHaveClass('bg-primary/10');
      expect(screen.getByText('servidor...')).toBeInTheDocument();
    });
  });
});
