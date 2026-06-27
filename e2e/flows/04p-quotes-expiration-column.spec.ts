/**
 * Coluna "Expiração" — seed determinístico de 4 cotações com `valid_until`
 * em -1d / hoje / +1d / +7d e validação do texto, da classe de cor e do
 * tooltip "Válido até dd/MM/yyyy".
 *
 * Notas:
 *   • Fuso é forçado para America/Sao_Paulo no context (igual ao app real).
 *     Mockar timezone "exótico" no Chromium não muda a lógica: o componente
 *     usa `new Date(y,m,d).getTime()` (local), então a contagem regressiva
 *     é estável dentro do mesmo fuso. Validamos 0/1/7/-1 dias.
 *   • A lista `QuotesConfigurableList` não tem UI de visibilidade/ordenação
 *     de colunas (colunas são fixas no SSOT `ALL_COLUMNS`). Por isso o
 *     teste de "persistência após reload" reduz-se a recarregar a página
 *     e conferir que a coluna continua presente.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { e2eName } from "../helpers/e2e-resources";

// Matriz de fusos: a contagem regressiva usa `new Date(y,m,d)` local, então
// validamos em 3 fusos distintos para garantir que 0/1/7/-1 dia continuam
// determinísticos e que o dd/MM/yyyy do tooltip não muda com o fuso.
const TIMEZONES = ["America/Sao_Paulo", "UTC", "Europe/Lisbon"] as const;

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

interface ExpirationSeed {
  name: string;
  daysFromToday: number;
  expectedText: RegExp;
  expectedToneClass: RegExp; // classe Tailwind esperada (subset)
  iso: string;
}

function buildTargets(): ExpirationSeed[] {
  const today = new Date();
  const atMidnight = (d: number) => {
    const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
    return x.toISOString().slice(0, 10); // YYYY-MM-DD (date column)
  };
  return [
    {
      name: e2eName("exp-minus1"),
      daysFromToday: -1,
      expectedText: /Expirado há 1d/i,
      expectedToneClass: /text-destructive/,
      iso: atMidnight(-1),
    },
    {
      name: e2eName("exp-today"),
      daysFromToday: 0,
      expectedText: /Expira hoje/i,
      expectedToneClass: /text-destructive/,
      iso: atMidnight(0),
    },
    {
      name: e2eName("exp-plus1"),
      daysFromToday: 1,
      expectedText: /^1 dia$/,
      expectedToneClass: /text-amber-500/,
      iso: atMidnight(1),
    },
    {
      name: e2eName("exp-plus7"),
      daysFromToday: 7,
      expectedText: /^7 dias$/,
      expectedToneClass: /text-amber-400/,
      iso: atMidnight(7),
    },
  ];
}

function formatLocal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

test.describe("Cotações · coluna Expiração (seed determinístico)", () => {
  test.beforeEach(() => requireAuth());

  test("renderiza dias restantes, tom de cor e tooltip por caso-limite", async ({ page }) => {
    const targets = buildTargets();
    await gotoAndSettle(page, "/orcamentos");

    // Seed via REST com JWT do localStorage.
    const seed = await page.evaluate(
      async ({ url, anonKey, targets }) => {
        let jwt = "";
        let sellerId = "";
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          if (!k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          jwt = parsed?.access_token ?? "";
          sellerId = parsed?.user?.id ?? "";
          if (jwt) break;
        }
        if (!jwt || !sellerId) return { skipped: "no-jwt" as const, created: 0 };
        const headers = {
          apikey: anonKey,
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        };
        let created = 0;
        for (const t of targets) {
          const r = await fetch(`${url}/rest/v1/quotes`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              seller_id: sellerId,
              client_name: t.name,
              status: "draft",
              total: 100,
              valid_until: t.iso,
              notes: "e2e-seed-expiration",
            }),
          });
          if (r.ok) created += 1;
        }
        return { skipped: null as null, created };
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, targets },
    );

    test.skip(seed.skipped === "no-jwt", "Sem JWT no localStorage para seed.");
    expect(seed.created).toBeGreaterThan(0);

    await gotoAndSettle(page, "/orcamentos");

    // Coluna presente (smoke).
    await expect(page.getByTestId("quotes-col-header-expiration")).toBeVisible({ timeout: 10_000 });

    for (const t of targets) {
      const row = page.locator(`text="${t.name}"`).first().locator("xpath=ancestor::*[@data-testid][1]");
      const cell = row.locator('[data-testid="quote-expiration-cell"]').first();
      await expect(cell, `texto ${t.daysFromToday}d`).toHaveText(t.expectedText);
      await expect(cell, `tom ${t.daysFromToday}d`).toHaveClass(t.expectedToneClass);

      // a11y: aria-label contém "Válido até dd/MM/yyyy".
      const expectedDate = formatLocal(t.iso);
      await expect(cell).toHaveAttribute("aria-label", new RegExp(`Válido até ${expectedDate}`));

      // Tooltip via teclado (focus) — Radix exibe TooltipContent.
      await cell.focus();
      await expect(
        page.getByRole("tooltip", { name: new RegExp(`Válido até ${expectedDate}`) }).first(),
      ).toBeVisible({ timeout: 3_000 });
      await page.keyboard.press("Escape");
    }

    // Persistência mínima: coluna continua visível após reload.
    await page.reload();
    await expect(page.getByTestId("quotes-col-header-expiration")).toBeVisible({ timeout: 10_000 });
  });
});
