/**
 * Garante que clicar na logo do sidebar NÃO inicia o tour de onboarding
 * (apenas navega para "/"). O reinício do tour é exclusivo do botão
 * "Reiniciar Tour".
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SidebarBrandHeader } from '../SidebarBrandHeader';

const restartTour = vi.fn();

vi.mock('@/contexts/OnboardingContext', () => ({
  useOptionalOnboardingContext: () => ({ restartTour }),
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderAt(initial: string, collapsed = false) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SidebarBrandHeader isCollapsed={collapsed} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SidebarBrandHeader — logo click', () => {
  it('navega para "/" e NÃO chama restartTour (expanded)', () => {
    restartTour.mockClear();
    renderAt('/catalogo');
    const logo = screen.getByText('Promo Gifts');
    fireEvent.click(logo);
    expect(screen.getByTestId('loc').textContent).toBe('/');
    expect(restartTour).not.toHaveBeenCalled();
  });

  it('navega para "/" e NÃO chama restartTour (collapsed)', () => {
    restartTour.mockClear();
    const { container } = renderAt('/orcamentos', true);
    const logo = container.querySelector('[data-testid="sidebar-brand-header"] div')!;
    fireEvent.click(logo);
    expect(screen.getByTestId('loc').textContent).toBe('/');
    expect(restartTour).not.toHaveBeenCalled();
  });
});
