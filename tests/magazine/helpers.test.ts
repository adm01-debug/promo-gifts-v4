/**
 * Testes unitários dos helpers `ringsOf` / `focusRingsOf` / `thumbsFrom`.
 *
 * Escopo (Fase 5 da auditoria):
 *   1. Robustez a `className` undefined / DOMTokenList / SVGAnimatedString.
 *   2. Whitespace irregular (`\n`, `\t`, múltiplos espaços).
 *   3. Detecção permissiva de família (`ring-primary/50`, `ring-amber-400`).
 *   4. Variants prefixados múltiplos (`md:focus-visible:ring-primary`).
 *   5. Classes duplicadas → resultado consistente.
 *   6. Disjunção intencional entre `ringsOf` (base) e `focusRingsOf` (fv).
 */

import { describe, it, expect } from 'vitest';
import { ringsOf, focusRingsOf, thumbsFrom } from './helpers';

function elFromHTML(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html.trim();
  return host.firstElementChild as HTMLElement;
}

describe('helpers/ringsOf — detecção de rings base', () => {
  it('detecta ring-primary e ring-amber-500 na forma canônica', () => {
    const el = elFromHTML('<div class="ring-2 ring-primary ring-amber-500"></div>');
    const r = ringsOf(el);
    expect(r.primary).toBe(true);
    expect(r.amber).toBe(true);
  });

  it('detecta família amber em qualquer shade (400, 500, 600, 700)', () => {
    for (const shade of [300, 400, 500, 600, 700, 800]) {
      const el = elFromHTML(`<div class="ring-amber-${shade}"></div>`);
      expect(ringsOf(el).amber, `ring-amber-${shade}`).toBe(true);
    }
  });

  it('detecta ring-primary com opacity (ring-primary/50, ring-primary/70)', () => {
    for (const alpha of [10, 50, 70, 90]) {
      const el = elFromHTML(`<div class="ring-primary/${alpha}"></div>`);
      expect(ringsOf(el).primary, `ring-primary/${alpha}`).toBe(true);
    }
  });

  it('NÃO confunde ring-2 (largura) com uma cor', () => {
    const el = elFromHTML('<div class="ring-2"></div>');
    const r = ringsOf(el);
    expect(r.primary).toBe(false);
    expect(r.amber).toBe(false);
  });

  it('NÃO detecta tokens que apenas CONTÊM "ring-primary" como substring', () => {
    // "hover:border-primary/60" antigamente era um falso positivo se o filtro
    // fosse por `includes("primary")` — aqui garantimos o contrário.
    const el = elFromHTML('<div class="hover:border-primary/60"></div>');
    expect(ringsOf(el).primary).toBe(false);
  });

  it('ignora variants prefixados (hover:, focus-visible:, active:) na base', () => {
    const el = elFromHTML('<div class="hover:ring-primary focus-visible:ring-amber-500"></div>');
    const r = ringsOf(el);
    expect(r.primary).toBe(false);
    expect(r.amber).toBe(false);
  });

  it('trata whitespace irregular (tab, newline, múltiplos espaços)', () => {
    const el = elFromHTML('<div class="ring-2\n\tring-primary   ring-amber-500"></div>');
    const r = ringsOf(el);
    expect(r.primary).toBe(true);
    expect(r.amber).toBe(true);
  });

  it('classes duplicadas produzem resultado idempotente', () => {
    const el = elFromHTML('<div class="ring-primary ring-primary ring-primary"></div>');
    expect(ringsOf(el)).toEqual({ primary: true, amber: false });
  });

  it('elemento SEM className não quebra e retorna {false,false}', () => {
    const el = document.createElement('div');
    expect(ringsOf(el)).toEqual({ primary: false, amber: false });
  });

  it('elemento SVG (className é SVGAnimatedString) funciona via baseVal', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    svg.setAttribute('class', 'ring-primary ring-amber-500');
    // Sanidade: em jsdom, className é SVGAnimatedString com baseVal
    // Testamos o comportamento independente do runtime host.
    const r = ringsOf(svg);
    expect(r.primary).toBe(true);
    expect(r.amber).toBe(true);
  });
});

describe('helpers/focusRingsOf — rings pintados sob :focus-visible', () => {
  it('detecta focus-visible:ring-primary e focus-visible:ring-amber-500', () => {
    const el = elFromHTML('<div class="focus-visible:ring-primary focus-visible:ring-amber-500"></div>');
    const r = focusRingsOf(el);
    expect(r.primary).toBe(true);
    expect(r.amber).toBe(true);
  });

  it('IGNORA tokens base (sem variant)', () => {
    const el = elFromHTML('<div class="ring-primary ring-amber-500"></div>');
    const r = focusRingsOf(el);
    expect(r.primary).toBe(false);
    expect(r.amber).toBe(false);
  });

  it('IGNORA outros variants (hover:, active:, group-hover:)', () => {
    const el = elFromHTML('<div class="hover:ring-primary active:ring-amber-500 group-hover:ring-primary"></div>');
    const r = focusRingsOf(el);
    expect(r.primary).toBe(false);
    expect(r.amber).toBe(false);
  });

  it('aceita prefixos empilhados (md:focus-visible:ring-primary)', () => {
    const el = elFromHTML('<div class="md:focus-visible:ring-primary xl:focus-visible:ring-amber-400"></div>');
    const r = focusRingsOf(el);
    expect(r.primary).toBe(true);
    expect(r.amber).toBe(true);
  });

  it('detecta shade permissivo em focus-visible (amber-300 até 700)', () => {
    for (const shade of [300, 400, 500, 600, 700]) {
      const el = elFromHTML(`<div class="focus-visible:ring-amber-${shade}"></div>`);
      expect(focusRingsOf(el).amber, `focus-visible:ring-amber-${shade}`).toBe(true);
    }
  });

  it('NÃO reconhece focus-visible:ring-2 (width) como cor', () => {
    const el = elFromHTML('<div class="focus-visible:ring-2"></div>');
    const r = focusRingsOf(el);
    expect(r.primary).toBe(false);
    expect(r.amber).toBe(false);
  });
});

describe('helpers — disjunção intencional entre ringsOf e focusRingsOf', () => {
  it('ringsOf(base) e focusRingsOf(focus-visible) são independentes na mesma classe', () => {
    // Cenário real do PreviewSidebar: base amber + focus-visible primary.
    const el = elFromHTML('<div class="ring-2 ring-amber-500 focus-visible:ring-2 focus-visible:ring-primary"></div>');
    expect(ringsOf(el)).toEqual({ primary: false, amber: true });
    expect(focusRingsOf(el)).toEqual({ primary: true, amber: false });
  });

  it('ringsOf ignora prefixados; focusRingsOf ignora base — cobertura complementar', () => {
    const el = elFromHTML('<div class="ring-primary focus-visible:ring-amber-500"></div>');
    expect(ringsOf(el)).toEqual({ primary: true, amber: false });
    expect(focusRingsOf(el)).toEqual({ primary: false, amber: true });
  });
});

describe('helpers/thumbsFrom — seleção de miniaturas do PreviewSidebar', () => {
  it('captura apenas botões com aria-label "Ir para página …"', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <button aria-label="Ir para página 1: Capa">A</button>
      <button aria-label="Ir para página 2: 4 produtos">B</button>
      <button aria-label="Outro botão">C</button>
      <a aria-label="Ir para página 3">D</a>
    `;
    const found = thumbsFrom(host);
    expect(found.length).toBe(2);
    expect(found.every((b) => b.tagName === 'BUTTON')).toBe(true);
  });

  it('retorna array vazio quando nada corresponde', () => {
    const host = document.createElement('div');
    host.innerHTML = '<button>Nada aqui</button>';
    expect(thumbsFrom(host)).toEqual([]);
  });
});
