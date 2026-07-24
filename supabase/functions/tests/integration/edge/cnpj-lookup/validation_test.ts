import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({
  functionName: "cnpj-lookup",
  caseId: "CNPJ-001",
  businessRule: "deve rejeitar CNPJ inválido com mensagem de erro",
  testName: "validação de entrada inválida",
  run: async () => {
    const res = await invokeFunction("cnpj-lookup", { cnpj: "invalid" });
    assertEquals(res.status, 400);
    const data = await res.json();
    assert(data.error || data.message);
  },
});
