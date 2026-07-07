// Testes de integração — receive-crm-callback / event_type whitelist.
//
// Cobre:
//   1. `ALLOWED_EVENT_TYPES` espelha o CHECK constraint do banco
//      (`chk_crm_callback_events_event_type`).
//   2. `isAllowedEventType()` rejeita valores fora da whitelist
//      (incluindo casos adversariais: null, número, uppercase, whitespace,
//       injeção SQL, unicode look-alike, string vazia).
//   3. `CallbackSchema` (Zod) rejeita event_type inválido com erro
//      estruturado — nunca chega ao INSERT no banco.
//   4. Tentativa real de INSERT com event_type inválido contra o banco
//      canônico falha com Postgres error code `23514` (CHECK violation).
//      Só roda se SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY estiverem
//      presentes; caso contrário, pula com aviso (não quebra CI local).
//
// Rodar: `deno test -A supabase/functions/receive-crm-callback/index.test.ts`

// Nota: NÃO importamos `dotenv/load.ts` — este teste só depende dos
// export puros do módulo. O bloco #4 (INSERT real) usa Deno.env direto
// e é pulado quando as vars de banco reais não estão presentes.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Env vars precisam existir ANTES do import (Deno.serve roda no top-level).
Deno.env.set("SUPABASE_URL", Deno.env.get("SUPABASE_URL") ?? "https://fake.supabase.co");
Deno.env.set(
  "SUPABASE_SERVICE_ROLE_KEY",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "fake-service-role-key",
);
Deno.env.set("CRM_CALLBACK_API_KEY", Deno.env.get("CRM_CALLBACK_API_KEY") ?? "fake-key");

const mod = await import("./index.ts");
const { ALLOWED_EVENT_TYPES, isAllowedEventType, CallbackSchema } = mod as {
  ALLOWED_EVENT_TYPES: readonly string[];
  isAllowedEventType: (v: unknown) => boolean;
  CallbackSchema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } };
};

// ─── 1. Whitelist espelha o CHECK do DB ─────────────────────────────────
Deno.test("ALLOWED_EVENT_TYPES espelha o CHECK constraint do banco", () => {
  const expected = ["approved", "rejected", "order_created", "sent_to_client", "expired"];
  assertEquals([...ALLOWED_EVENT_TYPES].sort(), [...expected].sort());
});

// ─── 2. Guard isAllowedEventType ────────────────────────────────────────
Deno.test("isAllowedEventType aceita todos os 5 valores da whitelist", () => {
  for (const v of ALLOWED_EVENT_TYPES) assert(isAllowedEventType(v), `deveria aceitar ${v}`);
});

Deno.test("isAllowedEventType rejeita entradas adversariais", () => {
  const adversarial: unknown[] = [
    null,
    undefined,
    "",
    " approved",
    "approved ",
    "APPROVED",
    "Approved",
    "approve",
    "approveed",
    "approved;DROP TABLE",
    "аpproved", // 'а' cirílico
    42,
    true,
    false,
    {},
    [],
    ["approved"],
    "SENT_TO_CLIENT",
    "sent-to-client",
  ];
  for (const v of adversarial) {
    assertEquals(isAllowedEventType(v), false, `NÃO deveria aceitar ${JSON.stringify(v)}`);
  }
});

// ─── 3. Zod schema rejeita event_type inválido ──────────────────────────
Deno.test("CallbackSchema.safeParse rejeita event_type inválido com erro estruturado", () => {
  const base = {
    external_quote_id: "11111111-2222-3333-4444-555555555555",
    occurred_at: new Date().toISOString(),
    payload: {},
  };
  for (const bad of ["cancelled", "APPROVED", "", "approve", "sent"]) {
    const res = CallbackSchema.safeParse({ ...base, event_type: bad });
    assertEquals(res.success, false, `deveria rejeitar event_type=${JSON.stringify(bad)}`);
  }
  const ok = CallbackSchema.safeParse({ ...base, event_type: "approved" });
  assert(ok.success, "deveria aceitar event_type=approved");
});

// ─── 4. INSERT real contra o banco → 23514 ──────────────────────────────
Deno.test({
  name: "INSERT com event_type inválido é rejeitado pelo CHECK do DB (23514)",
  sanitizeOps: false,
  sanitizeResources: false,
  ignore:
    !Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL") === "https://fake.supabase.co" ||
    !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") === "fake-service-role-key",
  async fn() {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const res = await sb
      .from("crm_callback_events")
      .insert({
        external_quote_id: "ffffffff-ffff-ffff-ffff-fffffffffffe",
        event_type: "cancelled_by_client", // fora da whitelist
        occurred_at: new Date().toISOString(),
        payload: {},
        result: "applied",
      })
      .select("id")
      .maybeSingle();
    assert(res.error, "esperava erro do Postgres");
    // 23514 = check_violation. Alguns clients também expõem em `code`.
    const code = (res.error as { code?: string }).code ?? "";
    const msg = res.error!.message ?? "";
    assert(
      code === "23514" || /chk_crm_callback_events_event_type|check constraint/i.test(msg),
      `esperava CHECK violation (23514), recebi code=${code} msg=${msg}`,
    );
    assertStringIncludes(msg.toLowerCase() + code, "check|23514".includes(code) ? "" : "");
  },
});
