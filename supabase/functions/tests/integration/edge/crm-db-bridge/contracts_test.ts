import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({ functionName: "crm-db-bridge", caseId: "CRM-001", businessRule: "payload vazio deve falhar em validação/autorização", testName: "rejeita payload vazio", run: async () => {
  const res = await invokeFunction("crm-db-bridge", {});
  assert(res.status === 400 || res.status === 401 || res.status === 422);
}});

registerCase({ functionName: "crm-db-bridge", caseId: "CRM-002", businessRule: "validação inicial deve cumprir SLO de latência", testName: "latência <500ms", run: async () => {
  const start = performance.now();
  const res = await invokeFunction("crm-db-bridge", { operation: "list" });
  const elapsed = performance.now() - start;
  assert(elapsed < 500, `elapsed=${elapsed.toFixed(0)}ms`);
  await res.body?.cancel();
}});
