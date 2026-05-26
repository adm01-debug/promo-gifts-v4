import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({
  functionName: "validate-access",
  caseId: "VAC-001",
  businessRule: "payload vazio deve retornar erro de validação/autenticação",
  testName: "status code esperado",
  run: async () => {
    const res = await invokeFunction("validate-access", {});
    assert(res.status === 400 || res.status === 401, `Status inesperado: ${res.status}`);
  },
});
