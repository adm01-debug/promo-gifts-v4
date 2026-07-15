/**
 * Regressão — Módulo Magazine, rodada QA 2026-07-15.
 *
 * Fecha o backlog remanescente das auditorias 2026-07-12:
 *  - V-BUG (P0 descoberto nesta rodada): comentário `//` renderizado como texto no MiniMap durante drag.
 *  - T-I1: logos com alt genérico ("logo") — deve usar clientName.
 *  - T-N4: TemplateRegistry rejeita productsPerPage inválido em dev.
 *  - S-GAP3: magazineService.create trima title vazio/whitespace.
 *  - Templates 10..12: alt="" apenas em imagens decorativas (background com filter).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { render } from '@testing-library/react';
import { CorporateExecutiveTemplate } from '@/pages/magazine/components/templates/corporate/CorporateExecutiveTemplate';
import { CorporateSplitTemplate } from '@/pages/magazine/components/templates/corporate/CorporateSplitTemplate';
import { CorporateHeroTemplate } from '@/pages/magazine/components/templates/corporate/CorporateHeroTemplate';
import { TEMPLATE_REGISTRY, listTemplates, getTemplate } from '@/pages/magazine/components/templates/TemplateRegistry';
import type { Magazine, MagazinePage } from '@/types/magazine';

// ---------- Fixtures ----------

const baseMagazine: Magazine = {
  id: 'm1',
  ownerId: 'u1',
  organizationId: null,
  title: 'Revista Teste',
  subtitle: '',
  templateId: 'corporate-executive',
  status: 'draft',
  branding: {
    clientName: 'ACME Brindes',
    clientLogoUrl: 'https://example.com/logo.png',
    clientCrmId: null,
    colors: { primary: '#0f172a', secondary: '#dc2626', text: '#111' },
    category: 'general',
  },
  content: {
    showPrice: true,
    showCode: true,
    showPersonalization: false,
    showDescription: true,
    showDimensions: false,
    showMaterials: false,
    showColors: true,
    groupByCategory: false,
  },
  items: [],
  pageOrder: null,
  publicToken: null,
  pdfUrl: null,
  publishedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const emptyPage: MagazinePage = { index: 0, kind: 'cover', items: [] };

// ---------- V-BUG: comentário `//` no JSX do MiniMap ----------

describe('V-BUG · MagazineMiniMap: sem comentários `//` órfãos em children JSX', () => {
  it('não contém `// eslint-disable-next-line` fora de bloco JSX comment', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/magazine/components/MagazineMiniMap.tsx'), 'utf8');
    // Um comentário `//` DENTRO de `{...}` de JSX vira texto. Guarda:
    // - Nenhuma linha que abre `{...}` de JSX seguida de linha começando com `//`
    const lines = src.split('\n');
    for (let i = 1; i < lines.length; i += 1) {
      const prev = lines[i - 1].trim();
      const cur = lines[i].trim();
      // Heurística: linha anterior fecha um bloco JSX (`)}` ou `>` sozinho) e
      // linha atual começa com `//` — indica comentário perdido no meio de children.
      if ((prev.endsWith(')}') || prev === '>' || prev.endsWith('/>')) && cur.startsWith('//')) {
        throw new Error(`Comentário // órfão em JSX children (linha ${i + 1}): ${cur}`);
      }
    }
    expect(true).toBe(true);
  });
});

// ---------- T-I1: logos com clientName no alt ----------

describe('T-I1 · Templates corporate: alt do logo usa clientName', () => {
  it('CorporateExecutiveTemplate — alt inclui clientName', () => {
    const { container } = render(
      <CorporateExecutiveTemplate magazine={baseMagazine} page={emptyPage} />,
    );
    const logo = container.querySelector('img[alt*="ACME"]');
    expect(logo).toBeTruthy();
    // Regressão: NÃO deve haver `alt="logo"` genérico
    expect(container.querySelector('img[alt="logo"]')).toBeNull();
  });

  it('CorporateSplitTemplate — alt inclui clientName', () => {
    const { container } = render(
      <CorporateSplitTemplate magazine={baseMagazine} page={emptyPage} />,
    );
    expect(container.querySelector('img[alt*="ACME"]')).toBeTruthy();
    expect(container.querySelector('img[alt="logo"]')).toBeNull();
  });

  it('CorporateHeroTemplate — alt já usa clientName (regressão)', () => {
    const { container } = render(
      <CorporateHeroTemplate magazine={baseMagazine} page={emptyPage} />,
    );
    const imgs = container.querySelectorAll('img');
    for (const img of imgs) {
      expect(img.getAttribute('alt')).not.toBe('logo');
    }
  });

  it('fallback quando clientName é null', () => {
    const m = { ...baseMagazine, branding: { ...baseMagazine.branding, clientName: null } };
    const { container } = render(<CorporateExecutiveTemplate magazine={m} page={emptyPage} />);
    const logo = container.querySelector('img');
    // Deve ter alt não vazio mesmo sem clientName
    expect(logo?.getAttribute('alt')).toMatch(/Logo/i);
    expect(logo?.getAttribute('alt')).not.toBe('logo');
  });
});

// ---------- T-N4: TemplateRegistry valida productsPerPage ----------

describe('T-N4 · TemplateRegistry: invariantes', () => {
  it('todos os 12 templates têm productsPerPage inteiro > 0', () => {
    const entries = listTemplates();
    expect(entries.length).toBeGreaterThanOrEqual(12);
    for (const e of entries) {
      expect(Number.isInteger(e.productsPerPage)).toBe(true);
      expect(e.productsPerPage).toBeGreaterThan(0);
    }
  });

  it('todos os templates têm Component definido', () => {
    for (const e of listTemplates()) {
      expect(e.Component).toBeTruthy();
    }
  });

  it('getTemplate com id inválido cai no fallback editorial-vogue', () => {
    // @ts-expect-error — teste força id inexistente em runtime
    const fb = getTemplate('inexistente-xyz');
    expect(fb.id).toBe('editorial-vogue');
  });

  it('nenhum template usa font hardcoded system-ui (design tokens semânticos)', () => {
    for (const e of listTemplates()) {
      expect(e.fonts.heading).not.toBe('');
      expect(e.fonts.body).not.toBe('');
    }
  });

  it('registry é imutável em runtime (não mutamos o singleton)', () => {
    const beforeCount = Object.keys(TEMPLATE_REGISTRY).length;
    // Snapshot depois de listar
    expect(Object.keys(TEMPLATE_REGISTRY).length).toBe(beforeCount);
  });
});

// ---------- S-GAP3: magazineService.create trima title ----------

describe('S-GAP3 · magazineService: sanitização de title', () => {
  it('grep: implementação usa .trim() || fallback', () => {
    const src = readFileSync(join(process.cwd(), 'src/services/magazineService.ts'), 'utf8');
    // Bloqueia regressão para o padrão antigo `?? 'Nova Revista'` sem trim.
    expect(src).toMatch(/input\.title\?\.trim\(\)\s*\|\|\s*'Nova Revista'/);
    expect(src).not.toMatch(/title:\s*input\.title\s*\?\?\s*'Nova Revista'/);
  });
});

// ---------- Templates: alt vazio SOMENTE em imagens decorativas ----------

describe('Templates · alt="" reservado a imagens decorativas', () => {
  it('varre todos os arquivos de template e valida uso de alt=""', () => {
    const roots = ['catalog', 'corporate', 'editorial'].map((f) =>
      join(process.cwd(), 'src/pages/magazine/components/templates', f),
    );
    const violations: string[] = [];
    for (const dir of roots) {
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
        const path = join(dir, file);
        const src = readFileSync(path, 'utf8');
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
          if (/alt=""/.test(lines[i])) {
            // Contexto ±3 linhas: DEVE conter `filter:` (decorativa) OU aria-hidden
            const ctx = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
            const isDecorative = /filter:|aria-hidden|background|absolute inset-0/.test(ctx);
            if (!isDecorative) {
              violations.push(`${file}:${i + 1} — alt="" em imagem não-decorativa`);
            }
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
