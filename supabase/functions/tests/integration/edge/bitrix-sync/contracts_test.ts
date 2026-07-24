import { assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({ functionName: "bitrix-sync", caseId: "BSY-001", businessRule: "payload malformado deve falhar", testName: "erro de payload", run: async () => {
  const res = await invokeFunction("bitrix-sync", { malformed: true });
  await res.text();
  assert(res.status >= 400);
}});

registerCase({ functionName: "bitrix-sync", caseId: "BSY-002", businessRule: "retry de quote duplicada não deve derrubar função", testName: "idempotência (segunda chamada sem 5xx)", run: async () => {
  const payload = { quote_id: "test-dedup-id", event: "quote.created", data: {} };
  const res1 = await invokeFunction("bitrix-sync", payload);
  const res2 = await invokeFunction("bitrix-sync", payload);
  assert(res2.status < 500, `status inesperado na segunda chamada: ${res2.status}`);
  await res1.body?.cancel();
  await res2.body?.cancel();
}});
