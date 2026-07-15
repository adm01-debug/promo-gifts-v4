/**
 * Testes de navegação por teclado + semântica screen-reader do ConfirmDialog
 * em TODAS as variantes (default | destructive | warning | info).
 *
 * Cobre:
 *   - foco inicial fica dentro do diálogo (focus trap Radix)
 *   - Tab e Shift+Tab mantêm o foco preso ao diálogo
 *   - Enter no botão de confirmação dispara onConfirm
 *   - Espaço no botão de cancelar dispara onOpenChange(false)
 *   - Escape fecha em todas as variantes
 *   - accessible name e description casam com o texto exibido
 *   - botões têm text-content acessível (sem depender de ícone-only)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

type Variant = 'default' | 'destructive' | 'info' | 'warning';
const VARIANTS: Variant[] = ['default', 'destructive', 'warning', 'info'];

function mount(variant: Variant, overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Título ${variant}`}
      description={`Descrição da variante ${variant}.`}
      confirmLabel="Aplicar"
      cancelLabel="Voltar"
      onConfirm={onConfirm}
      variant={variant}
      {...overrides}
    />,
  );
  return { ...utils, onOpenChange, onConfirm };
}

describe('ConfirmDialog — navegação por teclado + leitor de tela (todas variantes)', () => {
  describe.each(VARIANTS)('variante %s', (variant) => {
    it('foco inicial cai dentro do diálogo', async () => {
      mount(variant);
      await waitFor(() => {
        const dialog = screen.getByRole('alertdialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    it('accessible name e description refletem o texto exibido', () => {
      mount(variant);
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAccessibleName(`Título ${variant}`);
      expect(dialog).toHaveAccessibleDescription(`Descrição da variante ${variant}.`);
    });

    it('botões têm texto acessível (não são icon-only)', () => {
      mount(variant);
      expect(screen.getByTestId('confirm-dialog-yes')).toHaveAccessibleName('Aplicar');
      expect(screen.getByTestId('confirm-dialog-no')).toHaveAccessibleName('Voltar');
    });

    it('Tab e Shift+Tab mantêm foco preso ao diálogo', async () => {
      const user = userEvent.setup();
      mount(variant);
      const dialog = screen.getByRole('alertdialog');
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('Escape fecha o diálogo', async () => {
      const user = userEvent.setup();
      const { onOpenChange } = mount(variant);
      await user.keyboard('{Escape}');
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('Enter no botão de confirmação dispara onConfirm', async () => {
      const user = userEvent.setup();
      const { onConfirm } = mount(variant);
      const yes = screen.getByTestId('confirm-dialog-yes');
      yes.focus();
      await user.keyboard('{Enter}');
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('Espaço no botão de cancelar fecha o diálogo', async () => {
      const user = userEvent.setup();
      const { onOpenChange } = mount(variant);
      const no = screen.getByTestId('confirm-dialog-no');
      no.focus();
      await user.keyboard(' ');
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });
  });
});
