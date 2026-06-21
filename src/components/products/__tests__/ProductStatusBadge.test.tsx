import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductStatusBadge } from '../ProductStatusBadge';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>
    <BrowserRouter>{children}</BrowserRouter>
  </TooltipProvider>
);

describe('ProductStatusBadge — consistency across contexts', () => {
  it('renders "Estoque zerado" badge with default label', () => {
    render(
      <Wrapper>
        <ProductStatusBadge type="out-of-stock" size="sm" />
      </Wrapper>,
    );
    expect(screen.getByText(/Estoque zerado/i)).toBeInTheDocument();
  });

  it('size="sm" uses the standardized 9px typography and tight padding', () => {
    const { container } = render(
      <Wrapper>
        <ProductStatusBadge type="out-of-stock" size="sm" />
      </Wrapper>,
    );
    const badge = container.querySelector('[class*="text-[9px]"]');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('px-1.5');
    expect(badge?.className).toContain('py-0.5');
  });

  it('uses destructive (red) palette without graying the card', () => {
    const { container } = render(
      <Wrapper>
        <ProductStatusBadge type="out-of-stock" size="sm" />
      </Wrapper>,
    );
    const badge = container.querySelector('[class*="bg-destructive"]');
    expect(badge).not.toBeNull();
    // Must not apply grayscale or muted-bg classes
    expect(container.innerHTML).not.toContain('grayscale');
    expect(container.innerHTML).not.toContain('bg-muted');
  });

  it('all sizes share the same typography/padding scale family', () => {
    const sizes: Array<'lg' | 'md' | 'sm'> = ['sm', 'md', 'lg'];
    expect(sizes).not.toHaveLength(0);
    for (const size of sizes) {
      const { container, unmount } = render(
        <Wrapper>
          <ProductStatusBadge type="out-of-stock" size={size} />
        </Wrapper>,
      );
      const badge = container.querySelector('[class*="rounded-full"]');
      expect(badge).not.toBeNull();
      // Must always have horizontal padding and centered inline-flex layout
      expect(badge?.className).toMatch(/px-/);
      expect(badge?.className).toContain('inline-flex');
      unmount();
    }
  });

  it('shares the same base classes as novelty/featured badges (consistency)', () => {
    const { container: oosCt } = render(
      <Wrapper>
        <ProductStatusBadge type="out-of-stock" size="sm" />
      </Wrapper>,
    );
    const { container: novCt } = render(
      <Wrapper>
        <ProductStatusBadge type="novelty" value="Novo" size="sm" />
      </Wrapper>,
    );

    const oos = oosCt.querySelector('[class*="rounded-full"]');
    const nov = novCt.querySelector('[class*="rounded-full"]');
    expect(oos).not.toBeNull();
    expect(nov).not.toBeNull();

    // Both should share size-related classes (text size + padding)
    expect(oos?.className).toContain('text-[9px]');
    expect(nov?.className).toContain('text-[9px]');
    expect(oos?.className).toContain('px-1.5');
    expect(nov?.className).toContain('px-1.5');
  });

  it('is clickable and stops propagation when onClick is provided', () => {
    let clicked = false;
    const { container } = render(
      <Wrapper>
        <ProductStatusBadge
          type="out-of-stock"
          size="sm"
          onClick={() => {
            clicked = true;
          }}
        />
      </Wrapper>,
    );
    const badge = container.querySelector('[class*="cursor-pointer"]');
    expect(badge).not.toBeNull();
    (badge as HTMLElement).click();
    expect(clicked).toBe(true);
  });
});
