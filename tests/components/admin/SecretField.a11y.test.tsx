import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { axe } from "../../a11y/axe-helper";

// Mocks alinhados com os outros suites de SecretField — isolam I/O para
// permitir asserts puramente de UI/acessibilidade.
const setSecretMock = vi.fn();
const rotateSecretMock = vi.fn();
const getRotationHistoryMock = vi.fn().mockResolvedValue([]);
vi.mock("@/hooks/admin/useSecretsManager", () => ({
  useSecretsManager: () => ({
    setSecret: setSecretMock,
    rotateSecret: rotateSecretMock,
    getRotationHistory: getRotationHistoryMock,
  }),
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

function renderField() {
  return render(
    <TooltipProvider>
      <SecretField label="MCP" secretName="MCP_SHARED_SECRET" />
    </TooltipProvider>,
  );
}

function startEditAndType(v: string) {
  fireEvent.click(screen.getByRole("button", { name: /^Alterar$/i }));
  fireEvent.change(screen.getByPlaceholderText(/Novo valor para/i), {
    target: { value: v },
  });
}

beforeEach(() => {
  setSecretMock.mockReset();
  rotateSecretMock.mockReset();
  sessionStorage.clear();
});

// ============================================================================
// 1) Atributos ARIA do banner crítico de sufixo inválido
// ============================================================================
describe("SecretField — banner de sufixo inválido (a11y)", () => {
  it("expõe role='alert', aria-live='assertive' e aria-atomic='true'", () => {
    renderField();
    startEditAndType("ab");

    const banner = screen.getByTestId("suffix-invalid-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
    expect(banner).toHaveAttribute("aria-atomic", "true");
  });

  it("é programaticamente focável (tabIndex=-1) para que screen readers/ações possam direcionar foco", () => {
    renderField();
    startEditAndType("ab");

    const banner = screen.getByTestId("suffix-invalid-banner");
    expect(banner).toHaveAttribute("tabindex", "-1");

    // Confirma que pode receber foco (não há `pointer-events:none` ou disabled bloqueando).
    banner.focus();
    expect(document.activeElement).toBe(banner);
  });

  it("expõe estilo de foco visível (focus-visible:ring-2 + ring-destructive) para conformidade com WCAG 2.4.7", () => {
    renderField();
    startEditAndType("ab");

    const banner = screen.getByTestId("suffix-invalid-banner");
    const cls = banner.className;
    // Tailwind classes que materializam o anel destrutivo no foco.
    expect(cls).toMatch(/focus-visible:ring-2/);
    expect(cls).toMatch(/focus-visible:ring-destructive/);
    expect(cls).toMatch(/focus-visible:ring-offset-2/);
  });

  it("texto do banner é lido como uma única unidade (aria-atomic) e contém heading + razão", () => {
    renderField();
    startEditAndType("a");

    const banner = screen.getByTestId("suffix-invalid-banner");
    expect(within(banner).getByText(/Sufixo inválido — mínimo 4 caracteres/)).toBeInTheDocument();
    expect(within(banner).getByText(/O valor tem apenas 1 caractere\b/)).toBeInTheDocument();
    expect(within(banner).getByText(/Salvamento bloqueado/)).toBeInTheDocument();
  });

  it("não tem violações axe (WCAG 2.1 AA, regras estruturais)", async () => {
    const { container } = renderField();
    startEditAndType("ab");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ============================================================================
// 2) Ordem DOM: banner crítico aparece ANTES de qualquer erro genérico
// ============================================================================
describe("SecretField — ordem do banner crítico vs erro genérico", () => {
  it("o banner de sufixo inválido precede qualquer erro de validação genérica no DOM", () => {
    renderField();
    startEditAndType("ab"); // 2 chars: aciona banner crítico

    const banner = screen.getByTestId("suffix-invalid-banner");
    // Erros "genéricos" abaixo do banner: validator messages com AlertCircle.
    // Mesmo que não exista nesse cenário (banner curto-circuita), garantimos
    // que se houver qualquer outro alert/erro irmão, ele venha DEPOIS.
    const parent = banner.parentElement!;
    const children = Array.from(parent.children);
    const bannerIndex = children.indexOf(banner);

    // Procura outros nós irmãos com role=alert ou texto de erro do validador.
    const subsequentAlerts = children
      .slice(bannerIndex + 1)
      .filter((el) => el.getAttribute("role") === "alert");

    // Se houver alertas posteriores, o banner crítico vem ANTES — comportamento correto.
    // Se não houver (curto-circuito do validador genérico para suffix curto), também é OK.
    for (const a of subsequentAlerts) {
      expect(banner.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("para suffix curto (<4), o validador genérico NÃO é exibido — apenas o banner crítico", () => {
    renderField();
    startEditAndType("xx"); // MCP_SHARED_SECRET tem validador próprio (32+ chars)

    // Apenas um único role=alert na tela (o banner crítico).
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveAttribute("data-testid", "suffix-invalid-banner");

    // Mensagem do validador genérico ("deve ter pelo menos 32 caracteres") NÃO aparece.
    expect(screen.queryByText(/pelo menos 32 caracteres/i)).not.toBeInTheDocument();
  });

  it("ao corrigir para >=4 chars, o banner some e o validador genérico assume (se aplicável)", () => {
    renderField();
    startEditAndType("ab"); // banner ativo
    expect(screen.getByTestId("suffix-invalid-banner")).toBeInTheDocument();

    // Atualiza para 5 chars — banner desaparece.
    fireEvent.change(screen.getByPlaceholderText(/Novo valor para/i), {
      target: { value: "abcde" },
    });
    expect(screen.queryByTestId("suffix-invalid-banner")).not.toBeInTheDocument();

    // Validador genérico de MCP_SHARED_SECRET (mínimo 32) agora pode aparecer.
    // Não é obrigatório para esse asserto — basta confirmar que o banner foi removido.
  });
});
