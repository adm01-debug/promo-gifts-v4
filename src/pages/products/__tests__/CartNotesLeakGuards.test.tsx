/**
 * Guardas complementares de vazamento de `seller_carts.notes`.
 *
 * Este spec cobre três frentes que o `CartNotesInternalOnly.test.ts`
 * não cobre diretamente:
 *
 *   1. Scan estático nas edge functions `quote-public-*` — nenhuma delas
 *      pode ler `seller_carts` nem projetar `seller_cart_notes`.
 *
 *   2. Scan estático dos templates de PDF (`src/components/pdf/**`,
 *      `src/utils/proposalPdfReactGenerator.ts`) — nenhum pode referenciar
 *      `seller_carts`, `cart.notes`, `sellerCartNotes` ou `internalNotes`.
 *
 *   3. Render runtime do `ProposalHtmlTemplate` com dados representativos
 *      + um valor-canário que só existiria se um dev tivesse ligado
 *      `seller_carts.notes` ao PDF. O canário JAMAIS pode aparecer no
 *      textContent do documento renderizado.
 *
 * Em conjunto com `CartNotesInternalOnly.test.ts` e a policy RLS
 * `seller_id = auth.uid()` de `seller_carts`, este spec fecha o
 * caminho para /orcamento-publico, PDF, e-mail e CRM.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import {
  ProposalHtmlTemplate,
  type ProposalTemplateData,
} from '@/components/pdf/ProposalHtmlTemplate';

const ROOT = resolve(__dirname, '../../../..');

function read(p: string): string {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const LEAK_PATTERNS = [
  /\bseller_carts\b/,
  /\bcart\.notes\b/,
  /\bsellerCartNotes\b/,
  /\binternalNotes\b/,
  /\bseller_cart_notes\b/,
];

function scanForLeaks(dirs: string[]): string[] {
  const offenders: string[] = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const content = read(file);
      if (!content) continue;
      for (const rx of LEAK_PATTERNS) {
        if (rx.test(content)) {
          offenders.push(`${file.replace(`${ROOT}/`, '')} :: ${rx}`);
          break;
        }
      }
    }
  }
  return offenders;
}

describe('Notas internas — guardas /orcamento-publico + PDF', () => {
  it('edge functions quote-public-* não referenciam seller_carts', () => {
    const offenders = scanForLeaks([
      join(ROOT, 'supabase/functions/quote-public-view'),
      join(ROOT, 'supabase/functions/quote-public-react'),
      join(ROOT, 'supabase/functions/quote-public-approve'),
    ]);
    expect(
      offenders,
      `Edge function pública vazando seller_carts:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('módulo de PDF (templates + generator) não referencia seller_carts', () => {
    const offenders = scanForLeaks([
      join(ROOT, 'src/components/pdf'),
      join(ROOT, 'src/utils/proposalPdfReactGenerator.ts'),
    ]).filter((entry) => !entry.includes('__tests__/'));
    expect(
      offenders,
      `Template/generator de PDF vazando seller_carts:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('a interface ProposalTemplateData não expõe campo para notas internas', () => {
    // Lê o arquivo fonte da interface para blindar contra futuros
    // campos como `sellerCartNotes`, `internalNotes` ou `cart_notes`.
    const src = read(join(ROOT, 'src/components/pdf/ProposalHtmlTemplate.tsx'));
    expect(src).not.toEqual('');
    const interfaceStart = src.indexOf('export interface ProposalTemplateData');
    expect(interfaceStart).toBeGreaterThan(-1);
    // Fecha na primeira `}` que termina o bloco (interface simples).
    const closingBrace = src.indexOf('\n}', interfaceStart);
    const block = src.slice(interfaceStart, closingBrace);
    for (const banned of [
      'sellerCartNotes',
      'internalNotes',
      'seller_cart_notes',
      'cartNotes',
    ]) {
      expect(block).not.toContain(banned);
    }
  });

  it('render runtime do PDF não expõe conteúdo com formato de nota interna', () => {
    // Canário: string única e improvável. Se um dev futuramente ligar
    // `seller_carts.notes` como campo do PDF, o textContent do render
    // conterá esse canário e este teste falhará.
    const CANARY = '__CANARY_SELLER_CART_INTERNAL_NOTES__';

    const data: ProposalTemplateData = {
      quoteNumber: 'ORC-2026-0001',
      date: '2026-07-10',
      validUntil: '2026-07-24',
      client: { name: 'Cliente Teste', company: 'ACME' },
      seller: { name: 'Vendedor Teste' },
      items: [
        {
          name: 'Caneca personalizada',
          quantity: 100,
          unitPrice: 12.5,
        },
      ],
      subtotal: 1250,
      total: 1250,
      // `notes` público do orçamento — visível ao cliente por design.
      // NÃO é `seller_carts.notes`.
      notes: 'Entrega em 10 dias úteis após aprovação.',
    };

    // Injeta o canário em uma propriedade extra (que a interface
    // não permite via TS) para simular "e se alguém plugar isso".
    // O cast confirma runtime: mesmo com dado extra no objeto, o
    // template só renderiza os campos que ele conhece.
    const dataWithCanary = {
      ...data,
      sellerCartNotes: CANARY,
      internalNotes: CANARY,
      cart_notes: CANARY,
    } as unknown as ProposalTemplateData;

    const { container } = render(
      React.createElement(ProposalHtmlTemplate, { data: dataWithCanary }),
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain(CANARY);
    // Sanidade: o render de fato produziu conteúdo.
    expect(text.length).toBeGreaterThan(20);
    cleanup();
  });

  it('roteador não expõe /orcamento-publico apontando para módulo que lê seller_carts', () => {
    // Vasculha todos os arquivos de rota. Se no futuro alguém adicionar
    // `/orcamento-publico/:token`, o handler correspondente NÃO pode
    // importar de `hooks/products/useSellerCarts` nem tocar em `seller_carts`.
    const routeFiles = [
      ...walk(join(ROOT, 'src/routes')),
      join(ROOT, 'src/App.tsx'),
    ];
    const suspects: string[] = [];
    for (const f of routeFiles) {
      const content = read(f);
      if (!content) continue;
      if (/orcamento[-_]?publico|quote[-_]?public/i.test(content)) {
        if (
          /\bseller_carts\b/.test(content) ||
          content.includes('useSellerCarts') ||
          /\bcart\.notes\b/.test(content)
        ) {
          suspects.push(f.replace(`${ROOT}/`, ''));
        }
      }
    }
    expect(
      suspects,
      `Rota pública de orçamento referenciando carrinhos internos:\n  ${suspects.join('\n  ')}`,
    ).toEqual([]);
  });
});
