import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---- Mocks ----------------------------------------------------------------
// Mock do hook que faz I/O com o backend de secrets — assim o teste foca
// só no comportamento de UI/validação do SecretField.
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

// O hook de detalhes de teste de conexão dispara queries — neutralizamos.
vi.mock("@/hooks/intelligence/useConnectionTestDetails", () => ({
  useConnectionTestDetails: () => ({ details: null, loading: false, error: null, refresh: vi.fn() }),
}));

// Filtro de fonte de credencial usa contexto — sobrescreve só o hook,
// preservando exports auxiliares (`resolveSource`, etc) usados pelo
// CredentialSourceBadge.
vi.mock("@/components/admin/connections/CredentialsSourceFilterContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/admin/connections/CredentialsSourceFilterContext")>();
  return {
    ...actual,
    useCredentialsSourceFilter: () => ({ matchesFilter: () => true, filter: "all" }),
  };
});

// Toast: silencia para não poluir output.
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import { SecretField } from "@/components/admin/connections/SecretField";
import { MIN_SUFFIX_LENGTH } from "@/components/admin/connections/secretValidators";

function renderField(overrides: Partial<React.ComponentProps<typeof SecretField>> = {}) {
  return render(
    <TooltipProvider>
      <SecretField
        label="Token de teste"
        // Usamos um secretName real da whitelist (caso contrário o botão
        // "Configurar" fica desabilitado por validação de nome).
        // MCP_SHARED_SECRET usa o DEFAULT_RULE (>=4 chars), o que isola o
        // teste do bloqueio crítico de sufixo (também 4) sem interferência
        // de validadores específicos.
        secretName="MCP_SHARED_SECRET"
        status={undefined}
        {...overrides}
      />
    </TooltipProvider>,
  );
}

function enterEditMode() {
  // Estado inicial: não-configurado → botão "Configurar" abre o input.
  fireEvent.click(screen.getByRole("button", { name: /^Alterar$/i }));
}

function getInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/Cole o valor de|Novo valor para/i) as HTMLInputElement;
}

function getSaveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /^Salvar$|^Salvando…$/i }) as HTMLButtonElement;
}

describe("SecretField — banner de sufixo inválido (<4 chars)", () => {
  beforeEach(() => {
    setSecretMock.mockReset();
    rotateSecretMock.mockReset();
    sessionStorage.clear();
  });

  it("constante MIN_SUFFIX_LENGTH é 4 (premissa do banner)", () => {
    expect(MIN_SUFFIX_LENGTH).toBe(4);
  });

  it("não exibe banner quando o input está vazio", () => {
    renderField();
    enterEditMode();
    expect(screen.queryByText(/Sufixo inválido/i)).not.toBeInTheDocument();
  });

  it.each([
    [1, "caractere"],
    [2, "caracteres"],
    [3, "caracteres"],
  ])("exibe banner para %i char(s) com a contagem correta (%s)", (n, word) => {
    renderField();
    enterEditMode();
    fireEvent.change(getInput(), { target: { value: "x".repeat(n) } });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Sufixo inválido — mínimo 4 caracteres/);
    expect(alert).toHaveTextContent(`O valor tem apenas ${n} ${word}`);
    expect(alert).toHaveTextContent("••••XXXX");
    expect(alert).toHaveTextContent(/Salvamento bloqueado/);
  });

  it("oculta banner assim que o valor atinge 4 chars", () => {
    renderField();
    enterEditMode();
    const input = getInput();

    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "abcd" } });
    expect(screen.queryByText(/Sufixo inválido/i)).not.toBeInTheDocument();
  });
});

describe("SecretField — bloqueio de salvamento com sufixo curto", () => {
  beforeEach(() => {
    setSecretMock.mockReset();
    rotateSecretMock.mockReset();
    sessionStorage.clear();
  });

  it.each([1, 2, 3])("desabilita o botão Salvar com %i char(s)", (n) => {
    renderField();
    enterEditMode();
    fireEvent.change(getInput(), { target: { value: "x".repeat(n) } });
    expect(getSaveButton()).toBeDisabled();
  });

  it("clicar em Salvar com sufixo curto NÃO chama setSecret nem abre modal", () => {
    renderField();
    enterEditMode();
    fireEvent.change(getInput(), { target: { value: "ab" } });

    // Botão está disabled → forçamos o click ainda assim para garantir que
    // o handler interno (handleSave) também tem early-return via canSave.
    const btn = getSaveButton();
    fireEvent.click(btn);

    expect(setSecretMock).not.toHaveBeenCalled();
    expect(rotateSecretMock).not.toHaveBeenCalled();
    // Modal de confirmação não deve aparecer.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("habilita Salvar quando atinge >=4 chars (validação genérica passa)", () => {
    renderField();
    enterEditMode();
    fireEvent.change(getInput(), { target: { value: "abcd" } });
    expect(getSaveButton()).not.toBeDisabled();
  });

  it("guarda de 4 chars vence sobre validador específico (BITRIX24_TOKEN exige 10+) — banner aparece, não a mensagem do validador", () => {
    renderField({ secretName: "BITRIX24_TOKEN", label: "Bitrix Token" });
    enterEditMode();
    fireEvent.change(getInput(), { target: { value: "ab" } });

    // O banner crítico de sufixo aparece…
    expect(screen.getByRole("alert")).toHaveTextContent(/Sufixo inválido/);
    // …e a mensagem do validador específico (alfanumérico) NÃO aparece
    // porque o componente só exibe `validation.message` quando length >= 4.
    expect(screen.queryByText(/alfanumérico/i)).not.toBeInTheDocument();
    expect(getSaveButton()).toBeDisabled();
  });
});

describe("SecretField — handler de salvar nunca chama API com sufixo <4 chars", () => {
  beforeEach(() => {
    setSecretMock.mockReset();
    rotateSecretMock.mockReset();
    sessionStorage.clear();
  });

  it.each([1, 2, 3])(
    "com %i char(s) e múltiplos cliques no Salvar, NENHUMA chamada à API ocorre",
    (n) => {
      renderField();
      enterEditMode();
      fireEvent.change(getInput(), { target: { value: "x".repeat(n) } });

      const btn = getSaveButton();
      // Stress: 5 cliques consecutivos não devem disparar nada.
      for (let i = 0; i < 5; i++) fireEvent.click(btn);

      expect(setSecretMock).toHaveBeenCalledTimes(0);
      expect(rotateSecretMock).toHaveBeenCalledTimes(0);
      // E o estado de "Salvando…" não aparece (botão preserva label "Salvar").
      expect(screen.queryByRole("button", { name: /Salvando…/i })).not.toBeInTheDocument();
      expect(getSaveButton()).toHaveTextContent(/Salvar/);
    },
  );

  it("o atributo title do botão expõe a razão do bloqueio quando o valor é curto", () => {
    renderField();
    enterEditMode();
    fireEvent.change(getInput(), { target: { value: "ab" } });

    const btn = getSaveButton();
    // saveDisabledReason exibido via title vem do validador específico
    // (DEFAULT_RULE: "deve ter no mínimo 4 caracteres").
    expect(btn.getAttribute("title")).toMatch(/4 caracteres/i);
  });

  it("modo rotate: status com has_value → botão Rotacionar abre input, e Salvar com 3 chars NÃO chama rotateSecret", () => {
    renderField({
      status: {
        has_value: true,
        length: 32,
        masked_suffix: "abcd",
        source: "db",
        env_fallback_active: false,
        updated_at: new Date().toISOString(),
        updated_by_email: null,
      } as any,
    });

    // Entra em modo rotate via botão "Rotacionar".
    fireEvent.click(screen.getByRole("button", { name: /^Rotacionar$/i }));
    fireEvent.change(getInput(), { target: { value: "abc" } });

    // Banner crítico aparece também no modo rotate.
    expect(screen.getByRole("alert")).toHaveTextContent(/Sufixo inválido/);

    // Botão de submit no modo rotate vira "Rotacionar" — disabled e
    // sem chamar a API mesmo após clique.
    const submitBtn = screen.getByRole("button", { name: /^Rotacionar$|^Rotacionando…$/i });
    expect(submitBtn).toBeDisabled();
    fireEvent.click(submitBtn);

    expect(rotateSecretMock).toHaveBeenCalledTimes(0);
    expect(setSecretMock).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("transição curto → válido → curto: API só seria chamada na janela válida (validamos que não é chamada nas curtas)", () => {
    renderField();
    enterEditMode();
    const input = getInput();

    // 1) Curto: clicar não chama nada.
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.click(getSaveButton());
    expect(setSecretMock).not.toHaveBeenCalled();

    // 2) Atinge 4 chars: botão habilita (apenas verificamos que não dispara
    //    sozinho — só com clique, e clique abre modal, não chama API direto).
    fireEvent.change(input, { target: { value: "abcd" } });
    expect(getSaveButton()).not.toBeDisabled();
    expect(setSecretMock).not.toHaveBeenCalled();

    // 3) Volta para curto: botão desabilita novamente, banner reaparece.
    fireEvent.change(input, { target: { value: "ab" } });
    expect(getSaveButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Sufixo inválido/);
    fireEvent.click(getSaveButton());

    // Total final: zero chamadas à API em todo o fluxo (a única janela
    // "válida" exigiria abrir modal + confirmar, o que o teste não faz).
    expect(setSecretMock).toHaveBeenCalledTimes(0);
    expect(rotateSecretMock).toHaveBeenCalledTimes(0);
  });

  it("mensagem do banner identifica EXATAMENTE o caractere faltante (mensagem específica do fluxo)", () => {
    renderField();
    enterEditMode();
    fireEvent.change(getInput(), { target: { value: "x" } });

    const alert = screen.getByRole("alert");
    // Mensagem específica: contagem real + meta + razão (layout ••••XXXX) + ação.
    expect(alert).toHaveTextContent(/O valor tem apenas 1 caractere\b/);
    expect(alert).toHaveTextContent(/precisa de pelo menos 4 caracteres/);
    expect(alert).toHaveTextContent(/identificar a credencial sem expor o segredo/);
    expect(alert).toHaveTextContent(/Salvamento bloqueado/);
  });
});
