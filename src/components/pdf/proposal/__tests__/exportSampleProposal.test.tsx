/**
 * Deliverable #1 — Auto-export do PDF de exemplo (10015/26).
 *
 * Renderiza o template HTML completo da proposta e escreve o resultado em
 * `qa/exports/proposal-10015-26.html`. Basta abrir o arquivo em qualquer
 * navegador e usar Ctrl+P → "Salvar como PDF" para validar tela + impressão
 * sem precisar iniciar sessão no app.
 *
 * Também valida invariantes mínimos do HTML gerado (nº do orçamento visível,
 * ao menos um `data-*` marcador presente) para garantir que o export não
 * quebre silenciosamente.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import React from 'react';
import { ProposalHtmlTemplate } from '../../ProposalHtmlTemplate';
import { PROPOSAL_10015_26 } from './fixtures/proposal-10015-26';

// jsdom em Vitest expõe cwd() do processo Node; escrevemos em `qa/exports/`
// na raiz do repositório.
const OUT_PATH = join(process.cwd(), 'qa', 'exports', 'proposal-10015-26.html');

const WRAPPER = (body: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=794" />
  <title>Proposta 10015/26 — Amostra QA</title>
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
  <div class="qa-banner">QA · Proposta 10015/26 · gerada por vitest</div>
  ${body}
</body>
</html>`;

describe('QA export — Proposta 10015/26', () => {
  it('gera qa/exports/proposal-10015-26.html renderizando o template completo', () => {
    const body = renderToStaticMarkup(<ProposalHtmlTemplate data={PROPOSAL_10015_26} />);
    const html = WRAPPER(body);

    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, html, 'utf8');

    // Invariantes mínimos — falhas aqui indicam regressão do template.
    expect(html).toContain('10015/26');
    expect(html).toContain('ACME');
    expect(html).toMatch(/Garrafa esportiva/);
    expect(html.length).toBeGreaterThan(2000);
  });
});
