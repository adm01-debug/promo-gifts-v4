import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProductWebhookV1 } from "./product-webhook.ts";

Deno.test("ProductWebhookV1 rejects variation sem shape mínima", () => {
  const payload = {
    action: "upsert",
    product: {
      sku: "SKU-1",
      name: "Produto",
      price: 10,
      variations: ["sem-objeto"],
    },
  };

  const result = ProductWebhookV1.safeParse(payload);
  assertEquals(result.success, false);
});

Deno.test("ProductWebhookV1 rejects variation sem identificador", () => {
  const payload = {
    action: "upsert",
    product: {
      sku: "SKU-1",
      name: "Produto",
      price: 10,
      variations: [{ color: "red" }],
    },
  };

  const result = ProductWebhookV1.safeParse(payload);
  assertEquals(result.success, false);
});

Deno.test("ProductWebhookV1 rejects metadata com payload massivo", () => {
  const metadata = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`k${i}`, i]));

  const payload = {
    action: "upsert",
    product: {
      sku: "SKU-1",
      name: "Produto",
      price: 10,
      metadata,
    },
  };

  const result = ProductWebhookV1.safeParse(payload);
  assertEquals(result.success, false);
});

Deno.test("ProductWebhookV1 rejects metadata com array gigante", () => {
  const payload = {
    action: "upsert",
    product: {
      sku: "SKU-1",
      name: "Produto",
      price: 10,
      metadata: {
        huge: Array.from({ length: 101 }, (_, i) => i),
      },
    },
  };

  const result = ProductWebhookV1.safeParse(payload);
  assertEquals(result.success, false);
});
