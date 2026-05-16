
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthBrandingPanel } from './AuthBranding';
import { BrowserRouter } from 'react-router-dom';

// Mock components and icons
vi.mock('lucide-react', () => ({
  Rocket: () => <div />,
  Gift: () => <div />,
  Package: () => <div />,
  Factory: () => <div />,
  SlidersHorizontal: () => <div />,
  Brain: () => <div />,
  CheckCircle2: () => <div />,
  RotateCw: () => <div />,
}));

vi.mock('@/components/layout/AppLogo', () => ({
  AppLogo: () => <div data-testid="app-logo" />,
}));

vi.mock('./AuthBranding', async () => {
  const actual = await vi.importActual('./AuthBranding') as any;
  return {
    ...actual,
    ContinuousRockets: () => <div data-testid="rockets" />,
  };
});

describe('AuthBrandingPanel Visual Classes', () => {
  it('has correct responsive width and margin classes on the grid container', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>
    );
    
    const grid = container.querySelector('.grid-cols-2');
    expect(grid).toBeInTheDocument();
    
    const classes = grid?.className || '';
    expect(classes).toContain('w-[95%]');
    expect(classes).toContain('lg:w-[105%]');
    expect(classes).toContain('xl:w-[110%]');
    expect(classes).toContain('-mx-[2.5%]');
    expect(classes).toContain('lg:-mx-[2.5%]');
    expect(classes).toContain('xl:-mx-[5%]');
  });

  it('has correct padding and gap classes', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>
    );
    
    const grid = container.querySelector('.grid-cols-2');
    expect(grid?.className).toContain('gap-4');
    expect(grid?.className).toContain('sm:gap-5');
    
    const cards = container.querySelectorAll('.rounded-2xl');
    cards.forEach(card => {
      expect(card.className).toContain('px-6');
      expect(card.className).toContain('h-[99px]');
    });
  });

  it('is visible on all screens with responsive width', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>
    );
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('flex');
    expect(mainDiv.className).not.toContain('hidden');
    expect(mainDiv.className).toContain('w-full');
    expect(mainDiv.className).toContain('lg:w-1/2');
  });

});
