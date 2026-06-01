import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SafeMessage } from '@/components/errors/SafeMessage';

const gateState = { isAllowed: false, isDev: false };
vi.mock('@/hooks/admin', () => ({
  useDevGate: () => gateState,
}));

describe('SafeMessage', () => {
  it('não-dev: substitui texto técnico por fallback público', () => {
    gateState.isAllowed = false;
    render(<SafeMessage error={new Error('TypeError: x is not a function')} data-testid="m" />);
    expect(screen.getByTestId('m').textContent).not.toMatch(/TypeError/);
    expect(screen.getByTestId('m').textContent).toMatch(/não pôde|tente novamente/i);
  });

  it('não-dev: preserva mensagem amigável', () => {
    gateState.isAllowed = false;
    render(<SafeMessage error="Selecione um produto" data-testid="m" />);
    expect(screen.getByTestId('m').textContent).toBe('Selecione um produto');
  });

  it('dev: vê texto cru', () => {
    gateState.isAllowed = true;
    render(<SafeMessage error={new Error('Failed to fetch')} data-testid="m" />);
    expect(screen.getByTestId('m').textContent).toBe('Failed to fetch');
  });

  it('showRawForDev=false força saneamento mesmo para dev', () => {
    gateState.isAllowed = true;
    render(
      <SafeMessage error={new Error('Failed to fetch')} showRawForDev={false} data-testid="m" />,
    );
    expect(screen.getByTestId('m').textContent).not.toMatch(/Failed to fetch/);
  });

  it('respeita prop as e className', () => {
    gateState.isAllowed = false;
    render(<SafeMessage error="oi" as="p" className="text-destructive" data-testid="m" />);
    const el = screen.getByTestId('m');
    expect(el.tagName).toBe('P');
    expect(el.className).toContain('text-destructive');
  });

  it('fallback custom é aplicado a texto técnico', () => {
    gateState.isAllowed = false;
    render(
      <SafeMessage
        error={new Error('UNAUTHORIZED_LEGACY_JWT')}
        fallback="Sua sessão expirou."
        data-testid="m"
      />,
    );
    expect(screen.getByTestId('m').textContent).toBe('Sua sessão expirou.');
  });
});
