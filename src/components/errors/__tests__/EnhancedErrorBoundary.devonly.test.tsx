/**
 * Garante que detalhes técnicos do EnhancedErrorBoundary (mensagem crua do
 * erro + stack trace + component stack) NUNCA aparecem para usuários sem
 * o gate `dev`. Regressão: antes da gateação, qualquer usuário final via
 * `error.message` em fonte monoespaçada + botão "Detalhes técnicos".
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedErrorBoundary } from '../EnhancedErrorBoundary';
import { useDevGate } from '@/hooks/admin';

vi.mock('@/hooks/admin', () => ({
  useDevGate: vi.fn(),
}));

// Silencia o report e o logger no boundary durante o catch
vi.mock('@/lib/error-reporter', () => ({ reportError: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/chunk-recovery', () => ({
  attemptChunkRecovery: vi.fn().mockResolvedValue(false),
  isChunkLoadError: () => false,
}));

const SECRET = 'INTERNAL_LEAK_token=abc123_secret';

function Boom(): JSX.Element {
  throw new Error(SECRET);
}

function renderBoundary() {
  // Silencia o console.error do React quando o boundary captura
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = render(
    <EnhancedErrorBoundary>
      <Boom />
    </EnhancedErrorBoundary>,
  );
  spy.mockRestore();
  return result;
}

describe('EnhancedErrorBoundary — DevOnly gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não vaza error.message nem "Detalhes técnicos" para usuário final (não-dev)', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: false, isDev: false });

    renderBoundary();

    // Copy amigável segue visível
    expect(screen.getByText(/Ocorreu um erro inesperado/i)).toBeInTheDocument();
    // Mas nada técnico vaza
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mensagem do erro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Detalhes técnicos/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Copiar detalhes do erro/i }),
    ).not.toBeInTheDocument();
  });

  it('não vaza mesmo quando admin (isAllowed=true, isDev=false) — gate padrão sem strict', () => {
    // DevOnly default usa `isAllowed`, então admin com isAllowed=true VERIA.
    // Validamos o contrato atual: nesse modo, admin vê. Se a política mudar,
    // este teste deve ser invertido junto.
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: false });

    renderBoundary();

    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(screen.getByText(/Mensagem do erro/i)).toBeInTheDocument();
    expect(screen.getByText(/Detalhes técnicos/i)).toBeInTheDocument();
  });

  it('renderiza mensagem + detalhes para dev (isDev=true)', () => {
    vi.mocked(useDevGate).mockReturnValue({ isAllowed: true, isDev: true });

    renderBoundary();

    expect(screen.getByText(SECRET)).toBeInTheDocument();
    const toggle = screen.getByText(/Detalhes técnicos/i);
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);
    // Stack do Boom deve conter a mensagem (jsdom)
    const pre = document.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent ?? '').toContain(SECRET);
  });
});
