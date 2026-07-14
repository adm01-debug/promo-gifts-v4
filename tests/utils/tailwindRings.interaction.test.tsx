/**
 * hoverRingsOf / ringsByVariant — testes de interação
 * ----------------------------------------------------
 * Os helpers em `tests/utils/tailwindRings.ts` são puros e leem apenas
 * o `className` estático — não avaliam CSS. Mesmo assim, precisamos
 * garantir 3 propriedades sob interação real do jsdom:
 *
 *   (I1) **Persistência sob mouse:** hover NÃO remove tokens
 *        `hover:ring-*` do className declarativo — logo `hoverRingsOf`
 *        continua reportando o mesmo estado antes/durante/depois do
 *        `pointerenter`/`pointerleave`.
 *
 *   (I2) **Persistência sob teclado:** `Tab`/`Shift+Tab` e `focus`
 *        programático não removem tokens `focus-visible:ring-*` do
 *        className — `ringsByVariant(el, 'focus-visible')` é estável.
 *
 *   (I3) **Isolamento de variants:** hover e focus-visible NÃO se
 *        contaminam. Elementos que só declaram `hover:ring-primary`
 *        NÃO devem aparecer em `ringsByVariant(el, 'focus-visible')`
 *        e vice-versa, mesmo depois de focar/hover.
 *
 * Isso protege contra dois tipos de regressão:
 *   - alguém trocando `focus-visible:ring-primary` por `focus:ring-primary`
 *     (mudança silenciosa de comportamento para usuários de teclado);
 *   - alguém usando `useState` para ligar/desligar `hover:` classes,
 *     que quebraria o contrato "declarado" desses helpers.
 */

import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  hoverRingsOf,
  ringsByVariant,
  focusRingsOf,
  focusWithinRingsOf,
  dataStateRingsOf,
  ringsOf,
} from './tailwindRings';

// Fixture — elementos com contratos distintos:
//   • hover-only         → só `hover:ring-primary`
//   • focus-only         → só `focus-visible:ring-primary`
//   • both               → hover-primary + focus-visible-amber
//   • stacked            → `md:focus-visible:ring-primary` (variant empilhado)
//   • focus-within-host  → container com `focus-within:ring-primary` +
//                          descendente focável (padrão popover/card).
//   • data-state-host    → simula primitiva Radix: `data-state` alterna
//                          entre "closed"/"open" via botão, e o container
//                          declara `data-[state=open]:ring-primary` +
//                          `data-[state=closed]:ring-amber-500`.
function Fixture() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button data-testid="hover-only" className="ring-0 hover:ring-2 hover:ring-primary">
        hover
      </button>
      <button
        data-testid="focus-only"
        className="ring-0 focus-visible:ring-2 focus-visible:ring-primary"
      >
        focus
      </button>
      <button
        data-testid="both"
        className="ring-0 hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        both
      </button>
      <button
        data-testid="stacked"
        className="ring-0 md:focus-visible:ring-2 md:focus-visible:ring-primary"
      >
        stacked
      </button>
      <div
        data-testid="focus-within-host"
        className="ring-0 focus-within:ring-2 focus-within:ring-primary"
      >
        <button data-testid="focus-within-child">child</button>
      </div>
      <div
        data-testid="data-state-host"
        data-state={open ? 'open' : 'closed'}
        className="ring-0 data-[state=open]:ring-2 data-[state=open]:ring-primary data-[state=closed]:ring-2 data-[state=closed]:ring-amber-500"
      >
        <button data-testid="data-state-toggle" onClick={() => setOpen((v) => !v)}>
          toggle
        </button>
      </div>
    </div>
  );
}

describe('hoverRingsOf / ringsByVariant — interação', () => {
  it('(I1) hoverRingsOf é estável antes/durante/depois de pointerenter+leave', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('hover-only');

    const before = hoverRingsOf(target);
    expect(before).toEqual({ primary: true, amber: false });

    await user.hover(target);
    const during = hoverRingsOf(target);
    expect(during).toEqual(before);

    await user.unhover(target);
    const after = hoverRingsOf(target);
    expect(after).toEqual(before);
  });

  it('(I2) focusRingsOf é estável sob Tab e blur programático', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('focus-only');

    const before = focusRingsOf(target);
    expect(before).toEqual({ primary: true, amber: false });

    // Tab até o elemento — em jsdom, isso ativa :focus (não :focus-visible
    // real), mas o className declarativo não muda: é isso que garantimos.
    await user.tab();
    // hover-only vem primeiro no DOM; avança até focus-only.
    while (document.activeElement !== target) {
      await user.tab();
      if (document.activeElement === document.body) break; // guard
    }
    const focused = focusRingsOf(target);
    expect(focused).toEqual(before);

    target.blur();
    const blurred = focusRingsOf(target);
    expect(blurred).toEqual(before);
  });

  it('(I3) hover e focus-visible NÃO se contaminam no elemento "both"', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const both = getByTestId('both');

    // Contrato declarado: hover=primary, focus-visible=amber.
    expect(hoverRingsOf(both)).toEqual({ primary: true, amber: false });
    expect(focusRingsOf(both)).toEqual({ primary: false, amber: true });

    await user.hover(both);
    both.focus();
    // Mesmo com AMBOS estados simultaneamente ativos no DOM, os helpers
    // continuam lendo os tokens declarados sem cruzar as famílias.
    expect(hoverRingsOf(both)).toEqual({ primary: true, amber: false });
    expect(focusRingsOf(both)).toEqual({ primary: false, amber: true });

    // Base do "both" não pinta rings — o ring-0 é apagado por hover/focus
    // em CSS real, mas o TOKEN base não pode ter primary/amber.
    expect(ringsOf(both)).toEqual({ primary: false, amber: false });
  });

  it('ringsByVariant reconhece variants empilhados sob :focus-visible', () => {
    const { getByTestId } = render(<Fixture />);
    const stacked = getByTestId('stacked');

    // `md:focus-visible:ring-primary` deve ser lido como focus-visible.
    expect(ringsByVariant(stacked, 'focus-visible')).toEqual({
      primary: true,
      amber: false,
    });
    // E NÃO deve aparecer sob `md` sozinho — o último variant é focus-visible.
    expect(ringsByVariant(stacked, 'md')).toEqual({ primary: false, amber: false });
  });

  it('ringsByVariant discrimina hover × focus-visible × active sem colisão', () => {
    const { getByTestId } = render(<Fixture />);
    const hoverOnly = getByTestId('hover-only');
    const focusOnly = getByTestId('focus-only');

    expect(ringsByVariant(hoverOnly, 'hover')).toEqual({ primary: true, amber: false });
    expect(ringsByVariant(hoverOnly, 'focus-visible')).toEqual({ primary: false, amber: false });
    expect(ringsByVariant(hoverOnly, 'active')).toEqual({ primary: false, amber: false });

    expect(ringsByVariant(focusOnly, 'hover')).toEqual({ primary: false, amber: false });
    expect(ringsByVariant(focusOnly, 'focus-visible')).toEqual({ primary: true, amber: false });
    expect(ringsByVariant(focusOnly, 'active')).toEqual({ primary: false, amber: false });
  });

  it('mouse+teclado combinados: nenhum elemento vaza tokens entre variants', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const targets = ['hover-only', 'focus-only', 'both', 'stacked'].map(getByTestId);

    // Passa mouse e Tab em cada um; ao final, todos devem manter os
    // contratos originais.
    for (const t of targets) {
      await user.hover(t);
      t.focus();
      await user.unhover(t);
      t.blur();
    }

    expect(hoverRingsOf(getByTestId('hover-only'))).toEqual({ primary: true, amber: false });
    expect(focusRingsOf(getByTestId('hover-only'))).toEqual({ primary: false, amber: false });

    expect(hoverRingsOf(getByTestId('focus-only'))).toEqual({ primary: false, amber: false });
    expect(focusRingsOf(getByTestId('focus-only'))).toEqual({ primary: true, amber: false });

    expect(hoverRingsOf(getByTestId('both'))).toEqual({ primary: true, amber: false });
    expect(focusRingsOf(getByTestId('both'))).toEqual({ primary: false, amber: true });

    expect(focusRingsOf(getByTestId('stacked'))).toEqual({ primary: true, amber: false });
  });

  // ---------------------------------------------------------------------
  // (I4) focus-within — container ganha ring quando descendente foca.
  // ---------------------------------------------------------------------
  it('(I4) focusWithinRingsOf lê o container e ignora hover/focus-visible', () => {
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('focus-within-host');

    expect(focusWithinRingsOf(host)).toEqual({ primary: true, amber: false });
    // Não deve vazar para outros variants — o container só declara focus-within.
    expect(hoverRingsOf(host)).toEqual({ primary: false, amber: false });
    expect(focusRingsOf(host)).toEqual({ primary: false, amber: false });
    // Base do container não pode pintar rings.
    expect(ringsOf(host)).toEqual({ primary: false, amber: false });
  });

  it('(I4b) focusWithinRingsOf é estável quando descendente foca/blura', () => {
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('focus-within-host');
    const child = getByTestId('focus-within-child') as HTMLButtonElement;

    const before = focusWithinRingsOf(host);
    child.focus();
    expect(focusWithinRingsOf(host)).toEqual(before);
    child.blur();
    expect(focusWithinRingsOf(host)).toEqual(before);
  });

  it('(I4c) ringsByVariant("focus-within") equivale a focusWithinRingsOf', () => {
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('focus-within-host');
    expect(ringsByVariant(host, 'focus-within')).toEqual(focusWithinRingsOf(host));
  });

  // ---------------------------------------------------------------------
  // (I5) data-[state=open] — variant arbitrário emitido por primitivas
  // Radix (Popover/Dialog/Accordion). O helper deve ler ambos os estados
  // sem colisão e refletir a alternância declarativa.
  // ---------------------------------------------------------------------
  it('(I5) dataStateRingsOf lê open/closed independentemente do atributo atual', () => {
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');

    // O helper é DECLARATIVO — lê ambas as classes independentemente do
    // valor corrente de `data-state`. Isso é intencional: cobre o
    // contrato do componente, não o snapshot de estado.
    expect(dataStateRingsOf(host, 'open')).toEqual({ primary: true, amber: false });
    expect(dataStateRingsOf(host, 'closed')).toEqual({ primary: false, amber: true });
  });

  it('(I5b) alternar data-state via interação NÃO muda os tokens declarativos', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');
    const toggle = getByTestId('data-state-toggle');

    expect(host.getAttribute('data-state')).toBe('closed');
    const openBefore = dataStateRingsOf(host, 'open');
    const closedBefore = dataStateRingsOf(host, 'closed');

    await act(async () => {
      await user.click(toggle);
    });
    expect(host.getAttribute('data-state')).toBe('open');

    // Contrato declarativo intacto após a alternância.
    expect(dataStateRingsOf(host, 'open')).toEqual(openBefore);
    expect(dataStateRingsOf(host, 'closed')).toEqual(closedBefore);
    // E não vazou para hover/focus-visible.
    expect(hoverRingsOf(host)).toEqual({ primary: false, amber: false });
    expect(focusRingsOf(host)).toEqual({ primary: false, amber: false });
  });

  it('(I5c) dataStateRingsOf isola estados diferentes sem colisão', () => {
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');

    // Estado inexistente no className retorna vazio — nenhum falso positivo.
    expect(dataStateRingsOf(host, 'on')).toEqual({ primary: false, amber: false });
    expect(dataStateRingsOf(host, 'off')).toEqual({ primary: false, amber: false });
    // Equivalência com ringsByVariant.
    expect(ringsByVariant(host, 'data-[state=open]')).toEqual(dataStateRingsOf(host, 'open'));
  });
});
