import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EdgeFallback } from '../EdgeFallback';

vi.mock('@/hooks/admin', () => ({
  useDevGate: () => ({ isAllowed: false, isLoading: false, allowedRoles: [] }),
}));

describe('<EdgeFallback />', () => {
  it('renderiza a variante error com role=alert e mensagem sanitizada', () => {
    render(
      <EdgeFallback
        variant="error"
        error={new Error('Failed to fetch')}
        onRetry={() => {}}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // sanitizeMessage substitui "Failed to fetch" por copy pública
    expect(alert.textContent).not.toContain('Failed to fetch');
    expect(alert.textContent).toMatch(/Não foi possível|Tente novamente/i);
  });

  it('renderiza variante disconnected com título e descrição customizados', () => {
    render(
      <EdgeFallback
        variant="disconnected"
        title="Dropbox não conectado"
        description="Configure a integração."
      />,
    );
    expect(screen.getByText('Dropbox não conectado')).toBeInTheDocument();
    expect(screen.getByText('Configure a integração.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renderiza variante empty sem botão quando onRetry não é passado', () => {
    render(<EdgeFallback variant="empty" title="Nada aqui" />);
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('dispara onRetry ao clicar no botão de tentar novamente', () => {
    const onRetry = vi.fn();
    render(<EdgeFallback variant="error" error="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('desabilita o botão quando isRetrying=true', () => {
    render(
      <EdgeFallback
        variant="error"
        error="boom"
        onRetry={() => {}}
        isRetrying
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('variante loading tem role=status e é polite', () => {
    render(<EdgeFallback variant="loading" title="Carregando..." />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
