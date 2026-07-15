/**
 * Fuzz property-based do <Clickable>.
 * 8 invariantes × 200 iterações = 1600 asserções aleatórias.
 * Ver plano em qa/CLICKABLE_EXHAUSTIVE_AUDIT.md.
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Clickable } from '../Clickable';

const NUM_RUNS = 200;

// Arbitrários compartilhados
const roleArb = fc.constantFrom('button', 'link', 'menuitem', 'tab', 'option', 'switch');
const boolOrUndef = fc.option(fc.boolean(), { nil: undefined });
const dataKeyArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,10}$/)
  .map((s) => `data-${s.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'x'}`);
const ariaKeyArb = fc.constantFrom(
  'aria-haspopup',
  'aria-controls',
  'aria-current',
  'aria-live',
  'aria-atomic',
);
// Teclas de sistema/nav — NÃO devem disparar onClick
const noopKeyArb = fc.constantFrom('Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'a', 'z', '1', '0', 'Shift', 'Control', 'Alt', 'F1');

afterEachCleanup();
function afterEachCleanup() {
  // cleanup entre iterações do fast-check evita DOMs vazando
  return true;
}

describe('Clickable — fuzz invariantes', () => {
  it(`I1: Enter/Space chamam preventDefault quando não disabled e (não strictTarget OU target===currentTarget)`, () => {
    fc.assert(
      fc.property(
        fc.boolean(), // disabled
        fc.boolean(), // strictTarget (target sempre = currentTarget aqui)
        fc.constantFrom('Enter', ' '),
        (disabled, strictTarget, key) => {
          cleanup();
          const onClick = vi.fn();
          const { getByRole } = render(
            <Clickable onClick={onClick} disabled={disabled} strictTarget={strictTarget}>
              x
            </Clickable>,
          );
          const el = getByRole('button');
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          const notPrevented = el.dispatchEvent(event);

          if (disabled) {
            expect(onClick).not.toHaveBeenCalled();
            expect(notPrevented).toBe(true); // não previne se disabled
          } else {
            // strictTarget não afeta pq target === currentTarget (target é o próprio el)
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(notPrevented).toBe(false);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('I2: teclas não-Enter/Space nunca disparam onClick', () => {
    fc.assert(
      fc.property(fc.boolean(), noopKeyArb, (disabled, key) => {
        cleanup();
        const onClick = vi.fn();
        const { getByRole } = render(
          <Clickable onClick={onClick} disabled={disabled}>
            x
          </Clickable>,
        );
        fireEvent.keyDown(getByRole('button'), { key });
        expect(onClick).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('I3: disabled=true ⇒ nunca dispara onClick (mouse+teclado)', () => {
    fc.assert(
      fc.property(fc.constantFrom('click', 'keydown-enter', 'keydown-space'), (kind) => {
        cleanup();
        const onClick = vi.fn();
        const { getByRole } = render(
          <Clickable onClick={onClick} disabled>
            x
          </Clickable>,
        );
        const el = getByRole('button');
        if (kind === 'click') fireEvent.click(el);
        else if (kind === 'keydown-enter') fireEvent.keyDown(el, { key: 'Enter' });
        else fireEvent.keyDown(el, { key: ' ' });
        expect(onClick).not.toHaveBeenCalled();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('I4: aria-pressed reflete exatamente isPressed (true|false|undefined)', () => {
    fc.assert(
      fc.property(boolOrUndef, (isPressed) => {
        cleanup();
        const { getByRole } = render(
          <Clickable onClick={() => {}} isPressed={isPressed}>
            x
          </Clickable>,
        );
        const el = getByRole('button');
        if (isPressed === undefined) {
          expect(el).not.toHaveAttribute('aria-pressed');
        } else {
          expect(el).toHaveAttribute('aria-pressed', String(isPressed));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('I5: tabIndex final ∈ {-1 se disabled, custom, 0}', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.integer({ min: -1, max: 10 }), { nil: undefined }),
        (disabled, custom) => {
          cleanup();
          const { getByRole } = render(
            <Clickable onClick={() => {}} disabled={disabled} tabIndex={custom}>
              x
            </Clickable>,
          );
          const actual = getByRole('button').getAttribute('tabindex');
          if (disabled) {
            expect(actual).toBe('-1');
          } else if (custom !== undefined) {
            expect(actual).toBe(String(custom));
          } else {
            expect(actual).toBe('0');
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('I6: role final = override || "button"', () => {
    fc.assert(
      fc.property(fc.option(roleArb, { nil: undefined }), (roleOverride) => {
        cleanup();
        const { container } = render(
          <Clickable onClick={() => {}} role={roleOverride}>
            x
          </Clickable>,
        );
        const el = container.firstChild as HTMLElement;
        const expected = roleOverride ?? 'button';
        expect(el.getAttribute('role')).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('I7: data-* extras sobrevivem ao passthrough', () => {
    fc.assert(
      fc.property(
        fc.dictionary(dataKeyArb, fc.stringMatching(/^[a-z0-9_-]{1,20}$/), {
          minKeys: 1,
          maxKeys: 5,
        }),
        (extras) => {
          cleanup();
          const props: Record<string, string> = { ...extras, 'data-testid': 'fuzz-t' };
          const { getByTestId } = render(
            <Clickable
              onClick={() => {}}
              {...(props as unknown as { 'data-testid': string })}
            >
              x
            </Clickable>,
          );
          const el = getByTestId('fuzz-t');
          for (const [k, v] of Object.entries(extras)) {
            expect(el).toHaveAttribute(k, v);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('I8: aria-* extras sobrevivem ao passthrough', () => {
    fc.assert(
      fc.property(
        fc.dictionary(ariaKeyArb, fc.stringMatching(/^[a-z0-9_-]{1,20}$/), {
          minKeys: 1,
          maxKeys: 5,
        }),
        (extras) => {
          cleanup();
          const { getByRole } = render(
            <Clickable
              onClick={() => {}}
              {...(extras as unknown as Record<`aria-${string}`, string>)}
            >
              x
            </Clickable>,
          );
          const el = getByRole('button');
          for (const [k, v] of Object.entries(extras)) {
            expect(el).toHaveAttribute(k, v);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
