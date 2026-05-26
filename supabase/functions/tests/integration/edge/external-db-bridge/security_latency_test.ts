import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({ functionName: "external-db-bridge", caseId: "EDB-001", businessRule: "requisição sem auth deve ser rejeitada", testName: "rejeita sem auth", run: async () => {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL") || "http://localhost:54321"}/functions/v1/external-db-bridge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "SELECT 1" }),
  });
  const _body = await res.text();
  assert(res.status === 401 || res.status === 403);
}});

registerCase({ functionName: "external-db-bridge", caseId: "EDB-002", businessRule: "validação inicial deve responder abaixo do gate de latência", testName: "latência <500ms", run: async () => {
  const start = performance.now();
  const res = await invokeFunction("external-db-bridge", { query: "SELECT 1" });
  const elapsed = performance.now() - start;
  assert(elapsed < 500, `elapsed=${elapsed.toFixed(0)}ms`);
  await res.body?.cancel();
}});
