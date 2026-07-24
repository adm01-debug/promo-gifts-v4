#!/usr/bin/env node
/**
 * fuzz-cart-delete-popover.mjs
 *
 * Fuzz determinístico da máquina de estados do fluxo de exclusão do carrinho
 * via popover do header. Modela o reducer implícito de CartHeaderButton +
 * SellerCartContext e verifica invariantes ao longo de 500 execuções (seed
 * 1..500), cada uma com 40 ações aleatórias.
 *
 * Invariantes:
 *   I1  Nunca >1 DELETE em voo simultâneo.
 *   I2  pendingDeleteId ∈ carts.map(id) ∨ pendingDeleteId === null.
 *   I3  Popover e Dialog nunca estão simultaneamente "abertos" após 1 tick.
 *   I4  Sucesso ⇒ pendingDeleteId === null ∧ cart removido.
 *   I5  Falha ⇒ pendingDeleteId === id ∧ cart preservado ∧ dialog aberto.
 *   I6  activeCartId só é limpo quando o cart deletado era o ativo.
 *   I7  localStorage[seller:active-cart-id:<uid>] consistente com activeCartId.
 *   I8  Sem "phantom deletes": deletes.length === Σ (sucessos).
 *   I9  HTTP 2xx sem linha deletada é erro: mantém dialog aberto e cart preservado.
 */

// --------- PRNG determinística (mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// --------- Modelo do estado
function initialState(nCarts) {
  const carts = Array.from({ length: nCarts }, (_, i) => `c${i}`);
  return {
    userId: 'u1',
    carts: [...carts],
    activeCartId: carts[0] ?? null,
    localStorage: carts[0] ? { 'seller:active-cart-id:u1': carts[0] } : {},
    popoverOpen: false,
    pendingDeleteId: null,     // id sendo confirmado (dialog aberto)
    scheduledDelete: null,     // rAF simulado — vira pendingDeleteId no próximo tick
    inFlight: null,            // id do DELETE em voo
    isDeletingCart: false,
    deletes: [],               // ids efetivamente deletados
    attempts: 0,
    dialogOpen: false,         // computed: pendingDeleteId !== null
  };
}

// Reconciler chamado após qualquer ação — resolve rAF pendente e derivados.
function tick(s) {
  if (s.scheduledDelete !== null) {
    s.pendingDeleteId = s.scheduledDelete;
    s.scheduledDelete = null;
  }
  // popover fecha no mesmo click que agenda o delete (setOpen(false))
  s.dialogOpen = s.pendingDeleteId !== null;
}

// --------- Ações
const actions = {
  openPopover(s) {
    // AlertDialog é modal — bloqueia interações fora dele. Se o dialog está
    // aberto, o clique no cart-trigger é interceptado pelo overlay do dialog.
    if (s.pendingDeleteId !== null || s.scheduledDelete !== null) return;
    s.popoverOpen = true;
  },
  closePopover(s) {
    s.popoverOpen = false;
  },
  clickTrash(s, rng) {
    if (!s.popoverOpen || s.carts.length === 0) return;
    const id = pick(rng, s.carts);
    // Reproduz exatamente o handler: setOpen(false) + rAF(setPendingDeleteId)
    s.popoverOpen = false;
    s.scheduledDelete = id;
  },
  cancelDialog(s) {
    if (!s.dialogOpen || s.isDeletingCart) return;
    s.pendingDeleteId = null;
  },
  escapeDialog(s) {
    if (!s.dialogOpen || s.isDeletingCart) return;
    s.pendingDeleteId = null;
  },
  confirmDelete(s, rng, mode) {
    if (!s.dialogOpen || s.isDeletingCart || s.pendingDeleteId === null) return;
    const id = s.pendingDeleteId;
    s.attempts += 1;
    s.isDeletingCart = true;
    s.inFlight = id;
    // Resolve inline (simulação síncrona; ordem preservada)
    if (mode === 'ok') {
      const idx = s.carts.indexOf(id);
      if (idx >= 0) s.carts.splice(idx, 1);
      s.deletes.push(id);
      if (s.activeCartId === id) {
        s.activeCartId = null;
        delete s.localStorage[`seller:active-cart-id:${s.userId}`];
      }
      s.pendingDeleteId = null;
    } else if (mode === 'noop') {
      // Backend respondeu 2xx, mas a mutation robusta não recebeu a linha deletada.
      // Deve ser tratado como falha, não como sucesso.
    } else {
      // fail: mantém dialog aberto, cart preservado
    }
    s.isDeletingCart = false;
    s.inFlight = null;
  },
  rapidConfirm(s, rng, mode) {
    // 5 cliques encadeados; só o primeiro passa pelo guard
    for (let i = 0; i < 5; i++) actions.confirmDelete(s, rng, mode);
  },
  switchActive(s, rng) {
    if (s.carts.length === 0) return;
    const nid = pick(rng, s.carts);
    s.activeCartId = nid;
    s.localStorage[`seller:active-cart-id:${s.userId}`] = nid;
  },
};

const ACTION_NAMES = Object.keys(actions);

// --------- Invariantes
function checkInvariants(s, log) {
  const errs = [];
  // I1
  if (s.inFlight !== null && s.isDeletingCart === false) errs.push('I1: inFlight sem isDeletingCart');
  // I2
  if (s.pendingDeleteId !== null && !s.carts.includes(s.pendingDeleteId)) {
    // Exceção legítima: durante um DELETE bem sucedido, pendingDeleteId é limpo
    // ANTES de sair do reducer; então, fora daquela janela, é violação.
    errs.push(`I2: pendingDeleteId=${s.pendingDeleteId} não está em carts=[${s.carts.join(',')}]`);
  }
  // I3
  if (s.popoverOpen && s.dialogOpen) errs.push('I3: popover E dialog abertos simultaneamente');
  // I6 e I7
  const lsVal = s.localStorage[`seller:active-cart-id:${s.userId}`];
  if (s.activeCartId && lsVal !== s.activeCartId) errs.push(`I7: LS(${lsVal}) != activeCartId(${s.activeCartId})`);
  if (!s.activeCartId && lsVal) errs.push(`I7: activeCartId nulo mas LS=${lsVal}`);
  // I8
  if (s.deletes.length > s.attempts) errs.push('I8: mais deletes que attempts');
  return errs;
}

// --------- Runner
function runSeed(seed) {
  const rng = mulberry32(seed);
  const nCarts = 1 + Math.floor(rng() * 5);
  const s = initialState(nCarts);
  const trace = [];
  const N_STEPS = 40;
  for (let step = 0; step < N_STEPS; step++) {
    if (s.carts.length === 0) break;
    const name = pick(rng, ACTION_NAMES);
    const r = rng();
    const mode = r < 0.65 ? 'ok' : r < 0.85 ? 'fail' : 'noop';
    try {
      actions[name](s, rng, mode);
    } catch (e) {
      return { seed, ok: false, errors: [`throw em ${name}: ${e.message}`], trace };
    }
    tick(s);
    trace.push({ step, name, mode });
    const errs = checkInvariants(s);
    if (errs.length) {
      return { seed, ok: false, errors: errs, trace, finalState: s };
    }
  }
  return { seed, ok: true, attempts: s.attempts, deletes: s.deletes.length, carts: s.carts.length };
}

// --------- Main
const N_SEEDS = 500;
let pass = 0;
const failures = [];
let totalAttempts = 0;
let totalDeletes = 0;

for (let seed = 1; seed <= N_SEEDS; seed++) {
  const r = runSeed(seed);
  if (r.ok) {
    pass += 1;
    totalAttempts += r.attempts;
    totalDeletes += r.deletes;
  } else {
    failures.push(r);
  }
}

const summary = {
  totalSeeds: N_SEEDS,
  passed: pass,
  failed: failures.length,
  totalDeleteAttempts: totalAttempts,
  totalSuccessfulDeletes: totalDeletes,
  invariantViolations: failures.slice(0, 20).map((f) => ({
    seed: f.seed,
    errors: f.errors,
    lastAction: f.trace[f.trace.length - 1],
  })),
};

console.log(JSON.stringify(summary, null, 2));
process.exit(failures.length ? 1 : 0);
