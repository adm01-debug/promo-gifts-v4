/**
 * Teste RTL isolado do toggle Contar dias / Data fixa.
 * Não depende do QuoteBuilderPage inteiro (auth, providers, external DB).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DeliveryModeToggle,
  type DeliveryMode,
} from '@/pages/quotes/components/DeliveryModeToggle';

function setup(initial: DeliveryMode = 'prazo') {
  const onChange = vi.fn();
  const utils = render(<DeliveryModeToggle value={initial} onChange={onChange} />);
  return { onChange, ...utils };
}

describe('<DeliveryModeToggle />', () => {
  it('renderiza dois tabs com labels corretos', () => {
    setup('prazo');
    const list = screen.getByRole('tablist', { name: 'Modo de prazo de entrega' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('Contar dias');
    expect(tabs[1]).toHaveTextContent('Data fixa');
  });

  it('marca "Contar dias" como selected quando value="prazo"', () => {
    setup('prazo');
    expect(screen.getByRole('tab', { name: 'Contar dias' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Data fixa' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('marca "Data fixa" como selected quando value="data"', () => {
    setup('data');
    expect(screen.getByRole('tab', { name: 'Data fixa' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('chama onChange("data") ao clicar em "Data fixa"', async () => {
    const { onChange } = setup('prazo');
    await userEvent.click(screen.getByRole('tab', { name: 'Data fixa' }));
    expect(onChange).toHaveBeenCalledWith('data');
  });

  it('chama onChange("prazo") ao clicar em "Contar dias"', async () => {
    const { onChange } = setup('data');
    await userEvent.click(screen.getByRole('tab', { name: 'Contar dias' }));
    expect(onChange).toHaveBeenCalledWith('prazo');
  });

  it('mantém classes de token semântico (sem cores hard-coded)', () => {
    setup('prazo');
    const list = screen.getByTestId('delivery-mode-toggle');
    const cls = list.className;
    expect(cls).toContain('border-border/40');
    expect(cls).toContain('bg-muted/30');
    expect(cls).not.toMatch(/bg-(blue|red|green|yellow|purple|pink|indigo)-\d+/);
  });
});
