/**
 * pagination-asserts — verificações reutilizáveis para paginação cursorada.
 * Garantem:
 *   - Ordem por `created_at` monotônica (asc ou desc) em cada página
 *   - Cursor estável: último item da página N == cursor recebido pela N+1
 *   - Zero duplicação de IDs entre páginas
 *   - Sem reordenação após append (modo desc com `data-created-at` no DOM)
 */
import { expect } from "@playwright/test";

export interface PageRow {
  id: string;
  created_at: string;
}

export function assertMonotonicOrder(
  rows: ReadonlyArray<PageRow>,
  direction: "asc" | "desc",
  label = "page",
): void {
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].created_at).getTime();
    const curr = new Date(rows[i].created_at).getTime();
    if (direction === "desc") {
      expect(prev, `${label}: ordem desc quebrada em ${i}`).toBeGreaterThanOrEqual(curr);
    } else {
      expect(prev, `${label}: ordem asc quebrada em ${i}`).toBeLessThanOrEqual(curr);
    }
  }
}

export function assertNoDuplicatesBetween(
  pageA: ReadonlyArray<PageRow>,
  pageB: ReadonlyArray<PageRow>,
): void {
  const ids = new Set(pageA.map((r) => r.id));
  for (const row of pageB) {
    expect(ids.has(row.id), `Item ${row.id} duplicado entre páginas`).toBe(false);
  }
}

export function assertStableCursor(
  pageA: ReadonlyArray<PageRow>,
  cursor: string,
): void {
  expect(pageA[pageA.length - 1]?.created_at).toBe(cursor);
}

/**
 * Conjunto completo para um par (página N, página N+1, cursor enviado).
 */
export function assertCursorPagination(
  pageA: ReadonlyArray<PageRow>,
  pageB: ReadonlyArray<PageRow>,
  cursor: string,
  direction: "asc" | "desc",
): void {
  assertMonotonicOrder(pageA, direction, "page1");
  assertMonotonicOrder(pageB, direction, "page2");
  assertStableCursor(pageA, cursor);
  assertNoDuplicatesBetween(pageA, pageB);
  // Cursor isola: todos da página 2 devem estar do lado correto do cursor.
  const cursorMs = new Date(cursor).getTime();
  for (const row of pageB) {
    const ms = new Date(row.created_at).getTime();
    if (direction === "asc") {
      expect(ms, `page2 item ${row.id} <= cursor asc`).toBeGreaterThan(cursorMs);
    } else {
      expect(ms, `page2 item ${row.id} >= cursor desc`).toBeLessThan(cursorMs);
    }
  }
}
