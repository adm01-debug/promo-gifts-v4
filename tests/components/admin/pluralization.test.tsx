import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Reaproveita os mesmos mocks usados em SecretField.test.tsx para isolar I/O
// e focar exclusivamente na pluralização ("1 caractere" vs "N caracteres").
const setSecretMock = vi.fn();
const rotateSecretMock = vi.fn();
const getRotationHistoryMock = vi.fn().mockResolvedValue([]);
vi.mock("@/hooks/admin/useSecretsManager", () => ({
  useSecretsManager: () => ({ setSecret: setSecretMock, rotateSecret: rotateSecretMock, getRotationHistory: getRotationHistoryMock }),
}));
vi.mock("@/hooks/intelligence/useConnectionTestDetails", () => ({
  useConnectionTestDetails: () => ({ details: null, loading: false, error: null, refresh: vi.fn() }),
}));
vi.mock("@/components/admin/connections/CredentialsSourceFilterContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/admin/connections/CredentialsSourceFilterContext")>();
  return {
    ...actual,
    useCredentialsSourceFilter: () => ({ matchesFilter: () => true, filter: "all" }),
  };
});
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import { SecretField } from "@/components/admin/connections/SecretField";
import { MaskedSuffixBadge } from "@/components/admin/connections/MaskedSuffixBadge";
import { diagnoseMaskedSuffix } from "@/lib/masked-suffix";

// ============================================================================
// 1) Função pura: diagnoseMaskedSuffix — pluralização da mensagem do tooltip
// ============================================================================
describe("diagnoseMaskedSuffix — pluralização (1 caractere vs N caracteres)", () => {
  it("1 char → singular ('1 caractere ' com espaço, sem 's')", () => {
    const m = diagnoseMaskedSuffix("a").message;
    // Match exato com word boundary para garantir "caractere" e NÃO "caracteres".
    expect(m).toMatch(/\b1 caractere\b/);
    expect(m).not.toMatch(/\b1 caracteres\b/);
  });

  it("2 chars → plural ('2 caracteres')", () => {
    const m = diagnoseMaskedSuffix("ab").message;
    expect(m).toMatch(/\b2 caracteres\b/);
    expect(m).not.toMatch(/\b2 caractere\b/);
  });

  it("3 chars → plural ('3 caracteres')", () => {
    const m = diagnoseMaskedSuffix("abc").message;
    expect(m).toMatch(/\b3 caracteres\b/);
    expect(m).not.toMatch(/\b3 caractere\b/);
  });

  it("não usa '(s)' parentético em nenhum caso", () => {
    for (const v of ["a", "ab", "abc"]) {
      expect(diagnoseMaskedSuffix(v).message).not.toContain("caractere(s)");
    }
  });
});

// ============================================================================
// 2) UI: MaskedSuffixBadge propaga a pluralização para aria-label
// ============================================================================
describe("MaskedSuffixBadge — aria-label pluralizado", () => {
  function renderBadge(suffix: string | null) {
    return render(
      <TooltipProvider>
        <MaskedSuffixBadge suffix={suffix} />
      </TooltipProvider>,
    );
  }

  it("1 char → aria-label contém '1 caractere' singular", () => {
    renderBadge("a");
    const aria = screen.getByRole("status").getAttribute("aria-label") ?? "";
    expect(aria).toMatch(/\b1 caractere\b/);
    expect(aria).not.toMatch(/\b1 caracteres\b/);
  });

  it.each([
    [2, "ab"],
    [3, "abc"],
  ])("%i chars → aria-label contém '%i caracteres' plural", (n, value) => {
    renderBadge(value);
    const aria = screen.getByRole("status").getAttribute("aria-label") ?? "";
    expect(aria).toMatch(new RegExp(`\\b${n} caracteres\\b`));
    expect(aria).not.toMatch(new RegExp(`\\b${n} caractere\\b(?!s)`));
  });
});

// ============================================================================
// 3) UI: Banner crítico do SecretField — pluralização do "tem apenas N…"
// ============================================================================
describe("SecretField — banner pluraliza 'tem apenas N caractere(s)'", () => {
  beforeEach(() => {
    setSecretMock.mockReset();
    rotateSecretMock.mockReset();
    sessionStorage.clear();
  });

  function renderField() {
    return render(
      <TooltipProvider>
        <SecretField label="MCP" secretName="MCP_SHARED_SECRET" />
      </TooltipProvider>,
    );
  }

  function setValue(v: string) {
    fireEvent.click(screen.getByRole("button", { name: /^Alterar$/i }));
    fireEvent.change(screen.getByPlaceholderText(/Novo valor para/i), {
      target: { value: v },
    });
  }

  it("1 char → 'O valor tem apenas 1 caractere' (singular, sem 's')", () => {
    renderField();
    setValue("x");
    const alert = screen.getByRole("alert");
    expect(alert.textContent ?? "").toMatch(/O valor tem apenas 1 caractere\b/);
    // Garante que NÃO escreveu "1 caracteres".
    expect(alert.textContent ?? "").not.toMatch(/O valor tem apenas 1 caracteres/);
  });

  it.each([2, 3])("%i chars → 'O valor tem apenas %i caracteres' (plural)", (n) => {
    renderField();
    setValue("x".repeat(n));
    const alert = screen.getByRole("alert");
    expect(alert.textContent ?? "").toMatch(new RegExp(`O valor tem apenas ${n} caracteres\\b`));
    expect(alert.textContent ?? "").not.toMatch(new RegExp(`O valor tem apenas ${n} caractere\\b(?!s)`));
  });

  it("o limite (4) na mensagem permanece sempre plural ('4 caracteres')", () => {
    renderField();
    setValue("x");
    const alert = screen.getByRole("alert");
    // Cabeçalho e razão usam o limite 4 — sempre plural.
    expect(alert.textContent ?? "").toContain("mínimo 4 caracteres");
    expect(alert.textContent ?? "").toContain("pelo menos 4 caracteres");
  });
});
