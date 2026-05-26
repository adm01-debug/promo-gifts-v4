import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { invokeFunction, registerCase } from "../_shared.ts";

registerCase({ functionName: "webhook-inbound", caseId: "WHI-001", businessRule: "sem assinatura HMAC deve rejeitar", testName: "assinatura ausente", run: async () => {
  const res = await invokeFunction("webhook-inbound", { event: "test" });
  await res.text();
  assertEquals(res.status, 401);
}});

registerCase({ functionName: "webhook-inbound", caseId: "WHI-002", businessRule: "assinatura em formato inválido deve rejeitar", testName: "formato inválido", run: async () => {
  const res = await invokeFunction("webhook-inbound", { event: "test" }, { "X-Hub-Signature-256": "plain_text_not_hmac" });
  await res.text();
  assertEquals(res.status, 401);
}});

registerCase({ functionName: "webhook-inbound", caseId: "WHI-003", businessRule: "assinatura incorreta deve rejeitar", testName: "assinatura incorreta", run: async () => {
  const res = await invokeFunction("webhook-inbound", { event: "test" }, { "X-Hub-Signature-256": "sha256=4f2f5e1f76e3d23f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f" });
  await res.text();
  assertEquals(res.status, 401);
}});
