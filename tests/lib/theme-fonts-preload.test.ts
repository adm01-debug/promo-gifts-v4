/**
 * Garante que o `index.html` pré-carrega TODAS as fontes que o sistema
 * de skins precisa: Plus Jakarta Sans (clássicas), Outfit (clássicas) e
 * Inter (skins Opera GX, família do Cloudflare Sans).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

describe('index.html — preload de fontes', () => {
  it('carrega Plus Jakarta Sans (default sans)', () => {
    expect(indexHtml).toContain('Plus+Jakarta+Sans');
  });

  it('carrega Outfit (default display)', () => {
    expect(indexHtml).toContain('Outfit');
  });

  it('carrega Inter (skins Opera GX → família Cloudflare Sans)', () => {
    expect(indexHtml).toContain('Inter');
  });

  it('usa preload + media swap para não bloquear render', () => {
    expect(indexHtml).toMatch(/rel="preload"\s+as="style"/);
    expect(indexHtml).toMatch(/media="print"\s+onload="this\.media='all'"/);
  });

  it('inclui fallback <noscript> com a stylesheet', () => {
    expect(indexHtml).toContain('<noscript>');
    // Inter foi removido do preload via Google Fonts (carregado via CSS local nas GX skins).
    // noscript contém apenas Outfit + Plus Jakarta Sans.
    expect(indexHtml).toMatch(/<noscript>[\s\S]*rel="stylesheet"[\s\S]*<\/noscript>/);
    expect(indexHtml).toMatch(/<noscript>[\s\S]*Outfit[\s\S]*<\/noscript>/);
  });

  it('a CSP autoriza fonts.googleapis.com (style-src) e fonts.gstatic.com (font-src)', () => {
    expect(indexHtml).toContain('https://fonts.googleapis.com');
    expect(indexHtml).toContain('https://fonts.gstatic.com');
  });
});
