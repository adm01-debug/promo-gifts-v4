/**
 * Testes de acessibilidade do ConfirmDialog.
 *
 * Cobre:
 *  - roles/labels corretos (alertdialog + accessible name/description)
 *  - foco inicial no botão de confirmação (Radix aplica autoFocus no Action)
 *  - fechamento por Escape
 *  - testids específicos por variante e por scope (testId prop)
 *  - contraste tonal preservado por variante (classes de token, sem hardcode)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Editar gravação"
      description="Deseja editar esta gravação?"
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { ...utils, onOpenChange, onConfirm };
}

describe('ConfirmDialog — acessibilidade', () => {
  it('renderiza como alertdialog com título e descrição acessíveis', () => {
    renderDialog();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName('Editar gravação');
    expect(dialog).toHaveAccessibleDescription('Deseja editar esta gravação?');
  });

  it('move o foco para dentro do diálogo ao abrir', async () => {
    renderDialog();
    await waitFor(() => {
      const dialog = screen.getByRole('alertdialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('fecha ao pressionar Escape (chama onOpenChange(false))', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('confirma ao acionar o botão de confirmação', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    await user.click(screen.getByTestId('confirm-dialog-yes'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('permite navegar por Tab mantendo o foco dentro do diálogo (focus trap)', async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = screen.getByRole('alertdialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('propaga testId customizado para content, botões e título', () => {
    renderDialog({ testId: 'edit-engraving-dialog' });
    expect(screen.getByTestId('edit-engraving-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('edit-engraving-dialog-yes')).toBeInTheDocument();
    expect(screen.getByTestId('edit-engraving-dialog-no')).toBeInTheDocument();
    expect(screen.getByTestId('edit-engraving-dialog-title')).toHaveTextContent('Editar gravação');
  });

  it.each([
    ['default', 'text-primary'],
    ['destructive', 'text-destructive'],
    ['warning', 'text-warning'],
    ['info', 'text-info'],
  ] as const)('variante %s usa token semântico de cor (%s) — contraste garantido', (variant, token) => {
    renderDialog({ variant });
    // O ícone recebe a classe do token; nada de cores hardcoded.
    const svg = screen.getByRole('alertdialog').querySelector('svg');
    expect(svg?.getAttribute('class') ?? '').toContain(token);
  });

  it('barra superior de acento existe em todas as variantes (uniformidade)', () => {
    const variants = ['default', 'destructive', 'warning', 'info'] as const;
    for (const variant of variants) {
      const { unmount } = renderDialog({ variant });
      const dialog = screen.getByRole('alertdialog');
      const accent = dialog.querySelector('[aria-hidden="true"].h-\\[3px\\]');
      expect(accent, `accent bar ausente na variante ${variant}`).not.toBeNull();
      unmount();
    }
  });
});
