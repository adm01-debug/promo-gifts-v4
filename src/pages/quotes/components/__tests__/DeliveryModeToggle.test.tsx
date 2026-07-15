/**
 * Teste RTL isolado do toggle Contar dias / Data fixa.
 * Não depende do QuoteBuilderPage inteiro (auth, providers, external DB).
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
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

  // -------------------------------------------------------------------------
  // Alternância controlada (pattern real do QuoteBuilderPage)
  // -------------------------------------------------------------------------
  it('alterna aria-selected quando o pai atualiza o value após onChange', async () => {
    function Host() {
      const [mode, setMode] = useState<DeliveryMode>('prazo');
      return <DeliveryModeToggle value={mode} onChange={setMode} />;
    }

    render(<Host />);
    const contar = screen.getByRole('tab', { name: 'Contar dias' });
    const data = screen.getByRole('tab', { name: 'Data fixa' });

    expect(contar).toHaveAttribute('aria-selected', 'true');
    expect(data).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(data);
    expect(contar).toHaveAttribute('aria-selected', 'false');
    expect(data).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(contar);
    expect(contar).toHaveAttribute('aria-selected', 'true');
    expect(data).toHaveAttribute('aria-selected', 'false');
  });

  // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
  it('não altera o layout inline-flex ao trocar de valor', async () => {
    const { rerender } = setup('prazo');
    const listBefore = screen.getByTestId('delivery-mode-toggle');
    const clsBefore = listBefore.className;
    rerender(<DeliveryModeToggle value="data" onChange={() => {}} />);
    const listAfter = screen.getByTestId('delivery-mode-toggle');
    expect(listAfter.className).toBe(clsBefore);
    expect(listAfter.className).toContain('inline-flex');
    expect(listAfter.className).toContain('items-center');
  });

  it('permanece alinhado (inline-flex) em diferentes larguras de container', () => {
    for (const width of [320, 375, 480, 768, 1024, 1440]) {
      cleanup();
      const { container } = render(
        <div style={{ width }}>
          <DeliveryModeToggle value="prazo" onChange={() => {}} />
        </div>,
      );
      const list = container.querySelector('[data-testid="delivery-mode-toggle"]');
      expect(list, `toggle deve renderizar em ${width}px`).toBeTruthy();
      // inline-flex garante que ele NÃO cresce até 100% da largura do pai
      expect((list as HTMLElement).className).toContain('inline-flex');
    }
  });
});
