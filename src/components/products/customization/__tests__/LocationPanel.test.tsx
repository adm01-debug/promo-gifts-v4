/**
 * LocationPanel — Comportamento "Foco-na-Técnica"
 *
 * Garante:
 *  1. Após selecionar uma técnica, a lista some e só a técnica escolhida fica visível.
 *  2. Clicar em "Trocar" reabre a lista das técnicas.
 *  3. Ao trocar para outra técnica, as dimensões/cores previamente informadas
 *     são preservadas (passadas como initialWidth/Height/Colors).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { LocationPanel } from "../LocationPanel";
import type { GravacaoLocation, TechniqueOption } from "@/types/customization";

// Mock leve do ConfigurationPanelV6 — não queremos exercitar RPCs de preço aqui,
// só verificar quais initial* chegam quando troca-se a técnica.
vi.mock("../ConfigurationPanelV6", () => ({
  ConfigurationPanelV6: (props: {
    technique: TechniqueOption;
    initialWidth?: number;
    initialHeight?: number;
    initialColors?: number;
  }) => (
    <div
      data-testid="config-panel"
      data-technique-id={props.technique.technique_id}
      data-initial-width={props.initialWidth ?? ""}
      data-initial-height={props.initialHeight ?? ""}
      data-initial-colors={props.initialColors ?? ""}
    />
  ),
}));

// Sonner toast — silencia em ambiente de teste
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeTechnique(over: Partial<TechniqueOption> = {}): TechniqueOption {
  return {
    technique_id: "tech-1",
    codigo_tabela: "SILK-01",
    tecnica_nome: "Silk 1 cor",
    grupo_tecnica: "SERIGRAFIA",
    variacao_label: "padrão",
    max_width: 10,
    max_height: 10,
    gravacao_largura_max: 10,
    gravacao_altura_max: 10,
    efetiva_largura_max: 10,
    efetiva_altura_max: 10,
    shape: "rectangle",
    is_curved: false,
    usa_dimensao: true,
    cobra_por_cor: false,
    max_cores: 1,
    ...over,
  };
}

const techA = makeTechnique({ technique_id: "tech-A", tecnica_nome: "Silk 1 cor" });
const techB = makeTechnique({
  technique_id: "tech-B",
  tecnica_nome: "Transfer Digital",
  grupo_tecnica: "TRANSFER",
  cobra_por_cor: true,
  max_cores: 4,
});

const location: GravacaoLocation = {
  location_code: "LADO-A",
  location_name: "Lado A",
  location_order: 1,
  options: [techA, techB],
};

describe("LocationPanel — fluxo Trocar técnica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ao selecionar uma técnica, esconde a lista e mostra apenas a técnica escolhida + painel de config", () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    // Estado A — ambas visíveis
    expect(screen.getByText("Silk 1 cor")).toBeInTheDocument();
    expect(screen.getByText("Transfer Digital")).toBeInTheDocument();

    // Seleciona a primeira técnica
    fireEvent.click(screen.getByText("Silk 1 cor"));

    // Estado B — picker some, barra-resumo e config panel aparecem
    expect(screen.queryByTestId("customization-technique-picker")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer Digital")).not.toBeInTheDocument();
    expect(screen.getByTestId("customization-change-technique")).toBeInTheDocument();
    expect(screen.getByTestId("config-panel")).toHaveAttribute("data-technique-id", "tech-A");
  });

  it("clicar em 'Trocar' reabre a lista de técnicas com a atual marcada", () => {
    render(<LocationPanel location={location} quantity={100} onPriceCalculated={vi.fn()} />);

    fireEvent.click(screen.getByText("Silk 1 cor"));
    expect(screen.queryByTestId("customization-technique-picker")).not.toBeInTheDocument();

    // Clica em Trocar
    fireEvent.click(screen.getByTestId("customization-change-technique"));

    // Picker reabre com ambas as técnicas
    const picker = screen.getByTestId("customization-technique-picker");
    expect(within(picker).getByText("Silk 1 cor")).toBeInTheDocument();
    expect(within(picker).getByText("Transfer Digital")).toBeInTheDocument();
  });

  it("preserva largura/altura/cores ao trocar para outra técnica", () => {
    const onPrice = vi.fn();
    render(
      <LocationPanel
        location={location}
        quantity={100}
        confirmedPersonalization={{
          locationCode: "LADO-A",
          locationName: "Lado A",
          techniqueId: "tech-A",
          techniqueName: "Silk 1 cor",
          grupoTecnica: "SERIGRAFIA",
          width: 8,
          height: 5,
          numberOfColors: 1,
          price: null,
        }}
        onPriceCalculated={onPrice}
      />,
    );

    // Estado B inicial (técnica A já confirmada) — dimensões vieram do parent
    const panelA = screen.getByTestId("config-panel");
    expect(panelA).toHaveAttribute("data-technique-id", "tech-A");
    expect(panelA).toHaveAttribute("data-initial-width", "8");
    expect(panelA).toHaveAttribute("data-initial-height", "5");
    expect(panelA).toHaveAttribute("data-initial-colors", "1");

    // Abre o picker e escolhe a técnica B
    fireEvent.click(screen.getByTestId("customization-change-technique"));
    const picker = screen.getByTestId("customization-technique-picker");
    fireEvent.click(within(picker).getByText("Transfer Digital"));

    // Estado B novamente, agora com técnica B — dimensões preservadas via lastDimsRef
    const panelB = screen.getByTestId("config-panel");
    expect(panelB).toHaveAttribute("data-technique-id", "tech-B");
    expect(panelB).toHaveAttribute("data-initial-width", "8");
    expect(panelB).toHaveAttribute("data-initial-height", "5");
    expect(panelB).toHaveAttribute("data-initial-colors", "1");
  });
});
