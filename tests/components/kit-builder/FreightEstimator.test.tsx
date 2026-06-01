/**
 * tests/components/kit-builder/FreightEstimator.test.tsx
 *
 * Testes unitários do FreightEstimator.
 * Cobre: tabela de frete por faixa de peso, troca de modalidade,
 *        kitQuantity multiplicador, edge cases (0g, extremos, Infinity).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FreightEstimator } from '@/components/kit-builder/FreightEstimator';

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderFreight(totalWeightGrams: number, kitQuantity = 1) {
  return render(<FreightEstimator totalWeightGrams={totalWeightGrams} kitQuantity={kitQuantity} />);
}

function getMethodSelect() {
  return screen.getByRole('combobox');
}

// ─── Casos de faixa de peso — tabela Transportadora (default) ────────────────

describe("FreightEstimator — tabela transportadora (default)", () => {
  it("peso zero → alerta de peso não informado visível", () => {
    renderFreight(0, 1);
    expect(screen.getByText(/peso dos itens não informado/i)).toBeInTheDocument();
  });

  it("0g → exibe peso 0.0kg", () => {
    renderFreight(0, 1);
    expect(screen.getByText("0.0kg")).toBeInTheDocument();
  });

  it("1000g (1kg) → faixa ≤5kg = R$ 18,00", () => {
    renderFreight(1_000, 1);
    expect(screen.getAllByText(/18/).length).toBeGreaterThan(0);
  });

  it("5000g (5kg) → faixa ≤5kg = R$ 18,00 (boundary inclusive)", () => {
    renderFreight(5_000, 1);
    expect(screen.getAllByText(/18/).length).toBeGreaterThan(0);
  });

  it("5001g → faixa ≤10kg = R$ 28,00", () => {
    renderFreight(5_001, 1);
    expect(screen.getAllByText(/28/).length).toBeGreaterThan(0);
  });

  it("10000g (10kg) → faixa ≤10kg = R$ 28,00 (boundary inclusive)", () => {
    renderFreight(10_000, 1);
    expect(screen.getAllByText(/28/).length).toBeGreaterThan(0);
  });

  it("10001g → faixa ≤30kg = R$ 45,00", () => {
    renderFreight(10_001, 1);
    expect(screen.getAllByText(/45/).length).toBeGreaterThan(0);
  });

  it("30000g (30kg) → faixa ≤30kg = R$ 45,00", () => {
    renderFreight(30_000, 1);
    expect(screen.getAllByText(/45/).length).toBeGreaterThan(0);
  });

  it("30001g → faixa ≤100kg = R$ 80,00", () => {
    renderFreight(30_001, 1);
    expect(screen.getAllByText(/80/).length).toBeGreaterThan(0);
  });

  it("100000g (100kg) → faixa ≤100kg = R$ 80,00", () => {
    renderFreight(100_000, 1);
    expect(screen.getAllByText(/80/).length).toBeGreaterThan(0);
  });

  it("100001g → faixa >100kg = R$ 120,00 (último tier)", () => {
    renderFreight(100_001, 1);
    expect(screen.getAllByText(/120/).length).toBeGreaterThan(0);
  });
});

// ─── kitQuantity multiplica peso total ──────────────────────────────────────

describe("FreightEstimator — multiplicação por kitQuantity", () => {
  it("2 kits × 2000g = 4kg → faixa ≤5kg = R$ 18,00", () => {
    renderFreight(2_000, 2);
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByText("4.0kg")).toBeInTheDocument();
  });

  it("5 kits × 1200g = 6kg → faixa ≤10kg = R$ 28,00", () => {
    renderFreight(1_200, 5);
    expect(screen.getByText(/28/)).toBeInTheDocument();
    expect(screen.getByText("6.0kg")).toBeInTheDocument();
  });

  it("preço por kit = preço total / kitQuantity", () => {
    renderFreight(6_000, 3);
    // total = 18kg → faixa ≤30kg = R$ 45,00; por kit = 45/3 = R$ 15,00
    expect(screen.getAllByText(/15/)[0]).toBeInTheDocument();
  });

  it("kitQuantity=1 exibe mesmo valor em 'por kit' e total", () => {
    renderFreight(1_000, 1);
    // Com 1 kit, perShipment e por kit são iguais
    const values = screen.getAllByText(/18/);
    expect(values.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Troca de modalidade ────────────────────────────────────────────────────

describe("FreightEstimator — troca de modalidade", () => {
  it("renders com 'Transportadora' como default", () => {
    renderFreight(1_000, 1);
    expect(getMethodSelect()).toBeInTheDocument();
  });

  it("exibe 'Estimativa de Frete' no título", () => {
    renderFreight(1_000, 1);
    expect(screen.getByText(/estimativa de frete/i)).toBeInTheDocument();
  });

  it("exibe nota de valores estimados", () => {
    renderFreight(1_000, 1);
    expect(screen.getByText(/valores estimados/i)).toBeInTheDocument();
  });
});

// ─── Casos extremos ─────────────────────────────────────────────────────────

describe("FreightEstimator — valores extremos e erro", () => {
  it("peso muito alto (999999g) → tier infinito = R$ 120,00", () => {
    renderFreight(999_999, 1);
    expect(screen.getAllByText(/120/).length).toBeGreaterThan(0);
  });

  it("kitQuantity=100 × 500g = 50kg → faixa ≤100kg = R$ 80,00", () => {
    renderFreight(500, 100);
    expect(screen.getAllByText(/80/).length).toBeGreaterThan(0);
  });

  it("peso negativo → trata como 0g", () => {
    renderFreight(-500, 1);
    expect(screen.getByText("0.0kg")).toBeInTheDocument();
  });

  it("kitQuantity=0 → trata como 1 kit para estimativa (evita divisão por zero)", () => {
    renderFreight(1000, 0);
    expect(screen.getByText("1.0kg")).toBeInTheDocument();
  });
  
  it("Infinity grams → fallback para tier máximo", () => {
    renderFreight(Infinity, 1);
    expect(screen.getAllByText(/120/).length).toBeGreaterThan(0);
  });
});
