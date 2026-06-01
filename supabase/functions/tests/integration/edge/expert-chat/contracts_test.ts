import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({ functionName: "expert-chat", caseId: "ECH-001", businessRule: "requisição sem mensagem deve ser rejeitada", testName: "rejeita payload sem mensagem", run: async () => {
  const res = await invokeFunction("expert-chat", {});
  await res.text();
  assert(res.status === 400 || res.status === 401 || res.status === 422);
}});

registerCase({ functionName: "expert-chat", caseId: "ECH-002", businessRule: "validação inicial deve responder em até 500ms", testName: "latência <500ms", run: async () => {
  const start = performance.now();
  const res = await invokeFunction("expert-chat", {});
  const elapsed = performance.now() - start;
  assert(elapsed < 500, `elapsed=${elapsed.toFixed(0)}ms`);
  await res.body?.cancel();
}});
