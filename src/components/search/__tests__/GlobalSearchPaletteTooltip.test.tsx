import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GlobalSearchPalette } from '../GlobalSearchPalette';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeContext } from '@/contexts/ThemeContext';

// Mock useGlobalSearch
vi.mock('../useGlobalSearch', () => ({
  useGlobalSearch: () => ({
    open: false,
    setOpen: vi.fn(),
    handleOpenVoiceOverlay: vi.fn(),
    voiceOverlayOpen: false,
    results: [],
    query: '',
    setQuery: vi.fn(),
    handleSelect: vi.fn(),
  }),
}));

const mockThemeContext = {
  theme: 'dark' as const,
  setTheme: vi.fn(),
  tooltipStyle: 'compact' as const,
  setTooltipStyle: vi.fn(),
};

describe('GlobalSearchPalette Tooltip', () => {
  it('renders the correct tooltip text "Fale com o Flow"', async () => {
    render(
      <ThemeContext.Provider value={mockThemeContext as any}>
        <TooltipProvider delayDuration={0}>
          <GlobalSearchPalette />
        </TooltipProvider>
      </ThemeContext.Provider>
    );

    const trigger = screen.getByLabelText(/Microfone/i);
    
    // Hover over the trigger
    fireEvent.mouseEnter(trigger);

    // Tooltip should be visible
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Fale com o Flow');
      expect(tooltip).toHaveTextContent('Ctrl+Shift+V');
    });
  });

  it('renders the correct tooltip text on focus', async () => {
    render(
      <ThemeContext.Provider value={mockThemeContext as any}>
        <TooltipProvider delayDuration={0}>
          <GlobalSearchPalette />
        </TooltipProvider>
      </ThemeContext.Provider>
    );

    const trigger = screen.getByLabelText(/Microfone/i);
    
    // Focus the trigger
    fireEvent.focus(trigger);

    // Tooltip should be visible
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Fale com o Flow');
    });
  });
});
