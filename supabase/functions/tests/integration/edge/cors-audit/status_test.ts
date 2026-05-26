import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({
  functionName: "cors-audit",
  caseId: "COR-001",
  businessRule: "Acesso autorizado deve retornar o snapshot de auditoria",
  testName: "status 200 com service_role + flag",
  run: async () => {
    const res = await invokeFunction("cors-audit", {});
    const body = await res.json();
    assert(res.status === 200, `Status inesperado: ${res.status}`);
    assert(body.snapshot !== undefined, "Snapshot ausente no body");
    assert(body.audit !== undefined, "Audit ausente no body");
  },
});

registerCase({
  functionName: "cors-audit",
  caseId: "COR-002",
  businessRule: "Acesso sem flag interna deve ser bloqueado mesmo com service_role",
  testName: "status 401 sem flag",
  run: async () => {
    // Sobrescrevemos o header padrão removendo a flag
    const res = await invokeFunction("cors-audit", {}, { "X-Internal-Call": "false" });
    await res.text();
    assert(res.status === 401, `Deveria ser 401: ${res.status}`);
  },
});
