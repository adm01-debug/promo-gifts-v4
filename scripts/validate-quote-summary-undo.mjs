#!/usr/bin/env node
/**
 * Fuzz do UNDO no Resumo do Novo Orçamento.
 *
 * Simula 500 iterações de remove+undo com QuoteItems sintéticos em casos-limite
 * (emoji, 5k chars, XSS, unicode RTL, personalizations pesadas) + 50 iterações
 * de race (remove A, remove B, undo A, undo B).
 *
 * Critério: JSON.stringify(item_original) === JSON.stringify(item_restaurado).
 */

// Reproduz o helper de restore de QuoteBuilderPage.tsx.
const restore = (items) => (item, index) => {
  const next = [...items];
  next.splice(Math.min(index, next.length), 0, item);
  return next;
};

const removeAt = (items, idx) => items.filter((_, i) => i !== idx);

// Geradores de casos-limite
const rand = (max) => Math.floor(Math.random() * max);
const pick = (arr) => arr[rand(arr.length)];

const NAME_CASES = [
  '',
  'Produto normal',
  '🔥 Produto ✨ 🎁',
  'شركة النور', // RTL
  '<script>alert("xss")</script>',
  '"; DROP TABLE quote_items;--',
  'A'.repeat(5000),
  '   whitespace   ',
  '\n\r\t',
  '你好世界',
];

const PRICE_CASES = [0, 0.01, 10, 99.99, 1e6, Number.MAX_SAFE_INTEGER, -1, NaN];
const QTY_CASES = [1, 2, 100, 1e6, 0.5];

function mkItem(i) {
  const persCount = rand(21); // 0..20
  const personalizations = Array.from({ length: persCount }, (_, k) => ({
    technique_id: `t-${k % 3}`, // duplica ids às vezes
    technique_name: pick(['Silk', 'Bordado', 'Laser']),
    location_code: pick(['peito', 'costas', 'manga']),
    colors_count: rand(10),
    area_cm2: rand(500),
    setup_cost: Math.random() * 1000,
    unit_cost: Math.random() * 50,
  }));
  return {
    id: `qi-${i}`,
    product_id: `p-${rand(1000)}`,
    product_name: pick(NAME_CASES),
    product_sku: `SKU-${i}`,
    product_image_url: Math.random() > 0.5 ? `https://cdn/${i}.png` : undefined,
    quantity: pick(QTY_CASES),
    unit_price: pick(PRICE_CASES),
    color_name: pick(['Vermelho', 'Azul', undefined]),
    color_hex: pick(['#FF0000', '#0000FF', undefined]),
    notes: Math.random() > 0.7 ? pick(NAME_CASES) : undefined,
    sort_order: i,
    bitrix_product_id: Math.random() > 0.5 ? rand(1e6) : null,
    kit_group_id: Math.random() > 0.7 ? `kit-${rand(10)}` : null,
    kit_name: Math.random() > 0.7 ? `Kit ${rand(100)}` : null,
    size_code: pick(['P', 'M', 'G', null]),
    product_category_id: `cat-${rand(20)}`,
    product_category_name: pick(['Escritório', 'Vestuário', 'Tecnologia']),
    price_updated_at: Math.random() > 0.5 ? new Date().toISOString() : null,
    price_freshness_threshold_days: pick([30, 60, 90, null]),
    personalizations,
  };
}

let pass = 0;
let fail = 0;
const fails = [];

// Base: 500 iterações
for (let i = 0; i < 500; i++) {
  const arrSize = 1 + rand(20);
  const items = Array.from({ length: arrSize }, (_, k) => mkItem(i * 100 + k));
  const idx = rand(arrSize);
  const original = items[idx];
  const serializedBefore = JSON.stringify(original);

  const afterRemove = removeAt(items, idx);
  const restored = restore(afterRemove)(original, idx);

  // Item restaurado no índice correto
  const restoredItem = restored[idx];
  const serializedAfter = JSON.stringify(restoredItem);

  if (serializedBefore !== serializedAfter) {
    fail++;
    if (fails.length < 3) fails.push({ i, before: serializedBefore.slice(0, 200), after: serializedAfter.slice(0, 200) });
    continue;
  }
  if (restored.length !== items.length) {
    fail++;
    if (fails.length < 3) fails.push({ i, msg: `len ${restored.length} vs ${items.length}` });
    continue;
  }
  // Ordem completa preservada
  const originalIds = items.map((it) => it.id);
  const restoredIds = restored.map((it) => it.id);
  if (JSON.stringify(originalIds) !== JSON.stringify(restoredIds)) {
    fail++;
    if (fails.length < 3) fails.push({ i, msg: `order drift` });
    continue;
  }
  pass++;
}

// Race: 50 iterações — remove A, remove B, undo A, undo B (LIFO)
let racePass = 0;
let raceFail = 0;
for (let i = 0; i < 50; i++) {
  const size = 5 + rand(10);
  const items = Array.from({ length: size }, (_, k) => mkItem(10000 + i * 100 + k));
  const originalOrder = items.map((it) => it.id);

  const idxA = rand(size);
  const snapA = items[idxA];
  let after1 = removeAt(items, idxA);

  const idxB = rand(after1.length);
  const snapB = after1[idxB];
  let after2 = removeAt(after1, idxB);

  // Undo B (mais recente) primeiro — LIFO
  let restored = restore(after2)(snapB, idxB);
  // Undo A
  restored = restore(restored)(snapA, idxA);

  const restoredOrder = restored.map((it) => it.id);
  if (JSON.stringify(originalOrder) === JSON.stringify(restoredOrder)) racePass++;
  else {
    raceFail++;
    if (fails.length < 5) fails.push({ i: `race-${i}`, exp: originalOrder.join(','), got: restoredOrder.join(',') });
  }
}

const total = pass + fail + racePass + raceFail;
console.log(`\n=== FUZZ UNDO — QuoteBuilderSummaryColumn ===`);
console.log(`Base:  ${pass}/500 passed`);
console.log(`Race:  ${racePass}/50 passed`);
console.log(`Total: ${pass + racePass}/${total} passed`);
if (fails.length) {
  console.log(`\nFAILS (primeiros):`);
  fails.forEach((f) => console.log(JSON.stringify(f)));
}
process.exit(fail + raceFail === 0 ? 0 : 1);
