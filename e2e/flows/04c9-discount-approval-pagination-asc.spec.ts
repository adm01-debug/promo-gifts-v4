/**
 * E2E — Paginação cursorada também consistente em ordenação ASC por created_at.
 *
 * A fila renderizada usa DESC; este spec valida a mesma garantia (sem duplicados,
 * cursor estável, ordem monotônica) pela API REST direta usando o JWT admin
 * persistido no localStorage. Mantém o backend cursor-safe em ambas direções.
 */
import { test, expect, requireAdmin } from "../fixtures/test-base";
import { setupDiscountAdmin } from "../helpers/setup-discount-admin";
import { assertCursorPagination } from "../helpers/pagination-asserts";


test.describe.configure({ mode: "parallel" });

const PAGE_SIZE = 50;
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://doufsxqlfjyuvxuezpln.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

test.describe("Discount approval — cursor ASC consistente", () => {
  test("paginação ASC por created_at não duplica e mantém ordem", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    requireAdmin();
    await setupDiscountAdmin(page, testInfo, { minPending: PAGE_SIZE + 5 });


    const result = await page.evaluate(
      async ({ url, anonKey, pageSize }) => {
        let jwt = "";
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
            const raw = localStorage.getItem(k);
            if (raw) jwt = JSON.parse(raw)?.access_token ?? "";
            break;
          }
        }
        if (!jwt) return { skipped: "no-jwt" as const };

        const headers = { apikey: anonKey, Authorization: `Bearer ${jwt}` };
        const base = `${url}/rest/v1/discount_approval_requests?select=id,created_at&order=created_at.asc&limit=${pageSize}`;

        const r1 = await fetch(base, { headers }).then((r) => r.json());
        if (!Array.isArray(r1) || r1.length < pageSize) {
          return { skipped: "not-enough-data" as const, len: r1?.length ?? 0 };
        }
        const cursor = r1[r1.length - 1].created_at;
        const r2 = await fetch(`${base}&created_at=gt.${encodeURIComponent(cursor)}`, {
          headers,
        }).then((r) => r.json());

        return { skipped: null, r1, r2, cursor };
      },
      { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, pageSize: PAGE_SIZE },
    );

    if (result.skipped) {
      test.skip(true, `REST ASC skip: ${result.skipped}`);
    }
    const { r1, r2, cursor } = result as {
      r1: Array<{ id: string; created_at: string }>;
      r2: Array<{ id: string; created_at: string }>;
      cursor: string;
    };

    assertCursorPagination(r1, r2, cursor, "asc");
  });
});
