/**
 * E2E P0 regression: AdminUsuariosPage deve renderizar sem crash quando
 * `rolesLoaded` é consumido via `useAuth()`.
 *
 * Contexto: ReferenceError em produção (2026-06-18) — destructuring esquecido.
 * Este teste garante que a página carrega, o h1 aparece e não há erro de
 * runtime no console (ReferenceError / TypeError).
 */
import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle, expectOnRoute } from "../helpers/nav";
import { waitForTestIdVisible } from "../helpers/waits";
import { Sel } from "../fixtures/selectors";

test.describe("@admin AdminUsuariosPage — render & rolesLoaded", () => {
  test("renderiza sem ReferenceError quando rolesLoaded é usado via useAuth()", async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (err) => runtimeErrors.push(String(err?.message ?? err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") runtimeErrors.push(msg.text());
    });

    await loginAs(page, "admin");
    await gotoAndSettle(page, "/admin/usuarios");
    await expectOnRoute(page, "/admin/usuarios");

    await waitForTestIdVisible(page, "page-title-usuarios");
    await expect(page.locator(Sel.page.title("usuarios"))).toBeVisible();

    const offenders = runtimeErrors.filter((m) =>
      /ReferenceError|rolesLoaded is not defined|TypeError.*rolesLoaded/i.test(m),
    );
    expect(offenders, `Erros de runtime detectados:\n${offenders.join("\n")}`).toEqual([]);
  });
});
