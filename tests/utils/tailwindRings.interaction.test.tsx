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
//   • outline-suppressed → padrão a11y comum: `outline-none` acompanhado de
//                          `focus-visible:ring-primary` (substitui o outline
//                          nativo). Deve preservar contrato focus-visible.
//   • skip-tab           → `tabIndex={-1}` — não participa do fluxo Tab
//                          mas ainda é focável programaticamente. Contrato
//                          declarativo permanece.
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
      <button
        data-testid="outline-suppressed"
        className="outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        outline suprimido
      </button>
      <button
        data-testid="skip-tab"
        tabIndex={-1}
        className="ring-0 focus-visible:ring-2 focus-visible:ring-primary"
      >
        skip
      </button>
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

/**
 * (I6) `data-[state=open]` sob alternância real (mouse + teclado)
 * ---------------------------------------------------------------
 * Foca em REGRESSÃO DE INTEGRAÇÃO com primitivas Radix: quando o usuário
 * alterna o estado de um Popover/Dialog/Accordion via clique OU via teclado
 * (Enter/Space), o atributo `data-state` muda, o CSS resolve OUTRA regra
 * `data-[state=…]:ring-*` — mas o helper declarativo `ringsByVariant`
 * DEVE continuar entregando os tokens corretos para AMBOS os estados.
 *
 * Cobrimos aqui a "leitura efetiva" — o consumidor idiomático do helper
 * em suítes reais é `dataStateRingsOf(el, el.getAttribute('data-state'))`:
 * o que aparece pintado no elemento agora. Essa combinação precisa refletir
 * a alternância mesmo quando o gatilho é teclado (a11y-first).
 */

/** Leitura efetiva: tokens ativos dado o `data-state` corrente. */
function effectiveDataStateRings(el: Element) {
  const state = el.getAttribute('data-state');
  return state ? dataStateRingsOf(el, state) : { primary: false, amber: false };
}

describe('ringsByVariant / dataStateRingsOf — alternância de data-state (mouse + teclado)', () => {
  it('(I6a) clique de mouse: closed → open → closed produz tokens corretos por rodada', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');
    const toggle = getByTestId('data-state-toggle');

    // Estado inicial: closed → amber ativo, primary inativo (via leitura efetiva).
    expect(host.getAttribute('data-state')).toBe('closed');
    expect(effectiveDataStateRings(host)).toEqual({ primary: false, amber: true });
    expect(ringsByVariant(host, 'data-[state=closed]')).toEqual({ primary: false, amber: true });

    // Clique 1 → open: primary ativo, amber inativo.
    await act(async () => {
      await user.click(toggle);
    });
    expect(host.getAttribute('data-state')).toBe('open');
    expect(effectiveDataStateRings(host)).toEqual({ primary: true, amber: false });
    expect(ringsByVariant(host, 'data-[state=open]')).toEqual({ primary: true, amber: false });

    // Clique 2 → closed novamente: volta pro contrato inicial.
    await act(async () => {
      await user.click(toggle);
    });
    expect(host.getAttribute('data-state')).toBe('closed');
    expect(effectiveDataStateRings(host)).toEqual({ primary: false, amber: true });
  });

  it('(I6b) teclado Enter: alterna data-state e leitura efetiva reflete cada rodada', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');
    const toggle = getByTestId('data-state-toggle') as HTMLButtonElement;

    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(host.getAttribute('data-state')).toBe('closed');

    // Enter → open.
    await act(async () => {
      await user.keyboard('{Enter}');
    });
    expect(host.getAttribute('data-state')).toBe('open');
    expect(effectiveDataStateRings(host)).toEqual({ primary: true, amber: false });

    // Enter → closed.
    await act(async () => {
      await user.keyboard('{Enter}');
    });
    expect(host.getAttribute('data-state')).toBe('closed');
    expect(effectiveDataStateRings(host)).toEqual({ primary: false, amber: true });
  });

  it('(I6c) teclado Space: comportamento idêntico a Enter em <button>', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');
    const toggle = getByTestId('data-state-toggle') as HTMLButtonElement;

    toggle.focus();
    expect(host.getAttribute('data-state')).toBe('closed');

    await act(async () => {
      await user.keyboard(' '); // Space
    });
    expect(host.getAttribute('data-state')).toBe('open');
    expect(effectiveDataStateRings(host)).toEqual({ primary: true, amber: false });
  });

  it('(I6d) mouse + teclado intercalados: N alternâncias convergem no estado esperado', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');
    const toggle = getByTestId('data-state-toggle') as HTMLButtonElement;

    // Sequência determinística: click, Enter, click, Space, click.
    // 5 alternâncias a partir de "closed" → estado final "open".
    const actions: Array<() => Promise<void>> = [
      async () => { await user.click(toggle); },
      async () => { toggle.focus(); await user.keyboard('{Enter}'); },
      async () => { await user.click(toggle); },
      async () => { toggle.focus(); await user.keyboard(' '); },
      async () => { await user.click(toggle); },
    ];

    let expected: 'open' | 'closed' = 'closed';
    for (const [i, action] of actions.entries()) {
      await act(async () => { await action(); });
      expected = expected === 'closed' ? 'open' : 'closed';
      expect(host.getAttribute('data-state'), `passo #${i + 1}`).toBe(expected);
      const eff = effectiveDataStateRings(host);
      if (expected === 'open') {
        expect(eff, `passo #${i + 1} open`).toEqual({ primary: true, amber: false });
      } else {
        expect(eff, `passo #${i + 1} closed`).toEqual({ primary: false, amber: true });
      }
    }
    // Sanity final: 5 alternâncias a partir de closed → open.
    expect(host.getAttribute('data-state')).toBe('open');
  });

  it('(I6e) alternância NÃO altera tokens declarados: ambos os variants permanecem lidos', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');
    const toggle = getByTestId('data-state-toggle') as HTMLButtonElement;

    // Snapshot declarativo antes de qualquer interação.
    const openBefore = dataStateRingsOf(host, 'open');
    const closedBefore = dataStateRingsOf(host, 'closed');
    expect(openBefore).toEqual({ primary: true, amber: false });
    expect(closedBefore).toEqual({ primary: false, amber: true });

    // 4 alternâncias mistas.
    await act(async () => { await user.click(toggle); });      // open
    toggle.focus();
    await act(async () => { await user.keyboard('{Enter}'); }); // closed
    await act(async () => { await user.click(toggle); });      // open
    await act(async () => { await user.keyboard(' '); });      // closed

    // Contrato declarativo intacto: o helper NÃO passa a "esquecer" o outro
    // variant nem passa a reportá-lo diferente. É esse invariante que dá
    // segurança pra usar `dataStateRingsOf` em specs de Popover reais.
    expect(dataStateRingsOf(host, 'open')).toEqual(openBefore);
    expect(dataStateRingsOf(host, 'closed')).toEqual(closedBefore);
    // E `ringsByVariant` bate exatamente com `dataStateRingsOf` após N toggles.
    expect(ringsByVariant(host, 'data-[state=open]')).toEqual(openBefore);
    expect(ringsByVariant(host, 'data-[state=closed]')).toEqual(closedBefore);
  });

  it('(I6f) alternância NÃO vaza tokens para hover/focus-visible/focus-within', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const host = getByTestId('data-state-host');
    const toggle = getByTestId('data-state-toggle') as HTMLButtonElement;

    // Alternância mista + hover no host + foco no filho.
    await user.hover(host);
    toggle.focus();
    await act(async () => { await user.keyboard('{Enter}'); }); // open
    await act(async () => { await user.click(toggle); });       // closed

    // O host declara APENAS variants data-[state=…]. Nenhum outro variant
    // pode aparecer com tokens de ring, senão o consumidor do helper pega
    // um falso positivo (ex: acha que ganhou focus ring por causa do popover).
    expect(hoverRingsOf(host)).toEqual({ primary: false, amber: false });
    expect(focusRingsOf(host)).toEqual({ primary: false, amber: false });
    expect(focusWithinRingsOf(host)).toEqual({ primary: false, amber: false });
    // E a base do host continua sem rings — só via variant data-state.
    expect(ringsOf(host)).toEqual({ primary: false, amber: false });
  });
});

/**
 * (A11Y) Consistência de focus-visible sob navegação real por teclado
 * -------------------------------------------------------------------
 * Invariantes de acessibilidade validados aqui — todos DECLARATIVOS
 * (jsdom não avalia `:focus-visible` como browser real, mas nosso
 * contrato é sobre os TOKENS presentes no className):
 *
 *   (A1) Tab/Shift+Tab NÃO alteram os tokens `focus-visible:ring-*`
 *        declarados em nenhum elemento focado ou passado.
 *   (A2) `blur()` (perda de foco) NÃO remove tokens — o ring é CSS-driven,
 *        não JS. Anular via `element.className = ''` seria bug real.
 *   (A3) Elementos com `outline-none` DEVEM declarar `focus-visible:ring-*`
 *        para não zerar a affordance visual de teclado (WCAG 2.4.7).
 *   (A4) `tabIndex={-1}` remove o elemento do fluxo Tab natural, mas
 *        o contrato `focus-visible:ring-*` permanece — foco programático
 *        (por Radix, dialog init, etc.) ainda deve pintar o ring.
 *   (A5) Percorrer TODO o fluxo Tab não "gasta" o ring de nenhum elemento
 *        — snapshot antes == snapshot depois de N tabs.
 */

/**
 * Percorre o fluxo Tab avançando até `n` vezes, coletando o histórico de
 * `document.activeElement`. Sai antes se o foco sair da fixture (`body`).
 */
async function walkTab(user: ReturnType<typeof userEvent.setup>, n: number) {
  const trail: (Element | null)[] = [document.activeElement];
  for (let i = 0; i < n; i++) {
    await user.tab();
    trail.push(document.activeElement);
    if (document.activeElement === document.body) break;
  }
  return trail;
}

describe('focus-visible — a11y sob Tab/Shift+Tab e blur', () => {
  it('(A1) Tab avança sem alterar tokens focus-visible em nenhum elemento tocado', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const testIds = [
      'hover-only',
      'focus-only',
      'both',
      'stacked',
      'focus-within-child',
      'data-state-toggle',
      'outline-suppressed',
    ] as const;
    const before = testIds.map((id) => ({ id, snap: focusRingsOf(getByTestId(id)) }));

    // Percorre o fluxo (número de tabs > número de elementos alcançáveis).
    await walkTab(user, testIds.length + 3);

    for (const { id, snap } of before) {
      expect(focusRingsOf(getByTestId(id)), `focus-visible drift em "${id}"`).toEqual(snap);
    }
  });

  it('(A2) Shift+Tab (reverso) preserva os mesmos tokens', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const focusOnly = getByTestId('focus-only');
    const outlineSuppressed = getByTestId('outline-suppressed');

    const snapFocus = focusRingsOf(focusOnly);
    const snapOutline = focusRingsOf(outlineSuppressed);

    // Foca no último elemento tabulável e volta 3x.
    outlineSuppressed.focus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.tab({ shift: true });

    expect(focusRingsOf(focusOnly)).toEqual(snapFocus);
    expect(focusRingsOf(outlineSuppressed)).toEqual(snapOutline);
  });

  it('(A3) blur programático NÃO remove tokens focus-visible do className', () => {
    const { getByTestId } = render(<Fixture />);
    const focusOnly = getByTestId('focus-only') as HTMLButtonElement;
    const before = focusRingsOf(focusOnly);
    expect(before).toEqual({ primary: true, amber: false });

    focusOnly.focus();
    expect(focusRingsOf(focusOnly)).toEqual(before);

    focusOnly.blur();
    // Contrato: perder foco NÃO é motivo pra remover tokens declarativos.
    expect(focusRingsOf(focusOnly)).toEqual(before);
    // E não vazou pra hover/data-state.
    expect(hoverRingsOf(focusOnly)).toEqual({ primary: false, amber: false });
  });

  it('(A4) outline-none sem focus-visible:ring seria bug — invariante WCAG 2.4.7', () => {
    const { getByTestId } = render(<Fixture />);
    const el = getByTestId('outline-suppressed');
    const classes = el.className.split(/\s+/);

    // Se alguém declara `outline-none` (removendo o outline nativo),
    // ESTE elemento DEVE fornecer `focus-visible:ring-*` como affordance
    // substituta — senão usuários de teclado perdem qualquer feedback.
    const suppressesOutline = classes.some((c) => c === 'outline-none' || c === 'outline-0');
    if (suppressesOutline) {
      const fv = focusRingsOf(el);
      expect(
        fv.primary || fv.amber,
        'outline-none sem focus-visible:ring-* é regressão de a11y',
      ).toBe(true);
    }
  });

  it('(A5) tabIndex=-1 sai do fluxo Tab mas o ring declarativo permanece', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const skip = getByTestId('skip-tab') as HTMLButtonElement;

    // Percorre o fluxo inteiro; o skip-tab NÃO deve virar activeElement.
    const trail = await walkTab(user, 20);
    expect(trail).not.toContain(skip);

    // Mas foco programático (Radix, dialog init, tour) ainda funciona
    // e o token declarativo permanece intacto antes/depois.
    const before = focusRingsOf(skip);
    expect(before).toEqual({ primary: true, amber: false });
    skip.focus();
    expect(focusRingsOf(skip)).toEqual(before);
    skip.blur();
    expect(focusRingsOf(skip)).toEqual(before);
  });

  it('(A6) N ciclos focus+blur não erodem o contrato declarativo', () => {
    const { getByTestId } = render(<Fixture />);
    const focusOnly = getByTestId('focus-only') as HTMLButtonElement;
    const both = getByTestId('both') as HTMLButtonElement;
    const outlineSuppressed = getByTestId('outline-suppressed') as HTMLButtonElement;

    const snaps = new Map<HTMLButtonElement, ReturnType<typeof focusRingsOf>>();
    for (const el of [focusOnly, both, outlineSuppressed]) {
      snaps.set(el, focusRingsOf(el));
    }

    // 25 ciclos — quantidade escolhida pra pegar drift acumulativo caso
    // algum listener global mutar className (ex: telemetria de foco).
    for (let i = 0; i < 25; i++) {
      for (const el of snaps.keys()) {
        el.focus();
        el.blur();
      }
    }

    for (const [el, snap] of snaps) {
      expect(focusRingsOf(el)).toEqual(snap);
      // Base do elemento NUNCA deve pintar rings — só via variant.
      expect(ringsOf(el)).toEqual({ primary: false, amber: false });
    }
  });

  it('(A7) navegação completa preserva tokens em CADA elemento do fluxo', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const tabbables = [
      'hover-only',
      'focus-only',
      'both',
      'stacked',
      'focus-within-child',
      'data-state-toggle',
      'outline-suppressed',
    ] as const;

    // Snapshot INICIAL de todos os elementos.
    const initial = new Map<string, ReturnType<typeof focusRingsOf>>();
    for (const id of tabbables) initial.set(id, focusRingsOf(getByTestId(id)));

    // Tab forward completo.
    for (let i = 0; i < tabbables.length; i++) {
      await user.tab();
      // Assert token do elemento CORRENTE não mudou.
      const active = document.activeElement;
      if (active && active !== document.body) {
        const testId = active.getAttribute('data-testid');
        if (testId && initial.has(testId)) {
          expect(
            focusRingsOf(active),
            `token drift no foco de "${testId}"`,
          ).toEqual(initial.get(testId));
        }
      }
    }

    // Snapshot FINAL — nenhum elemento deve ter drift.
    for (const id of tabbables) {
      expect(focusRingsOf(getByTestId(id)), `drift final em "${id}"`).toEqual(initial.get(id));
    }
  });
});

/**
 * P1–P7 — Ponteiro NÃO ativa `:focus-visible`
 * -------------------------------------------
 * Contrato WAI-ARIA / CSSWG: `:focus-visible` só deve aparecer quando o
 * foco chega por meios não-pontuais (teclado, programático via API a11y).
 * Cliques com mouse, toques e `pointerdown` NÃO devem pintar
 * `focus-visible:ring-*` na renderização, mesmo que o elemento fique
 * como `document.activeElement`.
 *
 * Como validamos:
 *   - **Camada declarativa (helpers puros):** `focusRingsOf` só lê o
 *     className — não muda com modalidade. Serve para garantir que
 *     ninguém trocou o className via JS na tentativa de "desligar" o ring.
 *   - **Camada runtime (jsdom):** `element.matches(':focus-visible')`
 *     usa a heurística de modalidade do jsdom (última interação foi
 *     ponteiro → false; teclado → true). É esta camada que prova que
 *     o CSS renderizado NÃO ativaria `focus-visible:ring-*` no click.
 *
 * Regressões que estes testes pegam:
 *   1. Alguém troca `focus-visible:` por `focus:` — o ring passa a
 *      aparecer no click do mouse (bug clássico de a11y).
 *   2. Alguém adiciona `.focus()` programático em `onPointerDown` sem
 *      `{ preventScroll: true, focusVisible: false }` — em navegadores
 *      novos isso força focus-visible.
 *   3. Alguém aplica ring incondicional sob `:focus` (não `:focus-visible`)
 *      em CSS global (@layer base).
 */
describe('ponteiro (mouse/touch) NÃO ativa focus-visible', () => {
  it('(P1) user.click no botão foca o elemento mas :focus-visible = false', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('focus-only') as HTMLButtonElement;

    await user.click(target);

    // O click SIM foca (jsdom segue spec: mousedown → focus no botão).
    expect(document.activeElement).toBe(target);
    // Mas :focus-visible NÃO deve casar — última modalidade foi ponteiro.
    expect(target.matches(':focus-visible')).toBe(false);
    // Contrato declarativo permanece: o className continua declarando o ring.
    expect(focusRingsOf(target)).toEqual({ primary: true, amber: false });
  });

  it('(P2) blur após click reseta :focus-visible para false (não fica preso ligado)', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('focus-only') as HTMLButtonElement;

    await user.click(target);
    expect(target.matches(':focus-visible')).toBe(false);

    target.blur();
    // Após blur o elemento nem sequer está focado, então :focus-visible
    // é obrigatoriamente false. Garante que não existe "resíduo" de
    // ativação por ponteiro que sobreviva ao blur.
    expect(target.matches(':focus-visible')).toBe(false);
    expect(document.activeElement).not.toBe(target);
  });


  it('(P3) pointerdown + pointerup manual não deixa :focus-visible ligado', async () => {
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('focus-only') as HTMLButtonElement;

    act(() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
      target.focus();
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
    });

    expect(document.activeElement).toBe(target);
    expect(target.matches(':focus-visible')).toBe(false);
    // Declarativo intacto.
    expect(focusRingsOf(target)).toEqual({ primary: true, amber: false });
  });

  it('(P4) toque (pointerType=touch) também NÃO ativa focus-visible', async () => {
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('focus-only') as HTMLButtonElement;

    act(() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      target.focus();
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    });

    expect(document.activeElement).toBe(target);
    expect(target.matches(':focus-visible')).toBe(false);
  });

  it('(P5) elemento com outline-none + focus-visible:ring — click NÃO renderiza ring', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('outline-suppressed') as HTMLButtonElement;

    await user.click(target);

    expect(document.activeElement).toBe(target);
    // Este é o caso mais crítico: com outline-none, se :focus-visible
    // vazasse no click, o usuário de mouse veria um ring "flutuando"
    // sem interação de teclado — feio e confuso.
    expect(target.matches(':focus-visible')).toBe(false);
    // Contrato declarativo mantido (helper puro é imune a modalidade).
    expect(focusRingsOf(target)).toEqual({ primary: true, amber: false });
  });

  it('(P6) múltiplos clicks em elementos diferentes preservam :focus-visible=false em todos', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const focusOnly = getByTestId('focus-only') as HTMLButtonElement;
    const both = getByTestId('both') as HTMLButtonElement;
    const outlineSuppressed = getByTestId('outline-suppressed') as HTMLButtonElement;

    // Sequência de 6 clicks alternados — modalidade permanece "ponteiro".
    for (const el of [focusOnly, both, outlineSuppressed, focusOnly, outlineSuppressed, both]) {
      await user.click(el);
      expect(document.activeElement).toBe(el);
      expect(
        el.matches(':focus-visible'),
        `:focus-visible vazou para true após click em ${el.dataset.testid}`,
      ).toBe(false);
      // Declarativo NUNCA muda — helper puro é imune a modalidade.
      expect(focusRingsOf(el)).toEqual({ primary: true, amber: false });
    }
  });


  it('(P7) helpers declarativos são invariantes à modalidade (click × Tab não muda o token lido)', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Fixture />);
    const target = getByTestId('focus-only') as HTMLButtonElement;

    const declaredBefore = focusRingsOf(target);

    await user.click(target);
    expect(focusRingsOf(target)).toEqual(declaredBefore);

    target.blur();
    await user.tab();
    while (document.activeElement !== target) {
      await user.tab();
      if (document.activeElement === document.body) break;
    }
    expect(focusRingsOf(target)).toEqual(declaredBefore);

    // Última verificação: os DOIS estados de modalidade produzem o MESMO
    // resultado no helper declarativo (é isso que impede um autor de
    // "corrigir" o bug do mouse mutando o className via JS).
    await user.click(target);
    expect(focusRingsOf(target)).toEqual(declaredBefore);
  });
});

