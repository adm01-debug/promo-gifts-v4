/**
 * Testes estruturais (source-level) do bloco "Prazo p/ envio" no header
 * do carrinho ativo em `SellerCartsPage.tsx`.
 *
 * Objetivo: travar o layout em 2 linhas (label em cima, input+badge embaixo)
 * posicionado entre os dados da empresa e o grupo de ações (Status/Layout/menu),
 * e garantir que as ações continuem ancoradas à direita em todas as quebras.
 *
 * Preferimos verificar as classes utilitárias e a ordem estrutural direto no
 * fonte porque a página real depende de contextos pesados (auth, supabase,
 * react-router) que fugiriam do escopo de um teste de layout.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../SellerCartsPage.tsx'),
  'utf8',
);

function sliceBetween(source: string, startMark: string, endMark: string): string {
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('SellerCartsPage — layout do bloco "Prazo p/ envio"', () => {
  it('renderiza o bloco como filho direto do header, entre empresa e ações', () => {
    const header = sliceBetween(
      SRC,
      'data-testid="active-cart-header"',
      'CartActionsMenu',
    );

    const companyIdx = header.indexOf('active-cart-company-name');
    const blockIdx = header.indexOf('cart-shipping-deadline-block');
    const statusIdx = header.indexOf('CartStatusSelect');

    expect(companyIdx).toBeGreaterThan(-1);
    expect(blockIdx).toBeGreaterThan(companyIdx);
    expect(statusIdx).toBeGreaterThan(blockIdx);
  });

  it('bloco usa layout em 2 linhas (flex-col) com label + input+badge', () => {
    const block = sliceBetween(
      SRC,
      'data-testid="cart-shipping-deadline-block"',
      'CartStatusSelect',
    );

    // Container em coluna → 2 linhas
    expect(block).toMatch(/className=(?:"|`)[^"`]*\bflex-col\b/);
    // Ocupa o espaço vazio central no desktop
    expect(block).toMatch(/\bsm:flex-1\b/);
    expect(block).toMatch(/\bsm:pl-4\b/);
    // Label da 1ª linha
    expect(block).toContain('htmlFor="cart-shipping-deadline"');
    expect(block).toContain('Prazo p/ envio');
    // Input da 2ª linha
    expect(block).toContain('data-testid="cart-shipping-deadline-input"');
    // Input em h-7 (mesma família compacta do badge)
    expect(block).toMatch(/\bh-7\b/);
  });

  it('input e badge coexistem na mesma linha (wrapper inline-flex flex-wrap)', () => {
    const block = sliceBetween(
      SRC,
      'data-testid="cart-shipping-deadline-block"',
      'CartStatusSelect',
    );
    // Wrapper interno que agrupa input + badge/erro na 2ª linha
    expect(block).toMatch(
      /className=(?:"|`)[^"`]*\binline-flex\b[^"`]*\bflex-wrap\b[^"`]*\bitems-center\b/,
    );
  });

  it('grupo de ações permanece ancorado à direita e com gap progressivo', () => {
    const actions = sliceBetween(
      SRC,
      'data-testid="cart-header-actions"',
      'LayoutPopover',
    );
    // Ancoragem à direita em qualquer quebra: justify-end + content-end
    expect(actions).toMatch(/\bjustify-end\b/);
    expect(actions).toMatch(/\bcontent-end\b/);
    // Nunca comprime, sempre pode quebrar linha
    expect(actions).toMatch(/\bflex-shrink-0\b/);
    expect(actions).toMatch(/\bflex-wrap\b/);
    // Mobile: full-width com justify-end cola tudo à direita;
    // Desktop: auto + ml-auto empurra o grupo pro canto direito do header
    expect(actions).toMatch(/\bw-full\b/);
    expect(actions).toMatch(/\bsm:w-auto\b/);
    expect(actions).toMatch(/\bsm:ml-auto\b/);
    // Gap progressivo por breakpoint
    expect(actions).toMatch(/\bgap-1\.5\b/);
    expect(actions).toMatch(/\bsm:gap-2\b/);
    expect(actions).toMatch(/\bmd:gap-2\.5\b/);
    expect(actions).toMatch(/\blg:gap-3\b/);
  });



  it('header stack em mobile (flex-col) e alinha em linha no sm+', () => {
    const headerOpen = SRC
      .split('\n')
      .find((l) => l.includes('data-testid="active-cart-header"'));
    // A tag <div> abre em linhas separadas; pegue a className logo abaixo
    const idx = SRC.indexOf('data-testid="active-cart-header"');
    const window = SRC.slice(idx, idx + 400);
    expect(window).toMatch(/\bflex-col\b/);
    expect(window).toMatch(/\bsm:flex-row\b/);
    expect(window).toMatch(/\bsm:items-center\b/);
    expect(headerOpen).toBeTruthy();
  });
});
