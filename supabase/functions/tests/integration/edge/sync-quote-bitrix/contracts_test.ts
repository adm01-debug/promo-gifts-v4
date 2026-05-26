import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({ functionName: "sync-quote-bitrix", caseId: "SQB-001", businessRule: "payload sem quote_id deve falhar", testName: "rejeita payload inválido", run: async () => {
  const res = await invokeFunction("sync-quote-bitrix", { malformed: true });
  assert(res.status >= 400);
}});

registerCase({ functionName: "sync-quote-bitrix", caseId: "SQB-002", businessRule: "validação inicial deve cumprir gate de latência", testName: "latência <500ms", run: async () => {
  const start = performance.now();
  const res = await invokeFunction("sync-quote-bitrix", {});
  const elapsed = performance.now() - start;
  assert(elapsed < 500, `elapsed=${elapsed.toFixed(0)}ms`);
  await res.body?.cancel();
}});
