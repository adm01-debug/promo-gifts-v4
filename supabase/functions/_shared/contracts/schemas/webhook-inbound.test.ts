import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { parseContract } from "../parse.ts";
import { WebhookInboundSchemas } from "./webhook-inbound.ts";

Deno.test("webhook-inbound contract: default v2 rejects non-envelope payload", async () => {
  const req = new Request("https://example.test/functions/v1/webhook-inbound", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ not_envelope: true }),
  });

  const result = await parseContract(req, WebhookInboundSchemas);
  assertEquals(result.ok, false);
  if (result.ok) return;

  assertEquals(result.response.status, 422);
  const body = await result.response.json();
  assertEquals(body.code, "validation_error");
});

Deno.test("webhook-inbound contract: v1 passthrough still parses when explicitly requested", async () => {
  const req = new Request("https://example.test/functions/v1/webhook-inbound?v=1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ not_envelope: true }),
  });

  const result = await parseContract(req, WebhookInboundSchemas);
  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.version, "1");
});
