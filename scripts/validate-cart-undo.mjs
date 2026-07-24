#!/usr/bin/env node
/**
 * Fuzz 500x + race 50 do snapshot de handleRemoveWithUndo.
 * Não toca produção: replica a função pura e valida o payload contra o
 * schema de AddToCartInput.
 */
import { z } from 'zod';

const AddToCartInput = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1),
  product_sku: z.string().optional(),
  product_image_url: z.string().optional(),
  product_price: z.number().finite(),
  quantity: z.number().int().min(1),
  color_name: z.string().optional(),
  color_hex: z.string().optional(),
  notes: z.string().nullable().optional(),
  sort_order: z.number().optional(),
});

const snapshot = (item) => ({
  product_id: item.product_id,
  product_name: item.product_name,
  product_sku: item.product_sku ?? undefined,
  product_image_url: item.product_image_url ?? undefined,
  product_price: item.product_price,
  quantity: item.quantity,
  color_name: item.color_name ?? undefined,
  color_hex: item.color_hex ?? undefined,
  notes: item.notes ?? undefined,
  sort_order: item.sort_order ?? undefined,
});

const rnd = (n) => Math.floor(Math.random() * n);
const orNull = (v) => (Math.random() < 0.4 ? null : v);
const emoji = ['🎁', '📦', '🖊️', '✨', '🔥'];
const longStr = (n) => 'x'.repeat(n);

function fuzzItem(i) {
  const flavor = rnd(6);
  return {
    id: `item-${i}`,
    product_id: `p-${i}`,
    product_name:
      flavor === 0
        ? emoji[rnd(emoji.length)] + ' ' + longStr(rnd(200))
        : flavor === 1
          ? longStr(5000)
          : `Produto ${i}`,
    product_sku: orNull(`SKU-${i}`),
    product_image_url: orNull(`https://x/y-${i}.jpg`),
    product_price:
      flavor === 2 ? 0 : flavor === 3 ? 999999.99 : Math.random() * 1000,
    quantity: flavor === 4 ? 999999 : rnd(999) + 1,
    color_name: orNull('Cor ' + i),
    color_hex: orNull('#abc123'),
    notes: orNull(flavor === 5 ? longStr(2000) : 'obs'),
    sort_order: orNull(rnd(100)),
  };
}

let fails = 0;
const failures = [];

// Fuzz 500 iterações
for (let i = 0; i < 500; i++) {
  const item = fuzzItem(i);
  const snap = snapshot(item);
  const parsed = AddToCartInput.safeParse(snap);
  if (!parsed.success) {
    fails++;
    if (failures.length < 5) failures.push({ i, item, err: parsed.error.issues });
    continue;
  }
  // Nunca deve haver null (só undefined ou valor)
  for (const [k, v] of Object.entries(snap)) {
    if (v === null) {
      fails++;
      if (failures.length < 5) failures.push({ i, key: k, msg: 'null vazou' });
    }
  }
}

// Race 50: gera 50 snapshots, muta os itens de origem, valida imutabilidade
const items = Array.from({ length: 50 }, (_, i) => fuzzItem(i));
const snaps = items.map(snapshot);
items.forEach((it) => {
  it.product_name = 'MUTADO';
  it.quantity = -1;
});
for (let i = 0; i < 50; i++) {
  if (snaps[i].product_name === 'MUTADO' || snaps[i].quantity === -1) {
    fails++;
    failures.push({ i, msg: 'race: snapshot mutou junto com item' });
  }
}

console.log(`\n=== Fuzz cart-undo snapshot ===`);
console.log(`Iterações: 500 + race 50 = 550`);
console.log(`Falhas: ${fails}`);
if (failures.length) {
  console.log(`Primeiras falhas:`);
  console.log(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('✅ 550/550 OK — snapshot sempre válido e imutável.');
