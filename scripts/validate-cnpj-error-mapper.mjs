#!/usr/bin/env node
/**
 * Fuzzer standalone (Node) do SSOT `mapCnpjError`.
 *
 * 2.000 iterações cobrindo:
 *  - Zod-like issues (message aleatório com/sem tokens conhecidos)
 *  - Postgres 23514 (check violation) com constraint fuzzada
 *  - Postgres 23505 (unique violation) com/sem details
 *  - Erros nativos (Error, TypeError), string, null, undefined, {}, arrays
 *  - Objetos circulares e com getters que lançam
 *
 * Asserts (invariantes):
 *  - Sempre retorna objeto {code, message}
 *  - `message` ∈ CNPJ_ERROR_MESSAGES (nunca vazio, nunca cru técnico)
 *  - `code` ∈ {'cnpj_length_invalid','cnpj_dv_invalid','cnpj_duplicated','cnpj_unknown'}
 *  - Nunca vaza "stack", "constraint", "PG::", SQL cru, coluna
 */

// Replica SSOT (fonte única = src/utils/cnpj-errors.ts).
// Mantido em sync manual: se o mapper mudar, este fuzzer precisa atualizar.
const CNPJ_ERROR_MESSAGES = {
  cnpj_length_invalid: 'CNPJ deve conter exatamente 14 dígitos (sem máscara).',
  cnpj_dv_invalid: 'CNPJ inválido (dígitos verificadores não conferem).',
  cnpj_duplicated: 'CNPJ já cadastrado.',
  cnpj_unknown: 'CNPJ inválido.',
};

function mapCnpjError(input) {
  let raw = '';
  let code = '';
  let details = '';
  try {
    raw = typeof input === 'string' ? input : String(input?.message ?? '');
  } catch { raw = ''; }
  try {
    code = typeof input === 'object' && input !== null ? String(input.code ?? '') : '';
  } catch { code = ''; }
  try {
    details = typeof input === 'object' && input !== null ? String(input.details ?? '') : '';
  } catch { details = ''; }
  const hay = `${raw} ${details}`.toLowerCase();
  if (code === '23505' || /duplic|already exists|unique/i.test(hay)) {
    return { code: 'cnpj_duplicated', message: CNPJ_ERROR_MESSAGES.cnpj_duplicated };
  }
  if (/14 d[ií]gitos|length|too short|too long/i.test(hay) || /cnpj_length/.test(hay)) {
    return { code: 'cnpj_length_invalid', message: CNPJ_ERROR_MESSAGES.cnpj_length_invalid };
  }
  if (/inv[aá]lido|dv|verificador|checksum|digits_only|check constraint/i.test(hay)) {
    return { code: 'cnpj_dv_invalid', message: CNPJ_ERROR_MESSAGES.cnpj_dv_invalid };
  }
  return { code: 'cnpj_unknown', message: CNPJ_ERROR_MESSAGES.cnpj_unknown };
}

const VALID_CODES = new Set(Object.keys(CNPJ_ERROR_MESSAGES));
const VALID_MSGS = new Set(Object.values(CNPJ_ERROR_MESSAGES));
const LEAK_PATTERNS = [
  /\bstack\b/i,
  /\bconstraint\b/i,
  /pg::/i,
  /select .* from/i,
  /column "/i,
  /\bnull\b/i,
  /\bundefined\b/i,
];

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
const rnd = mulberry32(0xBEEF);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const CONSTRAINTS = [
  'cnpj_length_chk', 'suppliers_cnpj_length_chk', 'products_cnpj_length_chk',
  'cnpj_digits_only_chk', 'CNPJ_LENGTH_CHK', 'public.cnpj_length_chk',
  'cnpj_lenght_chk', 'other_random_chk', 'idx_cnpj_uniq', 'suppliers_cnpj_org_uniq',
];
const ZOD_MSGS = [
  'CNPJ deve conter exatamente 14 dígitos (sem máscara).',
  'CNPJ inválido (dígitos verificadores não conferem).',
  'String must contain at least 14 character(s)',
  'Invalid input',
  'checksum failed',
  'too short',
  'too long',
  'valor inválido',
];
const NOISE = ['🎁', '\u200B', '\u00A0', 'x', ' ', '{}', '\n'];

function makeFuzzInput(i) {
  const kind = i % 12;
  switch (kind) {
    case 0: return new Error(pick(ZOD_MSGS));
    case 1: return new TypeError(pick(ZOD_MSGS) + pick(NOISE));
    case 2: return { code: '23514', message: `new row violates check constraint "${pick(CONSTRAINTS)}"` };
    case 3: return { code: '23505', message: 'duplicate key value violates unique constraint', details: `Key (cnpj)=(02931668000188) already exists.` };
    case 4: return { code: '23505', message: 'unique_violation' };
    case 5: return pick(ZOD_MSGS);
    case 6: return null;
    case 7: return undefined;
    case 8: return {};
    case 9: return [];
    case 10: {
      const o = { message: pick(ZOD_MSGS), code: '23514', details: pick(CONSTRAINTS) };
      o.self = o; // circular
      return o;
    }
    case 11: return {
      get message() { throw new Error('boom'); },
      get code() { throw new Error('boom'); },
      get details() { throw new Error('boom'); },
    };
  }
}

let asserts = 0;
const fails = [];
const check = (cond, ctx) => { asserts++; if (!cond) fails.push(ctx); };

for (let i = 0; i < 2000; i++) {
  const input = makeFuzzInput(i);
  let out;
  try { out = mapCnpjError(input); }
  catch (e) { fails.push({ i, kind: 'threw', err: String(e) }); continue; }
  check(out && typeof out === 'object', { i, msg: 'não-obj', out });
  check(VALID_CODES.has(out.code), { i, msg: 'code fora do SSOT', out });
  check(VALID_MSGS.has(out.message), { i, msg: 'message fora do SSOT', out });
  for (const p of LEAK_PATTERNS) {
    check(!p.test(out.message), { i, msg: `leak ${p}`, out });
  }
}

// Alcançabilidade: cada mensagem deve ser produzida por ≥ 1 input canônico.
const cases = [
  ['cnpj_length_invalid', new Error('CNPJ deve conter exatamente 14 dígitos (sem máscara).')],
  ['cnpj_length_invalid', { code: '23514', message: 'check constraint "cnpj_length_chk"' }],
  ['cnpj_dv_invalid', new Error('CNPJ inválido (DVs)')],
  ['cnpj_dv_invalid', { code: '23514', message: 'check constraint "cnpj_digits_only_chk"' }],
  ['cnpj_duplicated', { code: '23505', message: 'x' }],
  ['cnpj_duplicated', 'CNPJ already exists'],
  ['cnpj_unknown', null],
  ['cnpj_unknown', {}],
];
for (const [expected, input] of cases) {
  const out = mapCnpjError(input);
  check(out.code === expected, { msg: `alcançabilidade falhou: esperado ${expected}, veio ${out.code}`, input });
}

console.log(`\n=== Fuzz mapCnpjError ===`);
console.log(`Iterações: 2000 + ${cases.length} canônicos`);
console.log(`Asserções: ${asserts.toLocaleString()}`);
console.log(`Falhas: ${fails.length}`);
if (fails.length) {
  console.log(JSON.stringify(fails.slice(0, 10), null, 2));
  process.exit(1);
}
console.log('✅ Todas as invariantes OK.');
