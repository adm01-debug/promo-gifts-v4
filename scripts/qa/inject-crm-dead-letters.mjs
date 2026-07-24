#!/usr/bin/env node
/**
 * inject-crm-dead-letters.mjs
 * ---------------------------------------------------------------
 * Injeta 3 dead-letters SINTÉTICOS contra o endpoint receive-crm-callback:
 *   1) SUCCESS  — event válido para quote existente (você passa o UUID)
 *   2) DUPLICATE — o mesmo payload repetido (deve virar duplicate_ignored)
 *   3) NOT_FOUND — event válido com UUID de quote inexistente
 *      (deve retornar 200 + applied=false + reason=quote_not_found)
 *
 * Uso (dry-run — não faz request, só mostra payloads):
 *   node scripts/qa/inject-crm-dead-letters.mjs --dry-run
 *
 * Uso real:
 *   CRM_CALLBACK_API_KEY=<valor> \
 *   node scripts/qa/inject-crm-dead-letters.mjs \
 *     --quote-id=<uuid-de-quote-existente>
 *
 * Opcional:
 *   --url=<override>  (default: V4 canônico doufsxqlfjyuvxuezpln)
 */
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);

const URL_ENDPOINT =
  args.url ??
  process.env.V4_CALLBACK_URL ??
  "https://doufsxqlfjyuvxuezpln.functions.supabase.co/receive-crm-callback";
const API_KEY = process.env.CRM_CALLBACK_API_KEY ?? "";
const DRY = args["dry-run"] === "true";
const QUOTE_ID = args["quote-id"] ?? "00000000-0000-0000-0000-000000000001";
const NON_EXISTENT = "ffffffff-ffff-ffff-ffff-ffffffffffff";

if (!DRY && !API_KEY) {
  console.error("❌ CRM_CALLBACK_API_KEY ausente. Use --dry-run para inspecionar payloads.");
  process.exit(2);
}

const now = new Date().toISOString();

const scenarios = [
  {
    name: "1️⃣  SUCCESS",
    expect: "200 applied=true",
    body: {
      external_quote_id: QUOTE_ID,
      event_type: "sent_to_client",
      occurred_at: now,
      payload: { note: "dead-letter drain #1" },
    },
  },
  {
    name: "2️⃣  DUPLICATE (mesmo payload do #1)",
    expect: "200 duplicate_ignored",
    body: {
      external_quote_id: QUOTE_ID,
      event_type: "sent_to_client",
      occurred_at: now,
      payload: { note: "dead-letter drain #2 (ruído no payload)" },
    },
  },
  {
    name: "3️⃣  NOT_FOUND (quote inexistente)",
    expect: "200 applied=false reason=quote_not_found",
    body: {
      external_quote_id: NON_EXISTENT,
      event_type: "approved",
      occurred_at: now,
      payload: { approved_by: "fantasma" },
    },
  },
];

console.log(`\n🎯 Endpoint: ${URL_ENDPOINT}`);
console.log(`   Mode:     ${DRY ? "DRY-RUN (nenhum request)" : "LIVE"}`);
console.log(`   Quote:    ${QUOTE_ID}\n`);

const results = [];
for (const s of scenarios) {
  console.log(`── ${s.name}`);
  console.log(`   Expect: ${s.expect}`);
  console.log(`   Body:   ${JSON.stringify(s.body)}`);
  if (DRY) { results.push({ name: s.name, status: "DRY", body: null }); continue; }
  const t0 = Date.now();
  try {
    const res = await fetch(URL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify(s.body),
    });
    const text = await res.text();
    const ms = Date.now() - t0;
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    console.log(`   → HTTP ${res.status} (${ms}ms):`, parsed);
    results.push({ name: s.name, status: res.status, body: parsed, ms });
  } catch (err) {
    console.error(`   ✖ Falhou:`, err);
    results.push({ name: s.name, status: "ERR", body: String(err) });
  }
  console.log("");
}

console.log("\n📊 Matriz final:");
console.table(results.map((r) => ({
  cenario: r.name,
  http: r.status,
  outcome: typeof r.body === "object" && r.body ? (r.body.status ?? r.body.error) : r.body,
  ms: r.ms ?? "-",
})));
