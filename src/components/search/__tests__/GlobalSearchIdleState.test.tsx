import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GlobalSearchIdleState } from '../GlobalSearchIdleState';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter } from 'react-router-dom';
import { Command } from '@/components/ui/command';

describe('GlobalSearchIdleState Rendering', () => {
  const mockProps = {
    history: [],
    popularProducts: [
      {
        id: '1',
        name: 'Caneca Top',
        sku: 'CAN-001',
        view_count: 100,
        image_url: 'https://example.com/image.jpg',
        category_name: 'Cozinha'
      },
      {
        id: '2',
        name: 'Caneca Mid',
        sku: 'CAN-002',
        view_count: 50,
      }
    ],
    contextualSuggestions: [],
    quickSuggestions: [],
    routeContext: { section: '' },
    quickActionsData: [],
    onSuggestionClick: vi.fn(),
    onSelect: vi.fn(),
    onRemoveFromHistory: vi.fn(),
  };

  it('renders thumbnails for popular products', () => {
    render(
      <BrowserRouter>
        <TooltipProvider>
          <Command>
            <GlobalSearchIdleState {...mockProps} />
          </Command>
        </TooltipProvider>
      </BrowserRouter>
    );

    const img = screen.getByAltText('Caneca Top');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/image.jpg');
  });

  it('renders TOP 1 banner for the first item', () => {
    render(
      <BrowserRouter>
        <TooltipProvider>
          <Command>
            <GlobalSearchIdleState {...mockProps} />
          </Command>
        </TooltipProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/TOP 1/i)).toBeDefined();
  });

  it('renders RankBadge when image is missing', () => {
    const propsWith3 = {
      ...mockProps,
      popularProducts: [
        ...mockProps.popularProducts,
        { id: '3', name: 'Caneca Low', sku: 'CAN-003', view_count: 10 }
      ]
    };
    
    render(
      <BrowserRouter>
        <TooltipProvider>
          <Command>
            <GlobalSearchIdleState {...propsWith3} />
          </Command>
        </TooltipProvider>
      </BrowserRouter>
    );
    
    expect(screen.getByText('3º')).toBeDefined();
  });
});
