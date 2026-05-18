
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProductCustomizationOptions } from './ProductCustomizationOptions';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock dependencies
vi.mock('@/hooks/useProductCustomizationOptions', () => ({
  useProductCustomizationOptions: () => ({
    data: {
      locations: [
        {
          location_code: 'LADO-A',
          location_name: 'Lado A',
          options: []
        }
      ]
    },
    isLoading: false
  })
}));

vi.mock('./LocationPanel', () => ({
  LocationPanel: () => <div data-testid="location-panel" />
}));

describe('ProductCustomizationOptions', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TooltipProvider>
        <ProductCustomizationOptions 
          productId="test-prod" 
          quantity={100} 
        />
      </TooltipProvider>
    );
    expect(container).toBeDefined();
  });
});
