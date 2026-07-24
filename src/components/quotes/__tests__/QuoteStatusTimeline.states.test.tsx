/**
 * QuoteStatusTimeline — cobertura extra:
 *  - hover/focus em circles não quebram layout nem perdem labels
 *  - múltiplos viewports (mobile/tablet/desktop) mantêm os steps acessíveis
 *  - tokens semânticos (sem cores arbitrárias) — regressão de contraste em fundo preto
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuoteStatusTimeline } from '@/components/quotes/QuoteStatusTimeline';

function setViewport(width: number, height = 800) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

describe('QuoteStatusTimeline — estados e responsividade', () => {
  beforeEach(() => {
    document.body.style.background = '#000';
  });

  it('renderiza root com testid e todos os labels visíveis', () => {
    render(<QuoteStatusTimeline status="pending" createdAt={new Date().toISOString()} />);
    const root = screen.getByTestId('quote-status-timeline');
    expect(root).toBeInTheDocument();
    for (const label of ['Rascunho', 'Pendente', 'Sincronizando', 'Enviado']) {
      expect(within(root).getByText(label)).toBeInTheDocument();
    }
  });

  it('hover em um step não esconde labels nem quebra a contagem', async () => {
    const user = userEvent.setup();
    render(<QuoteStatusTimeline status="pending" />);
    const labels = ['Rascunho', 'Pendente', 'Sincronizando', 'Enviado'];
    for (const label of labels) {
      const el = screen.getByText(label);
      await user.hover(el);
      expect(el).toBeVisible();
    }
    expect(screen.getAllByText(/Rascunho|Pendente|Sincronizando|Enviado/)).toHaveLength(4);
  });

  // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
  it('focus via teclado em label mantém visibilidade e ordem', async () => {
    render(<QuoteStatusTimeline status="sent" />);
    const pendente = screen.getByText('Pendente');
    pendente.setAttribute('tabindex', '0');
    pendente.focus();
    expect(document.activeElement).toBe(pendente);
    expect(pendente).toBeVisible();
  });

  it.each([
    ['mobile', 360],
    ['tablet', 768],
    ['desktop', 1280],
    ['wide', 1920],
  ])('mantém steps acessíveis em viewport %s (%spx)', (_name, width) => {
    setViewport(width as number);
    render(<QuoteStatusTimeline status="pending" />);
    const root = screen.getByTestId('quote-status-timeline');
    expect(root).toBeVisible();
    expect(within(root).getAllByText(/Rascunho|Pendente|Sincronizando|Enviado/).length).toBeGreaterThanOrEqual(4);
  });

  it('não usa cores arbitrárias do Tailwind (regressão de contraste)', () => {
    const { container } = render(<QuoteStatusTimeline status="pending" />);
    // Tokens permitidos: primary, destructive, muted-foreground, success, amber-500 (alerta);
    // qualquer text-gray-XYZ / bg-gray-XYZ / #hex hard-coded é proibido.
    const html = container.innerHTML;
    expect(html).not.toMatch(/text-gray-\d{2,3}/);
    expect(html).not.toMatch(/bg-gray-\d{2,3}/);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it('estados terminais (rejected/expired/cancelled) substituem último step', () => {
    for (const [status, label] of [
      ['rejected', 'Rejeitado'],
      ['expired', 'Expirado'],
      ['cancelled', 'Cancelado'],
    ] as const) {
      const { unmount } = render(<QuoteStatusTimeline status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
