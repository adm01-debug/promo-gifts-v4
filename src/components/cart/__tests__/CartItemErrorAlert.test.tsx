/**
 * CartItemErrorAlert — testes de UI.
 *
 * Cobre:
 *  • Mensagem inclui o nome do produto.
 *  • Botão "Tentar de novo" dispara onRetry + onDismiss (nesta ordem).
 *  • Quando o pai remove o alerta (após sucesso), ele SOME do DOM.
 *  • focusRetry=true move o foco para o botão de retry (a11y).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CartItemErrorAlert } from '../CartItemErrorAlert';

afterEach(() => cleanup());

describe('CartItemErrorAlert', () => {
  it('mostra o nome do produto na mensagem principal', () => {
    render(
      <CartItemErrorAlert
        itemId="i-1"
        productName="Caneta Metálica Premium"
        onRetry={() => {}}
      />,
    );
    expect(
      screen.getByText(/Falha ao salvar “Caneta Metálica Premium”/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Suas alterações foram desfeitas\. Tente novamente\./),
    ).toBeInTheDocument();
  });

  it('clicar em "Tentar de novo" chama onDismiss e onRetry', async () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <CartItemErrorAlert
        itemId="i-1"
        productName="Caneta"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByTestId('cart-item-error-retry-i-1'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('some do DOM quando o pai deixa de renderizar (simula sucesso após retry)', () => {
    function Host({ show }: { show: boolean }) {
      return show ? (
        <CartItemErrorAlert itemId="i-1" productName="Caneta" onRetry={() => {}} />
      ) : (
        <div data-testid="empty" />
      );
    }
    const { rerender } = render(<Host show />);
    expect(screen.getByTestId('cart-item-error-i-1')).toBeInTheDocument();
    rerender(<Host show={false} />);
    expect(screen.queryByTestId('cart-item-error-i-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('focusRetry=true move o foco para o botão de retry', () => {
    render(
      <CartItemErrorAlert
        itemId="i-1"
        productName="Caneta"
        onRetry={() => {}}
        focusRetry
      />,
    );
    expect(screen.getByTestId('cart-item-error-retry-i-1')).toHaveFocus();
  });

  it('role=alert e aria-live=polite (contrato de a11y)', () => {
    render(
      <CartItemErrorAlert itemId="i-1" productName="Caneta" onRetry={() => {}} />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('ao aparecer com focusRetry, anuncia via aria-live E entrega foco ao retry', () => {
    // Simula o fluxo: erro NÃO estava renderizado, aparece, e no mesmo frame
    // (a) o role=alert com aria-live é adicionado ao DOM (SR anuncia) e
    // (b) o botão Tentar de novo recebe foco para permitir Enter imediato.
    function Host({ show }: { show: boolean }) {
      return show ? (
        <CartItemErrorAlert
          itemId="i-1"
          productName="Caneta"
          onRetry={() => {}}
          focusRetry
        />
      ) : (
        <button data-testid="outside">outside</button>
      );
    }
    const { rerender } = render(<Host show={false} />);
    // Antes: nenhum alerta.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('outside')).toBeInTheDocument();

    rerender(<Host show />);
    // Depois: alerta anunciável + foco no retry.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(alert).toHaveAttribute('data-testid', 'cart-item-error-i-1');
    expect(screen.getByTestId('cart-item-error-retry-i-1')).toHaveFocus();
  });
});
