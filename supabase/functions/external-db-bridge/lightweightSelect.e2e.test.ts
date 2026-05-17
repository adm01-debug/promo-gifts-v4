import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/external-db-bridge`;

const LIGHTWEIGHT_MAX_COLUMNS = 40;
const FULL_MIN_COLUMNS = 60;
const HEAVY_FIELDS_SAMPLE = ["schema_json", "images", "videos", "dimensions", "seo_issues"];

interface BridgeResponse {
  data?: { records?: unknown[] } | unknown[];
  success?: boolean;
}

async function callBridge(body: Record<string, unknown>): Promise<unknown[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  assertEquals(res.status, 200, `bridge deve responder 200 — body=${JSON.stringify(body)}`);
  const json = (await res.json()) as BridgeResponse;
  const rows = Array.isArray((json.data as { records?: unknown[] })?.records)
    ? (json.data as { records: unknown[] }).records
    : Array.isArray(json.data)
      ? (json.data as unknown[])
      : Array.isArray(json)
        ? (json as unknown[])
        : [];
  return rows;
}

function columnCount(row: unknown): number {
  return row && typeof row === "object" ? Object.keys(row as Record<string, unknown>).length : 0;
}

function hasAnyHeavy(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const obj = row as Record<string, unknown>;
  return HEAVY_FIELDS_SAMPLE.some((f) => Object.prototype.hasOwnProperty.call(obj, f));
}

Deno.test("E2E force-lightweight: products + limit=51 + select='*' → lightweight", async () => {
  const rows = await callBridge({ operation: "select", table: "products", select: "*", limit: 51 });
  assert(rows.length > 0, "esperava ao menos 1 registro");
  const cols = columnCount(rows[0]);
  assert(
    cols <= LIGHTWEIGHT_MAX_COLUMNS,
    `boundary limit=51 deveria forçar lightweight (≤${LIGHTWEIGHT_MAX_COLUMNS} cols), recebeu ${cols}`,
  );
  assertEquals(hasAnyHeavy(rows[0]), false, "campos pesados não deveriam aparecer");
});

Deno.test("E2E force-lightweight: products + limit=300 + select omitido → lightweight", async () => {
  const rows = await callBridge({ operation: "select", table: "products", limit: 300 });
  assert(rows.length > 0);
  assert(columnCount(rows[0]) <= LIGHTWEIGHT_MAX_COLUMNS);
  assertEquals(hasAnyHeavy(rows[0]), false);
});

Deno.test("E2E no-force: products + fetch por id (filters.id) → payload completo", async () => {
  const seed = await callBridge({ operation: "select", table: "products", select: "id", limit: 1 });
  assert(seed.length > 0, "precisa de ao menos 1 produto para o teste");
  const productId = (seed[0] as { id: string }).id;

  const rows = await callBridge({
    operation: "select",
    table: "products",
    select: "*",
    limit: 200,
    filters: { id: productId },
  });
  assert(rows.length > 0, "esperava o produto fetched por id");
  const cols = columnCount(rows[0]);
  assert(
    cols >= FULL_MIN_COLUMNS,
    `fetch por id deve preservar payload completo (≥${FULL_MIN_COLUMNS} cols), recebeu ${cols} — REGRESSÃO em detail/edit pages`,
  );
  assertEquals(hasAnyHeavy(rows[0]), true, "campos pesados devem estar presentes em fetch por id");
});

Deno.test("E2E no-force: products + limit=50 (boundary) + select='*' → payload completo", async () => {
  const rows = await callBridge({ operation: "select", table: "products", select: "*", limit: 50 });
  assert(rows.length > 0);
  const cols = columnCount(rows[0]);
  assert(
    cols >= FULL_MIN_COLUMNS,
    `boundary limit=50 (=threshold) NÃO deve forçar lightweight, recebeu ${cols} cols`,
  );
});

Deno.test("E2E no-force: products + limit=10 + select='*' → payload completo", async () => {
  const rows = await callBridge({ operation: "select", table: "products", select: "*", limit: 10 });
  assert(rows.length > 0);
  assert(columnCount(rows[0]) >= FULL_MIN_COLUMNS);
});

Deno.test("E2E no-force: products + limit=500 + select focado → respeita o caller", async () => {
  const focused = "id,name,sale_price,primary_image_url";
  const rows = await callBridge({
    operation: "select",
    table: "products",
    select: focused,
    limit: 500,
  });
  assert(rows.length > 0);
  const keys = Object.keys(rows[0] as Record<string, unknown>).sort();
  assertEquals(
    keys,
    focused.split(",").sort(),
    `select focado deveria ser respeitado mesmo com limit alto — recebeu ${keys.join(",")}`,
  );
});

Deno.test("E2E no-force: outra tabela (categories) com limit alto → payload completo", async () => {
  const rows = await callBridge({ operation: "select", table: "categories", select: "*", limit: 200 });
  assert(rows.length > 0, "esperava categorias retornadas");
  const cols = columnCount(rows[0]);
  assert(cols > 5, `lightweight não deveria afetar 'categories' — recebeu apenas ${cols} cols`);
});
