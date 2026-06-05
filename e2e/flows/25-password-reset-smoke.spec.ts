
import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { expectVisibleByTestId } from "../helpers/waits";

test.describe("Fluxo: Password Reset UI", () => {
  test("mostra erro para link inválido (sem token)", async ({ page }) => {
    await gotoAndSettle(page, "/reset-password");
    
    // Deve mostrar o card de link inválido/expirado (aguarda token check async completar)
    await expect(page.getByText("Link inválido ou expirado")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Solicitar novo link" })).toBeVisible();
  });

  test("renderiza formulário quando há token no hash", async ({ page }) => {
    // Simula o redirecionamento do Supabase com token de recuperação
    await page.goto("/reset-password#access_token=mock-token&type=recovery");
    
    // Aguarda o settlement da página
    await page.waitForLoadState("networkidle");
    
    // Deve mostrar o formulário de redefinição. O heading do formulário é
    // "Nova Senha" (o texto "Redefinir Senha" é o botão de submit).
    await expect(page.getByRole("heading", { name: "Nova Senha" })).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator("input#confirmPassword")).toBeVisible();
    await expect(page.getByRole("button", { name: "Redefinir senha" })).toBeVisible();
  });

  test("valida força da senha e critérios em tempo real", async ({ page }) => {
    await page.goto("/reset-password#access_token=mock-token&type=recovery");
    
    const pwdInput = page.locator("input#password");
    await pwdInput.fill("123");
    
    // Deve mostrar o indicador de força
    const indicator = page.getByTestId("password-strength-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator.getByText("Fraca")).toBeVisible();

    // Verifica um critério específico
    const lengthCriterion = page.getByTestId("password-criterion-mínimo-8-caracteres");
    await expect(lengthCriterion).toBeVisible();
    await expect(lengthCriterion.locator("svg.lucide-x")).toBeVisible();

    // Preenche senha forte
    await pwdInput.fill("SenhaForte123!");
    await expect(indicator.getByText("Forte")).toBeVisible();
    await expect(lengthCriterion.locator("svg.lucide-check")).toBeVisible();
    
    // Verifica mensagens de erro do Zod para confirmação
    await page.locator("input#confirmPassword").fill("OutraSenha");
    await page.getByRole("button", { name: "Redefinir senha" }).click();
    await expect(page.getByText("Senhas não conferem")).toBeVisible();
  });
});
