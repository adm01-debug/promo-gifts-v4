import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalSearchPalette } from '../GlobalSearchPalette';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter } from 'react-router-dom';
import { ThemeContext } from '@/contexts/ThemeContext';

const mockHandleSelect = vi.fn();

// Mock useGlobalSearch
vi.mock('../useGlobalSearch', () => ({
  useGlobalSearch: () => ({
    open: true,
    setOpen: vi.fn(),
    handleOpenVoiceOverlay: vi.fn(),
    voiceOverlayOpen: false,
    results: [
      { id: 'res-1', title: 'Result 1', href: '/product/1', type: 'product' },
      { id: 'res-2', title: 'Result 2', href: '/product/2', type: 'product' },
    ],
    query: '',
    setQuery: vi.fn(),
    handleSelect: mockHandleSelect,
    groupedResults: {
      product: [
        { id: 'res-1', title: 'Result 1', href: '/product/1', type: 'product' },
        { id: 'res-2', title: 'Result 2', href: '/product/2', type: 'product' },
      ],
    },
  }),
}));

const mockThemeContext = {
  theme: 'dark' as const,
  setTheme: vi.fn(),
  tooltipStyle: 'compact' as const,
  setTooltipStyle: vi.fn(),
};

describe('GlobalSearchPalette Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers handleSelect when pressing 1', () => {
    render(
      <ThemeContext.Provider
        value={mockThemeContext as unknown as React.ContextType<typeof ThemeContext>}
      >
        <BrowserRouter>
          <TooltipProvider>
            <GlobalSearchPalette />
          </TooltipProvider>
        </BrowserRouter>
      </ThemeContext.Provider>,
    );

    // Simulate keydown '1' on document
    fireEvent.keyDown(document, { key: '1', code: 'Digit1' });

    expect(mockHandleSelect).toHaveBeenCalledWith('/product/1');
  });

  it('triggers handleSelect when pressing 2', () => {
    render(
      <ThemeContext.Provider
        value={mockThemeContext as unknown as React.ContextType<typeof ThemeContext>}
      >
        <BrowserRouter>
          <TooltipProvider>
            <GlobalSearchPalette />
          </TooltipProvider>
        </BrowserRouter>
      </ThemeContext.Provider>,
    );

    // Simulate keydown '2' on document
    fireEvent.keyDown(document, { key: '2', code: 'Digit2' });

    expect(mockHandleSelect).toHaveBeenCalledWith('/product/2');
  });
});
