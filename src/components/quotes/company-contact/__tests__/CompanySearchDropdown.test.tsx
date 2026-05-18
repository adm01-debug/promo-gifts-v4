import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompanySearchDropdown } from '../CompanySearchDropdown';
import { useQuery } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSearchHistory } from '@/hooks/useSearchHistory';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/hooks/useSearchHistory', () => ({
  useSearchHistory: vi.fn(),
}));

vi.mock('@/lib/crm-db', () => ({
  selectCrm: vi.fn().mockResolvedValue([]),
  searchCrm: vi.fn().mockResolvedValue([]),
}));

const mockCompanies = [
  { id: '1', name: 'Alpha Corp', razao_social: 'Alpha S.A.', cnpj: '111', logo_url: null },
  { id: '2', name: 'Beta Solutions', razao_social: 'Beta Ltda', cnpj: '222', logo_url: null },
];

const mockHistory = [
  { id: '1', label: 'Alpha Corp', type: 'company', metadata: { cnpj: '111' }, timestamp: Date.now() },
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
      />
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
      />
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

  it('should highlight the selected company in history and regular list', async () => {
    render(
      <CompanySearchDropdown
        companyId="1" // Alpha is selected
        selectedCompany={null} // Not showing the "selected" state card to keep dropdown open
        onSelectCompany={vi.fn()}
        onClearCompany={vi.fn()}
      />
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
      />
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
});
