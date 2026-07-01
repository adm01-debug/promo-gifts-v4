import { describe, it, expect } from 'vitest';
import { formatEngravingTitle } from '@/lib/customization/format-engraving-title';

describe('formatEngravingTitle', () => {
  it('prioriza nome_tabela quando disponível', () => {
    expect(
      formatEngravingTitle({
        nomeTabela: 'FIBER LASER | PLANA',
        techniqueName: 'outro',
      }),
    ).toBe('Fiber Laser | Plana');
  });

  it('usa techniqueName como fallback quando nome_tabela vazio', () => {
    expect(
      formatEngravingTitle({ nomeTabela: '   ', techniqueName: 'serigrafia' }),
    ).toBe('Serigrafia');
  });

  it('usa groupName como último fallback antes do default', () => {
    expect(
      formatEngravingTitle({ nomeTabela: null, techniqueName: null, groupName: 'laser' }),
    ).toBe('Laser');
  });

  it('retorna fallback padrão quando tudo está vazio', () => {
    expect(formatEngravingTitle({})).toBe('Gravação confirmada');
  });

  it('normaliza separadores variados para " | "', () => {
    expect(formatEngravingTitle({ nomeTabela: 'fiber laser/plana' })).toBe('Fiber Laser | Plana');
    expect(formatEngravingTitle({ nomeTabela: 'fiber laser - plana' })).toBe('Fiber Laser | Plana');
    expect(formatEngravingTitle({ nomeTabela: 'fiber laser–plana' })).toBe('Fiber Laser | Plana');
  });

  it('preserva siglas em caixa alta e tokens numéricos', () => {
    expect(formatEngravingTitle({ nomeTabela: 'impressão uv | 3d' })).toBe('Impressão UV | 3D');
    expect(formatEngravingTitle({ nomeTabela: 'DTF | plana' })).toBe('DTF | Plana');
  });

  it('colapsa espaços múltiplos', () => {
    expect(formatEngravingTitle({ nomeTabela: '  fiber   laser   |   plana  ' })).toBe(
      'Fiber Laser | Plana',
    );
  });
});
