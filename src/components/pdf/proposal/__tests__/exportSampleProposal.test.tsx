/**
 * Deliverable #1 (v2) — Auto-export dos PDFs de exemplo.
 *
 * Renderiza cada fixture do catálogo `PROPOSAL_FIXTURES` em
 * `qa/exports/proposal-<id>.html`. O script
 * `scripts/qa/generate-proposal-pdf.mjs` converte todos em PDF via Playwright.
 *
 * Adicione novas variações em `fixtures/index.ts` — este teste itera
 * automaticamente e o workflow `pdf-quality` empacota tudo como artifact.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import React from 'react';
import { ProposalHtmlTemplate } from '../../ProposalHtmlTemplate';
import { PROPOSAL_FIXTURES } from './fixtures';

function wrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=794" />
  <title>${title} — Amostra QA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; background: #e5e7eb; }
    @media print { body { background: #fff; } }
    @page { size: A4; margin: 0; }
    .qa-banner {
      position: fixed; top: 8px; right: 8px; z-index: 9999;
      background: #111; color: #fff; padding: 6px 10px;
      font: 500 11px/1.2 system-ui, sans-serif; border-radius: 4px;
    }
    @media print { .qa-banner { display: none; } }
  </style>
</head>
<body>
  <div class="qa-banner">QA · ${title} · gerada por vitest</div>
  ${body}
</body>
</html>`;
}

describe('QA export — todas as fixtures de proposta', () => {
  it.each(PROPOSAL_FIXTURES)(
    'gera qa/exports/proposal-$id.html a partir da fixture "$label"',
    ({ id, label, data }) => {
      const body = renderToStaticMarkup(<ProposalHtmlTemplate data={data} />);
      const html = wrapper(label, body);
      const outPath = join(process.cwd(), 'qa', 'exports', `proposal-${id}.html`);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, html, 'utf8');

      // Invariantes por fixture — falhas indicam regressão do template.
      expect(html).toContain(data.quoteNumber);
      expect(html).toContain(data.client.company || data.client.name);
      expect(html).toMatch(new RegExp(data.items[0].name.split(' ').slice(0, 2).join(' ')));
      expect(html.length).toBeGreaterThan(2000);
    },
  );
});
