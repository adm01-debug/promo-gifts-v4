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

  describe('separadores e siglas incomuns', () => {
    it('padroniza pipe sem espaços (DTF|uv)', () => {
      expect(formatEngravingTitle({ nomeTabela: 'DTF|uv' })).toBe('DTF | UV');
    });

    it('normaliza combinação hífen + sigla (3D-uv)', () => {
      expect(formatEngravingTitle({ nomeTabela: '3D-uv' })).toBe('3D | UV');
    });

    it('normaliza múltiplos separadores encadeados', () => {
      expect(formatEngravingTitle({ nomeTabela: 'fiber laser / plana - dourada' })).toBe(
        'Fiber Laser | Plana | Dourada',
      );
    });

    it('remove segmentos vazios entre separadores duplicados', () => {
      expect(formatEngravingTitle({ nomeTabela: 'fiber laser || plana' })).toBe(
        'Fiber Laser | Plana',
      );
    });

    it('preserva siglas em qualquer posição', () => {
      expect(formatEngravingTitle({ nomeTabela: 'gravação uv em pu' })).toBe('Gravação UV Em PU');
    });

    it('normaliza mistura de en-dash e em-dash', () => {
      expect(formatEngravingTitle({ nomeTabela: 'fiber laser – plana — dourada' })).toBe(
        'Fiber Laser | Plana | Dourada',
      );
    });

    it('aceita tokens numéricos compostos (10ml)', () => {
      expect(formatEngravingTitle({ nomeTabela: 'tampografia 10ml' })).toBe('Tampografia 10ML');
    });

    it('respeita fallback custom quando tudo vazio', () => {
      expect(formatEngravingTitle({ fallback: 'Sem gravação' })).toBe('Sem gravação');
    });
  });

  describe('fallback via grupo_tecnica', () => {
    it('usa apenas groupName quando nome_tabela e techniqueName ausentes', () => {
      expect(formatEngravingTitle({ groupName: 'laser' })).toBe('Laser');
    });

    it('formata groupName com separadores e siglas', () => {
      expect(formatEngravingTitle({ groupName: 'laser/uv' })).toBe('Laser | UV');
    });

    it('ignora groupName vazio/whitespace e cai no fallback default', () => {
      expect(formatEngravingTitle({ groupName: '   ' })).toBe('Gravação confirmada');
      expect(formatEngravingTitle({ groupName: '' })).toBe('Gravação confirmada');
      expect(formatEngravingTitle({ groupName: null })).toBe('Gravação confirmada');
    });

    it('ignora groupName quando nome_tabela está presente (precedência correta)', () => {
      expect(
        formatEngravingTitle({ nomeTabela: 'Fiber Laser', groupName: 'outra coisa' }),
      ).toBe('Fiber Laser');
    });

    it('cai para groupName quando techniqueName é whitespace', () => {
      expect(
        formatEngravingTitle({ nomeTabela: '', techniqueName: '   ', groupName: 'dtf' }),
      ).toBe('DTF');
    });

    it('normaliza groupName composto (ex.: "gravação 3d")', () => {
      expect(formatEngravingTitle({ groupName: 'gravação 3d' })).toBe('Gravação 3D');
    });
  });
});
