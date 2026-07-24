/**
 * Lint estático de defesa em profundidade — vendedor.
 *
 * Garante que arquivos que consultam tabelas comerciais sensíveis
 * (quotes, orders, discount_approval_requests) DIRETAMENTE no dashboard
 * do vendedor sempre apliquem o filtro `.eq("seller_id", ...)`
 * (ou usem `applySellerScope`). Isto previne regressões em que a UI
 * passe a depender apenas do RLS para isolar dados.
 *
 * Cobre os 4 widgets do dashboard. Se você criar um novo widget que
 * leia das tabelas sensíveis, adicione-o à lista.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CRITICAL_FILES = [
  "src/components/dashboard/MyRecentQuotesWidget.tsx",
  "src/components/dashboard/MyDiscountRequestsWidget.tsx",
  "src/components/dashboard/MyClientsWidget.tsx",
];

const SENSITIVE_TABLES = ["quotes", "orders", "discount_approval_requests"];

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("seller scope — defesa em profundidade nos widgets do dashboard", () => {
  for (const file of CRITICAL_FILES) {
    it(`${file} aplica .eq("seller_id", ...) para cada tabela sensível consultada`, () => {
      const src = read(file);
      for (const table of SENSITIVE_TABLES) {
        const usesTable = new RegExp(`\\.from\\(["']${table}["']\\)`).test(src);
        if (!usesTable) continue;
        const hasSellerFilter =
          /\.eq\(\s*["']seller_id["']\s*,\s*user[!?]?\.id\s*\)/.test(src) ||
          /\.eq\(\s*["']seller_id["']\s*,\s*userId\s*\)/.test(src) ||
          /applySellerScope\(/.test(src);
        expect(
          hasSellerFilter,
          `${file} consulta "${table}" sem aplicar .eq("seller_id", user.id) nem applySellerScope`,
        ).toBe(true);
      }
    });

    it(`${file} usa hook de auth (useAuth) para obter user.id`, () => {
      const src = read(file);
      const usesAnyTable = SENSITIVE_TABLES.some((t) =>
        new RegExp(`\\.from\\(["']${t}["']\\)`).test(src),
      );
      if (!usesAnyTable) return;
      expect(src).toMatch(/from\s+["']@\/contexts\/AuthContext["']/);
      expect(src).toMatch(/useAuth\(\)/);
    });
  }
});
