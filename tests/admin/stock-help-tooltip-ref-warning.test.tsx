/**
 * Smoke render do StockHelpTooltip em 3 layouts (filtros/busca/calc) para
 * capturar regressões do warning:
 *   "Function components cannot be given refs"
 *
 * Garante que o asChild duplo (TooltipTrigger + PopoverTrigger) e o envelope
 * `<span className="inline-flex">` continuam compatíveis com Radix.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { StockHelpTooltip } from '@/components/inventory/StockHelpTooltip';
import { installReactWarningGuard } from '../helpers/react-warning-guard';

afterEach(() => cleanup());

describe('StockHelpTooltip — Radix asChild nesting', () => {
  it('não emite warning de ref com PopoverTrigger asChild aninhado', () => {
    const guard = installReactWarningGuard();
    const { getByRole } = render(
      <Popover>
        <StockHelpTooltip title="t" description="d">
          <PopoverTrigger asChild>
            <Button>Filtros</Button>
          </PopoverTrigger>
        </StockHelpTooltip>
        <PopoverContent>conteúdo</PopoverContent>
      </Popover>,
    );
    fireEvent.click(getByRole('button', { name: /filtros/i }));
    guard.expectNoRefWarning('popover-asChild');
    guard.dispose();
  });

  it('não emite warning com <div> simples (busca)', () => {
    const guard = installReactWarningGuard();
    render(
      <StockHelpTooltip title="t" description="d" example="ex" emptyHint="hint">
        <div>
          <input placeholder="buscar" />
        </div>
      </StockHelpTooltip>,
    );
    guard.expectNoRefWarning('div-children');
    guard.dispose();
  });

  it('não emite warning sem children (ícone padrão)', () => {
    const guard = installReactWarningGuard();
    const { getByLabelText } = render(
      <StockHelpTooltip title="ajuda" description="d" />,
    );
    expect(getByLabelText(/ajuda: ajuda/i)).toBeTruthy();
    guard.expectNoRefWarning('default-icon');
    guard.dispose();
  });
});
