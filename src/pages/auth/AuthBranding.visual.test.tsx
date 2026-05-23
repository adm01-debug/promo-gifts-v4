
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthBrandingPanel } from "@/pages/auth/AuthBranding";
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
    // Layout atual do painel: grid full-width, sem overflow lateral (-mx) do design antigo.
    expect(classes).toContain('w-full');
  });

  it('has correct padding and gap classes', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>
    );
    
    const grid = container.querySelector('.grid-cols-2');
    expect(grid?.className).toContain('gap-3');
    expect(grid?.className).toContain('sm:gap-5');
    
    const cards = container.querySelectorAll('.rounded-3xl');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach(card => {
      expect(card.className).toContain('px-5');
      expect(card.className).toContain('h-[88px]');
    });
  });

  it('is visible on all screens with responsive width', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthBrandingPanel />
      </BrowserRouter>
    );
    
    const mainDiv = container.firstChild as HTMLElement;
    const classes = mainDiv.className.split(' ');
    expect(classes).toContain('flex');
    expect(classes).not.toContain('hidden');
    expect(classes).toContain('w-full');
    expect(classes).toContain('lg:w-1/2');
  });

});
