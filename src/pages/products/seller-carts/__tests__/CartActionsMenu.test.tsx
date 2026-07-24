/**
 * CartActionsMenu — testes do menu "..." que agrupa
 * "Gerar Orçamento" e "Excluir".
 *
 * Cobre:
 *   1) trigger tem aria-label acessível e aria-expanded reflete o estado
 *   2) abrir o menu (clique) revela as duas opções
 *   3) "Gerar Orçamento" dispara onGenerateQuote e NÃO dispara onDelete
 *   4) "Excluir" dispara onDelete (que abre o modal de confirmação no page)
 *      e NÃO dispara onGenerateQuote
 *   5) "Gerar Orçamento" fica desabilitado quando canGenerateQuote=false
 *      e não dispara o callback
 *   6) Escape fecha o menu e retorna o foco ao trigger (a11y Radix)
 *   7) navegação por setas move o foco entre os itens
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartActionsMenu } from '../CartActionsMenu';

function renderMenu(overrides: Partial<React.ComponentProps<typeof CartActionsMenu>> = {}) {
  const onGenerateQuote = vi.fn();
  const onDelete = vi.fn();
  const props = {
    canGenerateQuote: true,
    onGenerateQuote,
    onDelete,
    ...overrides,
  };
  const utils = render(<CartActionsMenu {...props} />);
  return { onGenerateQuote, onDelete, ...utils };
}

describe('CartActionsMenu — trigger e a11y', () => {
  it('trigger tem aria-label e aria-expanded=false quando fechado', () => {
    renderMenu();
    const trigger = screen.getByTestId('cart-actions-menu');
    expect(trigger).toHaveAttribute('aria-label', 'Mais ações do carrinho');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-expanded=true após abrir o menu', async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByTestId('cart-actions-menu');
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
  });
});

describe('CartActionsMenu — opções', () => {
  it('abre o menu e revela "Gerar Orçamento" e "Excluir"', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByTestId('cart-actions-menu'));
    expect(await screen.findByTestId('cart-actions-generate-quote')).toBeInTheDocument();
    expect(screen.getByTestId('cart-actions-delete')).toBeInTheDocument();
    expect(screen.getByText('Gerar Orçamento')).toBeInTheDocument();
    expect(screen.getByText('Excluir')).toBeInTheDocument();
  });

  it('clicar em "Gerar Orçamento" dispara onGenerateQuote e não dispara onDelete', async () => {
    const user = userEvent.setup();
    const { onGenerateQuote, onDelete } = renderMenu();
    await user.click(screen.getByTestId('cart-actions-menu'));
    await user.click(await screen.findByTestId('cart-actions-generate-quote'));
    expect(onGenerateQuote).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('clicar em "Excluir" dispara onDelete e não dispara onGenerateQuote', async () => {
    const user = userEvent.setup();
    const { onGenerateQuote, onDelete } = renderMenu();
    await user.click(screen.getByTestId('cart-actions-menu'));
    await user.click(await screen.findByTestId('cart-actions-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onGenerateQuote).not.toHaveBeenCalled();
  });

  it('"Gerar Orçamento" fica desabilitado quando canGenerateQuote=false e não dispara callback', async () => {
    const user = userEvent.setup();
    const { onGenerateQuote } = renderMenu({ canGenerateQuote: false });
    await user.click(screen.getByTestId('cart-actions-menu'));
    const item = await screen.findByTestId('cart-actions-generate-quote');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    await user.click(item);
    expect(onGenerateQuote).not.toHaveBeenCalled();
  });
});

describe('CartActionsMenu — teclado (Radix)', () => {
  it('Escape fecha o menu e devolve o foco ao trigger', async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByTestId('cart-actions-menu');
    await user.click(trigger);
    await screen.findByTestId('cart-actions-generate-quote');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(trigger).toHaveFocus();
  });

  it('setas movem o foco entre os itens do menu', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByTestId('cart-actions-menu'));
    const first = await screen.findByTestId('cart-actions-generate-quote');
    // Radix pode não auto-focar o primeiro item em jsdom; ArrowDown garante entrada
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(screen.getByTestId('cart-actions-delete')).toHaveFocus(),
    );
  });

  it('Enter no item focado aciona o callback correspondente', async () => {
    const user = userEvent.setup();
    const { onGenerateQuote } = renderMenu();
    await user.click(screen.getByTestId('cart-actions-menu'));
    const first = await screen.findByTestId('cart-actions-generate-quote');
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard('{Enter}');
    expect(onGenerateQuote).toHaveBeenCalledTimes(1);
  });
});
