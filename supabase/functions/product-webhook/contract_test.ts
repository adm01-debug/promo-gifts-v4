import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProductWebhookSchemas } from "../_shared/contracts/schemas/product-webhook.ts";

Deno.test("Contract: ProductWebhook V1 should accept valid upsert payload", () => {
  const payload = {
    action: "upsert",
    product: {
      sku: "SKU-001",
      name: "Test Product",
      price: 100.0,
      stock: 10
    }
  };
  
  const result = ProductWebhookSchemas.versions["1"].safeParse(payload);
  assertEquals(result.success, true);
});

Deno.test("Contract: ProductWebhook V2 should require idempotency_key", () => {
  const payload = {
    action: "upsert",
    product: {
      external_id: "ext-1",
      sku: "SKU-001",
      name: "Test Product",
      price: 100.0,
      currency: "BRL"
    }
  };
  
  const result = ProductWebhookSchemas.versions["2"].safeParse(payload);
  assertEquals(result.success, false);
});

Deno.test("Contract: ProductWebhook V2 should require external_id", () => {
  const payload = {
    action: "upsert",
    idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
    product: {
      sku: "SKU-001",
      name: "Test Product",
      price: 100.0
    }
  };
  
  const result = ProductWebhookSchemas.versions["2"].safeParse(payload);
  assertEquals(result.success, false);
});
