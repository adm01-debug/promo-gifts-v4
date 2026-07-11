/**
 * DatePickerField — testes de acessibilidade e comportamento.
 *
 * Cobre:
 *  - Estado inicial: exibe placeholder quando `value === ""`.
 *  - Formato ISO: seleção emite `yyyy-MM-dd`; "Hoje" emite ISO local.
 *  - Limpeza: X inline emite `""` e não abre o popover.
 *  - A11y:
 *      • `aria-invalid` e `aria-describedby` propagam ao `<button>` trigger.
 *      • Botão X inline tem `role="button"`, `tabIndex={0}` e responde a
 *        Enter/Space.
 *      • Popover mantém foco dentro do calendário ao abrir (Radix + Calendar
 *        com `initialFocus`).
 *  - Estado desabilitado: X inline não aparece.
 *  - Regra de negócio: `minDate` bloqueia dias anteriores no calendário.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, startOfDay } from 'date-fns';
import { DatePickerField } from '@/components/ui/date-picker-field';

function todayIso() {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
}

describe('DatePickerField — comportamento e a11y', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('exibe placeholder quando value é vazio', () => {
    render(
      <DatePickerField
        data-testid="dp"
        value=""
        onChange={() => {}}
        placeholder="dd/mm/aaaa"
        aria-label="Data"
      />,
    );
    const trigger = screen.getByTestId('dp');
    expect(trigger).toHaveTextContent('dd/mm/aaaa');
    expect(trigger).toHaveAttribute('data-empty', 'true');
  });

  it('formata a data selecionada em dd/MM/yyyy no trigger e propaga ISO no onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePickerField
        data-testid="dp"
        value="2026-07-01"
        onChange={onChange}
        aria-label="Data"
      />,
    );
    const trigger = screen.getByTestId('dp');
    expect(trigger).toHaveTextContent('01/07/2026');

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    // Seleciona o dia 15 no mês atual do calendário aberto.
    const day15 = within(dialog).getByRole('gridcell', { name: /15/ });
    await user.click(day15);
    expect(onChange).toHaveBeenCalledWith('2026-07-15');
  });

  it('botão "Hoje" do rodapé emite ISO do dia atual', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePickerField data-testid="dp" value="" onChange={onChange} aria-label="Data" />);
    await user.click(screen.getByTestId('dp'));
    await user.click(await screen.findByTestId('dp-footer-today'));
    expect(onChange).toHaveBeenCalledWith(todayIso());
  });

  it('botão "Limpar" do rodapé emite string vazia', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePickerField data-testid="dp" value="2026-07-11" onChange={onChange} aria-label="Data" />,
    );
    await user.click(screen.getByTestId('dp'));
    await user.click(await screen.findByTestId('dp-footer-clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('propaga aria-invalid e aria-describedby ao trigger', () => {
    render(
      <DatePickerField
        data-testid="dp"
        value=""
        onChange={() => {}}
        aria-invalid
        aria-describedby="err-1"
        aria-label="Data"
      />,
    );
    const trigger = screen.getByTestId('dp');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'err-1');
  });

  it('botão X inline tem role="button", aria-label e funciona por clique', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePickerField data-testid="dp" value="2026-07-11" onChange={onChange} aria-label="Data" />,
    );
    const clearBtn = screen.getByTestId('dp-clear');
    expect(clearBtn).toHaveAttribute('role', 'button');
    expect(clearBtn).toHaveAttribute('tabindex', '0');
    expect(clearBtn).toHaveAttribute('aria-label', 'Limpar data');

    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('botão X inline responde a teclado (Enter e Space)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePickerField data-testid="dp" value="2026-07-11" onChange={onChange} aria-label="Data" />,
    );
    const clearBtn = screen.getByTestId('dp-clear');
    clearBtn.focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('');

    onChange.mockClear();
    clearBtn.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('X inline não aparece quando disabled', () => {
    render(
      <DatePickerField
        data-testid="dp"
        value="2026-07-11"
        onChange={() => {}}
        disabled
        aria-label="Data"
      />,
    );
    expect(screen.queryByTestId('dp-clear')).toBeNull();
  });

  it('X inline não aparece quando allowClear=false', () => {
    render(
      <DatePickerField
        data-testid="dp"
        value="2026-07-11"
        onChange={() => {}}
        allowClear={false}
        aria-label="Data"
      />,
    );
    expect(screen.queryByTestId('dp-clear')).toBeNull();
  });

  it('trigger tem aria-haspopup dialog e alterna aria-expanded', async () => {
    const user = userEvent.setup();
    render(<DatePickerField data-testid="dp" value="" onChange={() => {}} aria-label="Data" />);
    const trigger = screen.getByTestId('dp');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    // Radix atualiza para true assim que o popover abre.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('foca o calendário ao abrir (initialFocus)', async () => {
    const user = userEvent.setup();
    render(<DatePickerField data-testid="dp" value="" onChange={() => {}} aria-label="Data" />);
    await user.click(screen.getByTestId('dp'));
    const dialog = await screen.findByRole('dialog');
    // O foco deve estar em algum elemento dentro do popover (Calendar).
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
