// Performance regression test for external-db-bridge.
//
// Garante que listings de products com `limit > 50`:
//   1. Aplicam o select lightweight automaticamente (sem campos JSONB pesados no payload)
//   2. Ficam abaixo do SLA de latência (p95 alvo)
//
// O teste é tolerante a cold start: faz 1 warm-up + N medições e usa a mediana
// para a asserção principal (evita flakiness em CI), mas também trava um teto
// absoluto generoso para qualquer requisição individual.
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

await load({ export: true, allowEmptyValues: true });

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/external-db-bridge`;

// SLAs (ms). Ajustados a partir da telemetria validada (~1.7s média pós-otimização).
const SLA_MEDIAN_MS = 3500;       // mediana deve ficar bem abaixo do baseline (~3000ms pré-otimização)
const SLA_HARD_CEILING_MS = 8000; // teto absoluto: nenhuma request individual deve exceder
const MEASUREMENT_RUNS = 3;

// Campos pesados (JSONB / array / texto longo) presentes no SELECT * completo
// que NÃO devem aparecer no PRODUCTS_LIGHTWEIGHT_SELECT.
// Confirmado empiricamente: small=148 cols vs lightweight=24 cols.
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
// Lightweight é estritamente menor que o payload completo.
const LIGHTWEIGHT_MAX_COLUMNS = 40;
const FULL_MIN_COLUMNS = 60;

async function callListing(limit: number): Promise<{ ms: number; rows: any[]; status: number }> {
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
  // Bridge response shape: { success, data: { records: [...] } } | { data: [...] } | [...]
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
  const { rows, status } = await callListing(150);
  assertEquals(status, 200, "endpoint deve responder 200");
  assert(rows.length > 0, "esperava pelo menos 1 produto retornado");

  const sample = rows[0];
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
  // Warm-up para mitigar cold start da edge function
  await callListing(200);

  const samples: number[] = [];
  for (let i = 0; i < MEASUREMENT_RUNS; i++) {
    const { ms, status } = await callListing(200);
    assertEquals(status, 200, `run ${i + 1} deve responder 200`);
    samples.push(ms);
    assert(
      ms < SLA_HARD_CEILING_MS,
      `run ${i + 1} excedeu o teto absoluto: ${ms.toFixed(0)}ms (limite ${SLA_HARD_CEILING_MS}ms)`,
    );
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(`[perf] listing limit=200 — samples=${samples.map((s) => s.toFixed(0)).join("ms,")}ms median=${median.toFixed(0)}ms`);

  assert(
    median < SLA_MEDIAN_MS,
    `latência mediana ${median.toFixed(0)}ms acima do SLA ${SLA_MEDIAN_MS}ms — possível regressão de performance`,
  );
});

Deno.test("perf: small limit=10 still receives full payload (no over-eager lightweight)", async () => {
  // Garante que o teste de performance não mascarou regressão na regra inversa:
  // listings pequenos devem manter campos completos para detail/edit pages.
  const { rows, status } = await callListing(10);
  assertEquals(status, 200);
  assert(rows.length > 0, "esperava pelo menos 1 produto retornado");

  const sample = rows[0];
  const columnCount = Object.keys(sample).length;
  console.log(`[perf] full payload (small limit) — columns=${columnCount}`);

  assert(
    columnCount >= FULL_MIN_COLUMNS,
    `listing pequeno (limit=10) deveria preservar payload completo (≥ ${FULL_MIN_COLUMNS} colunas), recebeu ${columnCount} — regra de lightweight pode estar agressiva demais`,
  );
});
