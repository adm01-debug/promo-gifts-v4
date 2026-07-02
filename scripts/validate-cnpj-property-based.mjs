#!/usr/bin/env node
/**
 * Fuzzer standalone (Node, sem Vitest) para SSOT do CNPJ.
 * Roda 5.000 iterações verificando idempotência, roundtrip e "no-mask leak".
 * Uso: node scripts/validate-cnpj-property-based.mjs [N]
 */
const N = Number(process.argv[2] ?? 5000);

function normalizeCnpj(v) {
  return (v ?? '').replace(/\D/g, '').slice(0, 14);
}
function maskCnpj(v) {
  return normalizeCnpj(v)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
function validateCnpj(v) {
  const d = String(v).replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = w1.reduce((a, w, i) => a + parseInt(d[i]) * w, 0) % 11;
  const d1 = s < 2 ? 0 : 11 - s;
  if (parseInt(d[12]) !== d1) return false;
  s = w2.reduce((a, w, i) => a + parseInt(d[i]) * w, 0) % 11;
  const d2 = s < 2 ? 0 : 11 - s;
  return parseInt(d[13]) === d2;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genValidCnpj(rnd) {
  while (true) {
    const base = Array.from({ length: 12 }, () => Math.floor(rnd() * 10));
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = base.reduce((acc, d, i) => acc + d * w1[i], 0) % 11;
    const d1 = s < 2 ? 0 : 11 - s;
    const a13 = [...base, d1];
    s = a13.reduce((acc, d, i) => acc + d * w2[i], 0) % 11;
    const d2 = s < 2 ? 0 : 11 - s;
    const c = [...a13, d2].join('');
    if (!/^(\d)\1{13}$/.test(c)) return c;
  }
}
function scatter(rnd, s) {
  const noise = [' ', '.', '-', '/', '\t', '\u00A0', '\u200B'];
  let out = '';
  for (const ch of s) {
    out += ch;
    if (rnd() < 0.2) out += noise[Math.floor(rnd() * noise.length)];
  }
  return out;
}

let asserts = 0;
const fail = (msg) => {
  console.error('✗', msg);
  process.exit(1);
};
const check = (cond, msg) => {
  asserts++;
  if (!cond) fail(msg);
};

const rnd = mulberry32(0xC0FFEE);
const MASK_RE = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

for (let i = 0; i < N; i++) {
  const v = genValidCnpj(rnd);
  const s = scatter(rnd, v);
  const n = normalizeCnpj(s);
  check(n === v, `[${i}] normalize scatter falhou: ${JSON.stringify(s)} → ${n} (esperado ${v})`);
  check(/^\d{14}$/.test(n), `[${i}] non-digit leak: ${n}`);
  check(validateCnpj(n), `[${i}] DVs inválidos após normalize: ${n}`);
  const m = maskCnpj(n);
  check(m.length === 18 && MASK_RE.test(m), `[${i}] mask malformada: ${m}`);
  check(normalizeCnpj(m) === n, `[${i}] normalize(mask) não é inverso: ${m} → ${normalizeCnpj(m)}`);
  check(maskCnpj(m) === m, `[${i}] mask não é idempotente: ${m} → ${maskCnpj(m)}`);
}

// Adversarial: entradas aleatórias — o output normalizado nunca deve conter máscara
const adv = mulberry32(0xF00D);
for (let i = 0; i < N; i++) {
  const len = 1 + Math.floor(adv() * 30);
  const s = Array.from({ length: len }, () => String.fromCharCode(32 + Math.floor(adv() * 95))).join('');
  const n = normalizeCnpj(s);
  check(/^\d{0,14}$/.test(n), `[adv ${i}] leak: ${JSON.stringify(s)} → ${JSON.stringify(n)}`);
}

console.log(`✓ ${asserts.toLocaleString()} asserções OK (${N} amostras válidas + ${N} adversariais)`);
