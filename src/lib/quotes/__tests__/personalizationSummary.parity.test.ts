/**
 * Paridade visual entre PDF/CRM sync e o cabeçalho da gravação confirmada
 * do builder. Ambos devem passar pelo SSOT `formatEngravingTitle`, garantindo
 * mesmo padrão " | ", capitalização e siglas.
 *
 * Se alguém introduzir uma divergência (ex.: PDF exibindo "fiber laser/plana"
 * enquanto o builder exibe "Fiber Laser | Plana"), este teste quebra.
 */
import { describe, it, expect } from 'vitest';
import { formatTechniqueWithLocation } from '../personalizationSummary';
import { formatEngravingTitle } from '@/lib/customization/format-engraving-title';

describe('paridade PDF/CRM ↔ builder — nome da gravação', () => {
  const cases = [
    'FIBER LASER | PLANA',
    'fiber laser/plana',
    'DTF|uv',
    '3D-uv',
    'tampografia 10ml',
    'gravação uv',
    '  fiber   laser   |   plana  ',
  ];

  for (const raw of cases) {
    it(`padroniza "${raw}" idêntico em PDF/CRM e builder`, () => {
      const builderHeader = formatEngravingTitle({
        nomeTabela: raw,
        fallback: 'Gravação confirmada',
      });
      const pdfLabel = formatTechniqueWithLocation({ technique_name: raw });
      expect(pdfLabel).toBe(builderHeader);
    });
  }

  it('inclui prefixo [Local] mantendo o nome formatado idêntico ao builder', () => {
    const raw = 'fiber laser/plana';
    const formatted = formatEngravingTitle({ nomeTabela: raw });
    expect(formatTechniqueWithLocation({ technique_name: raw, location_name: 'Frente' })).toBe(
      `[Frente] ${formatted}`,
    );
  });

  it('mantém fallback quando technique_name ausente (não quebra CRM sync)', () => {
    expect(formatTechniqueWithLocation({})).toBe('Personalização');
    expect(formatTechniqueWithLocation({ technique_name: '   ' })).toBe('Personalização');
  });
});
