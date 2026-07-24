import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ValidProductIdRoute } from './ValidProductIdRoute';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/produto/:id"
          element={
            <ValidProductIdRoute>
              <div data-testid="pdp">PDP</div>
            </ValidProductIdRoute>
          }
        />
        <Route path="/produtos" element={<div data-testid="produtos">Produtos</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ValidProductIdRoute', () => {
  it('redirects /produto/undefined to /produtos', () => {
    renderAt('/produto/undefined');
    expect(screen.getByTestId('produtos')).toBeInTheDocument();
    expect(screen.queryByTestId('pdp')).toBeNull();
  });

  it('redirects /produto/null to /produtos', () => {
    renderAt('/produto/null');
    expect(screen.getByTestId('produtos')).toBeInTheDocument();
  });

  it('redirects /produto/<non-uuid> to /produtos', () => {
    renderAt('/produto/abc-123');
    expect(screen.getByTestId('produtos')).toBeInTheDocument();
  });

  it('renders PDP for a valid UUID', () => {
    renderAt('/produto/11111111-2222-3333-4444-555555555555');
    expect(screen.getByTestId('pdp')).toBeInTheDocument();
    expect(screen.queryByTestId('produtos')).toBeNull();
  });
});
