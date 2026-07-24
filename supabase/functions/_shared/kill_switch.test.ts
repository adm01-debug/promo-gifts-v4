// Tests para o helper de kill-switch usado na contenção do colapso 2026-05-24.
// Garante o contrato crítico: quando o switch está OFF, o handler recebe um
// Response 410 ANTES de qualquer trabalho; quando ON / inexistente / falha de
// rede, recebe null (fail-open) e segue normalmente.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// O módulo captura SUPABASE_URL/ANON_KEY no load — setar ANTES do import.
Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

const { assertSwitchEnabled } = await import("./kill_switch.ts");

const realFetch = globalThis.fetch;
function stubFetch(handler: () => Promise<Response> | Response) {
  globalThis.fetch = (() => Promise.resolve(handler())) as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}

const req = new Request("https://edge.test/external-db-bridge", { method: "POST" });

Deno.test("switch OFF → retorna Response 410 sem tocar no banco", async () => {
  stubFetch(() =>
    new Response(JSON.stringify([{ enabled: false, legacy_message: "Descontinuada." }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  try {
    const res = await assertSwitchEnabled("sw_off_unique", req, { "x-cors": "1" });
    assert(res instanceof Response, "deveria retornar Response");
    assertEquals(res!.status, 410);
    const body = await res!.json();
    assertEquals(body.switch, "sw_off_unique");
    assertEquals(body.message, "Descontinuada.");
    assertEquals(res!.headers.get("x-cors"), "1");
  } finally {
    restoreFetch();
  }
});

Deno.test("switch ON → retorna null (segue o fluxo)", async () => {
  stubFetch(() =>
    new Response(JSON.stringify([{ enabled: true, legacy_message: null }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  try {
    const res = await assertSwitchEnabled("sw_on_unique", req);
    assertEquals(res, null);
  } finally {
    restoreFetch();
  }
});

Deno.test("switch inexistente (array vazio) → null", async () => {
  stubFetch(() =>
    new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
  );
  try {
    const res = await assertSwitchEnabled("sw_absent_unique", req);
    assertEquals(res, null);
  } finally {
    restoreFetch();
  }
});

Deno.test("fail-open: erro de rede no fetch → null (não bloqueia tráfego)", async () => {
  stubFetch(() => {
    throw new Error("network down");
  });
  try {
    const res = await assertSwitchEnabled("sw_neterr_unique", req);
    assertEquals(res, null);
  } finally {
    restoreFetch();
  }
});

Deno.test("fail-open: HTTP 5xx → null", async () => {
  stubFetch(() => new Response("err", { status: 503 }));
  try {
    const res = await assertSwitchEnabled("sw_5xx_unique", req);
    assertEquals(res, null);
  } finally {
    restoreFetch();
  }
});
