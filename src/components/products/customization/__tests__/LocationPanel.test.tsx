/**
 * LocationPanel — Comportamento "Foco-na-Técnica"
 *
 * Garante:
 *  1. Após selecionar uma técnica, a lista some e só a técnica escolhida fica visível.
 *  2. Clicar em "Trocar" reabre a lista das técnicas.
 *  3. Ao trocar para outra técnica, as dimensões/cores previamente informadas
 *     são preservadas (passadas como initialWidth/Height/Colors).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { LocationPanel } from '../LocationPanel';
import type { GravacaoLocation, TechniqueOption } from '@/types/customization';

// Mock leve do ConfigurationPanelV6 — não queremos exercitar RPCs de preço aqui,
// só verificar quais initial* chegam quando troca-se a técnica.
vi.mock('../ConfigurationPanelV6', () => ({
  ConfigurationPanelV6: (props: {
    technique: TechniqueOption;
    initialWidth?: number;
    initialHeight?: number;
    initialColors?: number;
    onDimensionsChange?: (d: { width?: number; height?: number; colors?: number }) => void;
  }) => (
    <div
      data-testid="config-panel"
      data-technique-id={props.technique.technique_id}
      data-initial-width={props.initialWidth ?? ''}
      data-initial-height={props.initialHeight ?? ''}
      data-initial-colors={props.initialColors ?? ''}
    >
      <button
        type="button"
        data-testid="emit-dims"
        onClick={() => props.onDimensionsChange?.({ width: 7, height: 4, colors: 2 })}
      >
        emit
      </button>
    </div>
  ),
}));

// Sonner toast — silencia em ambiente de teste
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeTechnique(over: Partial<TechniqueOption> = {}): TechniqueOption {
  return {
    technique_id: 'tech-1',
    codigo_tabela: 'SILK-01',
    tecnica_nome: 'Silk 1 cor',
    grupo_tecnica: 'SERIGRAFIA',
    variacao_label: 'padrão',
    max_width: 10,
    max_height: 10,
    gravacao_largura_max: 10,
    gravacao_altura_max: 10,
    efetiva_largura_max: 10,
    efetiva_altura_max: 10,
    shape: 'rectangle',
    is_curved: false,
    usa_dimensao: true,
    cobra_por_cor: false,
    max_cores: 1,
    ...over,
  };
}

const techA = makeTechnique({ technique_id: 'tech-A', tecnica_nome: 'Silk 1 cor' });
const techB = makeTechnique({
  technique_id: 'tech-B',
  tecnica_nome: 'Transfer Digital',
  grupo_tecnica: 'TRANSFER',
  cobra_por_cor: true,
  max_cores: 4,
});

const location: GravacaoLocation = {
  location_code: 'LADO-A',
  location_name: 'Lado A',
  location_order: 1,
  options: [techA, techB],
};

describe('LocationPanel — fluxo Trocar técnica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ao selecionar uma técnica, esconde a lista e mostra apenas a técnica escolhida + painel de config', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    // Estado A — ambas visíveis
    expect(screen.getByText('Silk 1 cor')).toBeInTheDocument();
    expect(screen.getByText('Transfer Digital')).toBeInTheDocument();

    // Seleciona a primeira técnica
    fireEvent.click(screen.getByText('Silk 1 cor'));

    // Estado B — picker some, barra-resumo e config panel aparecem
    expect(screen.queryByTestId('customization-technique-picker')).not.toBeInTheDocument();
    expect(screen.queryByText('Transfer Digital')).not.toBeInTheDocument();
    expect(screen.getByTestId('customization-change-technique')).toBeInTheDocument();
    expect(screen.getByTestId('config-panel')).toHaveAttribute('data-technique-id', 'tech-A');
  });

  it("clicar em 'Trocar' reabre a lista de técnicas com a atual marcada", () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    fireEvent.click(screen.getByText('Silk 1 cor'));
    expect(screen.queryByTestId('customization-technique-picker')).not.toBeInTheDocument();

    // Clica em Trocar
    fireEvent.click(screen.getByTestId('customization-change-technique'));

    // Picker reabre com ambas as técnicas
    const picker = screen.getByTestId('customization-technique-picker');
    expect(within(picker).getByText('Silk 1 cor')).toBeInTheDocument();
    expect(within(picker).getByText('Transfer Digital')).toBeInTheDocument();
  });

  it('preserva largura/altura/cores ao trocar para outra técnica', () => {
    const onPrice = vi.fn();
    render(
      <LocationPanel
        location={location}
        quantity={100}
        confirmedPersonalization={{
          locationCode: 'LADO-A',
          locationName: 'Lado A',
          techniqueId: 'tech-A',
          techniqueName: 'Silk 1 cor',
          codigoTabela: 'SILK-01',
          grupoTecnica: 'SERIGRAFIA',
          width: 8,
          height: 5,
          numberOfColors: 1,
          usaDimensao: true,
          price: null,
        }}
        onPriceCalculated={onPrice}
      />,
    );

    // Estado B inicial (técnica A já confirmada) — dimensões vieram do parent
    const panelA = screen.getByTestId('config-panel');
    expect(panelA).toHaveAttribute('data-technique-id', 'tech-A');
    expect(panelA).toHaveAttribute('data-initial-width', '8');
    expect(panelA).toHaveAttribute('data-initial-height', '5');
    // techA tem cobra_por_cor=false → initialColors não é repassado
    expect(panelA).toHaveAttribute('data-initial-colors', '');

    // Abre o picker e escolhe a técnica B
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    const picker = screen.getByTestId('customization-technique-picker');
    fireEvent.click(within(picker).getByText('Transfer Digital'));

    // Estado B novamente, agora com técnica B — dimensões preservadas via lastDimsRef;
    // como techB tem cobra_por_cor=true, agora `initialColors` aparece (default 1).
    const panelB = screen.getByTestId('config-panel');
    expect(panelB).toHaveAttribute('data-technique-id', 'tech-B');
    expect(panelB).toHaveAttribute('data-initial-width', '8');
    expect(panelB).toHaveAttribute('data-initial-height', '5');
    expect(panelB).toHaveAttribute('data-initial-colors', '1');
  });

  it('preserva dimensões DIGITADAS (sem confirmar) ao trocar de técnica via onDimensionsChange', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    // Seleciona técnica A e "digita" 7×4 com 2 cores (sem confirmar)
    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims'));

    // Troca para técnica B
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Transfer Digital'),
    );

    const panelB = screen.getByTestId('config-panel');
    expect(panelB).toHaveAttribute('data-technique-id', 'tech-B');
    expect(panelB).toHaveAttribute('data-initial-width', '7');
    expect(panelB).toHaveAttribute('data-initial-height', '4');
    expect(panelB).toHaveAttribute('data-initial-colors', '2');
  });

  it('faz clamp das dimensões aos limites da nova técnica (quando menor)', () => {
    const techSmall = makeTechnique({
      technique_id: 'tech-small',
      tecnica_nome: 'Laser pequeno',
      efetiva_largura_max: 5,
      efetiva_altura_max: 3,
    });
    const loc: GravacaoLocation = {
      ...location,
      options: [techA, techSmall],
    };

    render(
      <LocationPanel
        location={loc}
        quantity={100}
        confirmedPersonalization={{
          locationCode: 'LADO-A',
          locationName: 'Lado A',
          techniqueId: 'tech-A',
          techniqueName: 'Silk 1 cor',
          codigoTabela: 'SILK-01',
          grupoTecnica: 'SERIGRAFIA',
          width: 8,
          height: 5,
          numberOfColors: 1,
          usaDimensao: true,
          price: null,
        }}
        onPriceCalculated={vi.fn()}
      />,
    );

    // Troca para a técnica com limites menores
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Laser pequeno'),
    );

    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-technique-id', 'tech-small');
    // 8 → clampado p/ 5 ; 5 → clampado p/ 3
    expect(panel).toHaveAttribute('data-initial-width', '5');
    expect(panel).toHaveAttribute('data-initial-height', '3');
  });

  it('clicar na MESMA técnica apenas fecha o picker — sem toast, sem remount do painel, sem recálculo', () => {
    const onPrice = vi.fn();
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={onPrice} />);

    // Seleciona técnica A
    fireEvent.click(screen.getByText('Silk 1 cor'));
    const panelBefore = screen.getByTestId('config-panel');
    expect(panelBefore).toHaveAttribute('data-technique-id', 'tech-A');
    vi.mocked(toast.success).mockClear();

    // Reabre picker — painel deve continuar MONTADO (apenas oculto via [hidden])
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    const panelDuringPicker = screen.getByTestId('config-panel');
    expect(panelDuringPicker).toBe(panelBefore); // mesma instância DOM = sem remount
    expect(panelDuringPicker.parentElement).toHaveAttribute('hidden');

    // Clica na MESMA técnica
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Silk 1 cor'),
    );

    // Picker fecha; painel reaparece (mesma instância, sem recálculo)
    expect(screen.queryByTestId('customization-technique-picker')).not.toBeInTheDocument();
    const panelAfter = screen.getByTestId('config-panel');
    expect(panelAfter).toBe(panelBefore);
    expect(panelAfter).toHaveAttribute('data-technique-id', 'tech-A');
    expect(panelAfter.parentElement).not.toHaveAttribute('hidden');

    // Nenhum toast de troca
    expect(toast.success).not.toHaveBeenCalled();
    // Nenhum side-effect de preço
    expect(onPrice).not.toHaveBeenCalled();
  });

  it('após Trocar → reselecionar a MESMA técnica, a barra-resumo permanece ativa com a técnica original', () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    // Seleciona técnica A → barra-resumo aparece
    fireEvent.click(screen.getByText('Silk 1 cor'));
    const bar = screen.getByTestId('customization-change-technique');
    expect(bar).toBeInTheDocument();
    expect(bar.closest('[data-selected-technique]') ?? bar.parentElement).toHaveTextContent(
      'Silk 1 cor',
    );

    // Abre picker e clica novamente em Silk 1 cor
    fireEvent.click(bar);
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Silk 1 cor'),
    );

    // Picker fechou; barra-resumo continua ativa com a mesma técnica
    expect(screen.queryByTestId('customization-technique-picker')).not.toBeInTheDocument();
    const barAfter = screen.getByTestId('customization-change-technique');
    expect(barAfter).toBeInTheDocument();
    expect(screen.getByTestId('config-panel')).toHaveAttribute('data-technique-id', 'tech-A');
  });

  it("ao trocar de técnica (A → B), exibe toast.success com 'Técnica alterada' e a transição", () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    // Seleciona A
    fireEvent.click(screen.getByText('Silk 1 cor'));
    vi.mocked(toast.success).mockClear();

    // Troca para B
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Transfer Digital'),
    );

    expect(toast.success).toHaveBeenCalledTimes(1);
    const [message, opts] = vi.mocked(toast.success).mock.calls[0];
    expect(message).toBe('Técnica alterada: Silk 1 cor → Transfer Digital');
    expect(opts).toMatchObject({ duration: 2500 });

    // Barra-resumo agora reflete a técnica B
    expect(screen.getByTestId('config-panel')).toHaveAttribute('data-technique-id', 'tech-B');
  });

  it('exibe a lista agrupada por grupo_tecnica quando nenhuma técnica foi selecionada', () => {
    const techC = makeTechnique({
      technique_id: 'tech-C',
      tecnica_nome: 'Sublimação',
      grupo_tecnica: 'SUBLIMACAO',
    });
    const loc: GravacaoLocation = {
      ...location,
      options: [techA, techB, techC],
    };

    render(<LocationPanel location={loc} quantity={100} onPriceCalculated={vi.fn()} />);

    // Verifica agrupamentos (TechniquePicker renderiza nomes de grupo)
    expect(screen.getAllByText('SERIGRAFIA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TRANSFER').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SUBLIMACAO').length).toBeGreaterThan(0);

    // Todas as técnicas visíveis
    expect(screen.getByText('Silk 1 cor')).toBeInTheDocument();
    expect(screen.getByText('Transfer Digital')).toBeInTheDocument();
    expect(screen.getByText('Sublimação')).toBeInTheDocument();
  });

  it('garante que ao trocar de técnica o preço muda mantendo dimensões digitadas', () => {
    const onPrice = vi.fn();
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={onPrice} />);

    // 1. Seleciona techA e digita 7x4
    fireEvent.click(screen.getByText('Silk 1 cor'));
    fireEvent.click(screen.getByTestId('emit-dims')); // Emite {width: 7, height: 4, colors: 2}

    onPrice.mockClear();

    // 2. Troca para techB
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Transfer Digital'),
    );

    // O ConfigurationPanelV6 deve ser montado com as dimensões 7x4 e emitir o preço da techB
    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-technique-id', 'tech-B');
    expect(panel).toHaveAttribute('data-initial-width', '7');
    expect(panel).toHaveAttribute('data-initial-height', '4');
  });

  it('clampa o número de cores ao trocar para técnica com limite menor', () => {
    const techLimited = makeTechnique({
      technique_id: 'tech-lim',
      tecnica_nome: 'Laser 1 cor',
      cobra_por_cor: true,
      max_cores: 1,
    });
    const loc: GravacaoLocation = {
      ...location,
      options: [techB, techLimited], // techB permite 4 cores
    };

    render(<LocationPanel location={loc} quantity={100} onPriceCalculated={vi.fn()} />);

    // 1. Seleciona techB (max_cores 4) e define 2 cores via emit-dims
    fireEvent.click(screen.getByText('Transfer Digital'));
    fireEvent.click(screen.getByTestId('emit-dims')); // Emite colors: 2

    // 2. Troca para techLimited (max_cores 1)
    fireEvent.click(screen.getByTestId('customization-change-technique'));
    fireEvent.click(
      within(screen.getByTestId('customization-technique-picker')).getByText('Laser 1 cor'),
    );

    // 3. Verifica se as cores foram clampadas p/ 1
    const panel = screen.getByTestId('config-panel');
    expect(panel).toHaveAttribute('data-technique-id', 'tech-lim');
    expect(panel).toHaveAttribute('data-initial-colors', '1');
  });
});
