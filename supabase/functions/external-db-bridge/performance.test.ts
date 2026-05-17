import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");

const SLA_MEDIAN_MS = 3500;
const SLA_HARD_CEILING_MS = 8000;
const MEASUREMENT_RUNS = 3;

const HEAVY_FIELDS = [
  "schema_json",
  "images",
  "videos",
  "dimensions",
  "seo_issues",
  "meta_description",
  "tags",
  "key_benefits",
];
const LIGHTWEIGHT_MAX_COLUMNS = 40;
const FULL_MIN_COLUMNS = 60;

async function callListing(limit: number): Promise<{ ms: number; rows: any[]; status: number } | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const ENDPOINT = `${SUPABASE_URL}/functions/v1/external-db-bridge`;
  const started = performance.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      operation: "select",
      table: "products",
      select: "*",
      limit,
    }),
  });
  const ms = performance.now() - started;
  const body = await res.json().catch(() => ({}));
  const rows = Array.isArray(body?.data?.records)
    ? body.data.records
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : [];
  return { ms, rows, status: res.status };
}

Deno.test("perf: listing limit=150 enforces lightweight select (no heavy JSONB fields)", async () => {
  const r = await callListing(150);
  if (!r) return;
  assertEquals(r.status, 200, "endpoint deve responder 200");
  assert(r.rows.length > 0, "esperava pelo menos 1 produto retornado");

  const sample = r.rows[0];
  const columnCount = Object.keys(sample).length;
  const presentHeavy = HEAVY_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(sample, f));

  console.log(`[perf] lightweight payload — columns=${columnCount} heavy_present=${presentHeavy.length}`);

  assertEquals(
    presentHeavy,
    [],
    `payload contém campos pesados que deveriam ter sido removidos pelo lightweight select: ${presentHeavy.join(", ")}`,
  );
  assert(
    columnCount <= LIGHTWEIGHT_MAX_COLUMNS,
    `payload lightweight tem ${columnCount} colunas (esperado ≤ ${LIGHTWEIGHT_MAX_COLUMNS}) — regra de force-lightweight pode ter regredido`,
  );
});

Deno.test("perf: listing limit=200 stays under latency SLA (median)", async () => {
  const warmup = await callListing(200);
  if (!warmup) return;

  const samples: number[] = [];
  for (let i = 0; i < MEASUREMENT_RUNS; i++) {
    const r = await callListing(200);
    if (!r) continue;
    assertEquals(r.status, 200, `run ${i + 1} deve responder 200`);
    samples.push(r.ms);
    assert(
      r.ms < SLA_HARD_CEILING_MS,
      `run ${i + 1} excedeu o teto absoluto: ${r.ms.toFixed(0)}ms (limite ${SLA_HARD_CEILING_MS}ms)`,
    );
  }

  if (samples.length === 0) return;
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`[perf] listing limit=200 — samples=${samples.map((s) => s.toFixed(0)).join("ms,")}ms median=${median.toFixed(0)}ms`);

  assert(
    median < SLA_MEDIAN_MS,
    `latência mediana ${median.toFixed(0)}ms acima do SLA ${SLA_MEDIAN_MS}ms — possível regressão de performance`,
  );
});

Deno.test("perf: small limit=10 still receives full payload (no over-eager lightweight)", async () => {
  const r = await callListing(10);
  if (!r) return;
  assertEquals(r.status, 200);
  assert(r.rows.length > 0, "esperava pelo menos 1 produto retornado");

  const sample = r.rows[0];
  const columnCount = Object.keys(sample).length;
  console.log(`[perf] full payload (small limit) — columns=${columnCount}`);

  assert(
    columnCount >= FULL_MIN_COLUMNS,
    `listing pequeno (limit=10) deveria preservar payload completo (≥ ${FULL_MIN_COLUMNS} colunas), recebeu ${columnCount} — regra de lightweight pode estar agressiva demais`,
  );
});
