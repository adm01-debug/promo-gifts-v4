/**
 * Lock estrutural do layout da QuoteItemsTable.
 *
 * Garante invariantes que evitam:
 *  - scroll horizontal (min-w fixo / overflow-x-auto no container do corpo)
 *  - "Detalhes" caindo para fora do layout (coluna de ações sem largura reservada)
 *  - Coluna Produto espremendo o nome em mobile (largura fixa em %)
 *
 * Lock via leitura do source — determinístico e estável entre viewports.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../QuoteItemsTable.tsx'), 'utf8');

describe('QuoteItemsTable — layout invariants', () => {
  it('coluna Produto usa clamp(180px, 26%, 280px) — respira em mobile sem estourar em desktop', () => {
    expect(SRC).toMatch(/width:\s*'clamp\(180px,\s*26%,\s*280px\)'/);
  });

  it('coluna de ações reserva ≥6rem para o botão "Detalhes" não vazar', () => {
    expect(SRC).toMatch(/width:\s*'6rem'.*print:hidden/);
  });

  it('tabelas (header e corpo) NÃO usam min-w-[...] — previne scroll horizontal', () => {
    expect(SRC).not.toMatch(/min-w-\[\d+px\]/);
  });

  it('container do corpo da tabela usa overflow-x-hidden (não overflow-x-auto)', () => {
    expect(SRC).toMatch(/'overflow-x-hidden'/);
    expect(SRC).not.toMatch(/'overflow-x-auto'/);
  });

  it('larguras das colunas numéricas (qtd/unitário/total) permanecem fixas para alinhamento', () => {
    expect(SRC).toMatch(/width:\s*'3\.5rem'/); // qtd
    expect(SRC).toMatch(/width:\s*'5\.5rem'/); // unitário
    expect(SRC).toMatch(/width:\s*'6\.5rem'/); // total
  });
});
