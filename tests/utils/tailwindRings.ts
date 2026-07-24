/**
 * SSOT — Helpers para inspecionar rings do Tailwind aplicados a elementos DOM.
 *
 * Origem: extraído de `tests/magazine/helpers.ts` (auditoria 2026-07-14) para ser
 * reutilizado por qualquer suíte que precise validar rings — Magazine PreviewSidebar,
 * LayoutStep, CompareTableView, etc.
 *
 * Hardening:
 *  - Tolerante a `className` undefined / DOMTokenList / SVGAnimatedString.
 *  - Whitespace irregular (`\n`, `\t`, múltiplos espaços) tratado via regex `\s+`.
 *  - Detecção de rings permissiva por família:
 *      `ring-primary`   → aceita `ring-primary` e `ring-primary/<opacity>`.
 *      `ring-amber-<N>` → aceita QUALQUER shade âmbar (`ring-amber-500`,
 *                         `ring-amber-400`, `ring-amber-600/50`, …).
 *  - Variants Tailwind empilhados (`md:focus-visible:ring-primary`,
 *    `lg:hover:ring-primary`) são reconhecidos pelo ÚLTIMO variant da cadeia.
 */

export type RingState = { primary: boolean; amber: boolean };

/** Extrai a lista de classes de um elemento independentemente do tipo do node. */
export function classListOf(el: Element): string[] {
  // 1) HTMLElement clássico → `className` é string.
  const raw = (el as HTMLElement).className;
  if (typeof raw === 'string') {
    return raw.split(/\s+/).filter(Boolean);
  }
  // 2) SVGAnimatedString → `.baseVal` é string.
  if (raw && typeof (raw as { baseVal?: unknown }).baseVal === 'string') {
    return (raw as { baseVal: string }).baseVal.split(/\s+/).filter(Boolean);
  }
  // 3) Fallback via classList (DOMTokenList). Cobre casos exóticos e
  //    elementos sem `className` diretamente definido.
  if (el.classList && el.classList.length > 0) {
    return Array.from(el.classList);
  }
  return [];
}

const PRIMARY_RE = /^ring-primary(?:\/\d+)?$/;
const AMBER_RE = /^ring-amber-\d+(?:\/\d+)?$/;

export function isPrimaryToken(token: string): boolean {
  return PRIMARY_RE.test(token);
}

export function isAmberToken(token: string): boolean {
  return AMBER_RE.test(token);
}

/**
 * Retorna o conjunto de rings aplicados na "base" do elemento.
 * Um token é "base" quando NÃO contém `:` (nenhum variant Tailwind).
 */
export function ringsOf(el: Element): RingState {
  const tokens = classListOf(el);
  const base = tokens.filter((t) => !t.includes(':'));
  return {
    primary: base.some(isPrimaryToken),
    amber: base.some(isAmberToken),
  };
}

/**
 * Retorna os rings pintados sob um variant Tailwind específico
 * (`focus-visible`, `hover`, `active`, …). Aceita cadeias empilhadas:
 * `md:focus-visible:ring-primary` conta como focus-visible.
 */
export function ringsByVariant(el: Element, variant: string): RingState {
  const tokens = classListOf(el);
  const matched: string[] = [];
  for (const t of tokens) {
    if (!t.includes(':')) continue;
    const parts = t.split(':');
    const last = parts[parts.length - 2]; // último variant antes do utilitário
    if (last === variant) {
      matched.push(parts[parts.length - 1]!);
    }
  }
  return {
    primary: matched.some(isPrimaryToken),
    amber: matched.some(isAmberToken),
  };
}

/** Retorna os rings pintados EXCLUSIVAMENTE sob `:focus-visible`. */
export function focusRingsOf(el: Element): RingState {
  return ringsByVariant(el, 'focus-visible');
}

/** Retorna os rings pintados EXCLUSIVAMENTE sob `:hover`. */
export function hoverRingsOf(el: Element): RingState {
  return ringsByVariant(el, 'hover');
}

/**
 * Retorna os rings pintados sob `:focus-within` — usado quando o container
 * ganha ring porque um descendente recebeu foco (padrão em popovers,
 * dropdowns e cards com CTA interno).
 */
export function focusWithinRingsOf(el: Element): RingState {
  return ringsByVariant(el, 'focus-within');
}

/**
 * Retorna os rings pintados sob `data-[state=<value>]` — variant Tailwind
 * arbitrário emitido por primitivas Radix (Popover, Dialog, Accordion,
 * Collapsible) que expõem `data-state="open"|"closed"|"on"|"off"|…`.
 *
 * Uso: `dataStateRingsOf(el, 'open')` → lê `data-[state=open]:ring-*`.
 */
export function dataStateRingsOf(el: Element, state: string): RingState {
  return ringsByVariant(el, `data-[state=${state}]`);
}
