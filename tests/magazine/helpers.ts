/**
 * Helpers compartilhados para os testes do módulo Magazine.
 *
 * Hardening (Auditoria 2026-07-14):
 *  - Tolerante a `className` undefined / DOMTokenList / SVGAnimatedString.
 *  - Whitespace irregular (`\n`, `\t`, múltiplos espaços) tratado via regex `\s+`.
 *  - Detecção de rings permissiva por família:
 *      `ring-primary`      → aceita `ring-primary` e `ring-primary/<opacity>`.
 *      `ring-amber-<N>`    → aceita QUALQUER shade âmbar (`ring-amber-500`,
 *                            `ring-amber-400`, `ring-amber-600/50`, …).
 *    Isso evita falsos negativos silenciosos se um refactor trocar o shade
 *    do highlight sem revisar os testes.
 *  - `focus-visible:` reconhece prefixos empilhados (ex.: `md:focus-visible:`).
 *    Um token é considerado "somente focus-visible" quando o ÚLTIMO variant
 *    da cadeia é `focus-visible`.
 */

export type RingState = { primary: boolean; amber: boolean };

/** Extrai a lista de classes de um elemento independentemente do tipo do node. */
function classListOf(el: Element): string[] {
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

function isPrimaryToken(token: string): boolean {
  return PRIMARY_RE.test(token);
}

function isAmberToken(token: string): boolean {
  return AMBER_RE.test(token);
}

/**
 * Retorna o conjunto de rings aplicados na "base" do elemento.
 * Um token é "base" quando NÃO contém `:` (nenhum variant Tailwind).
 */
export function ringsOf(btn: Element): RingState {
  const tokens = classListOf(btn);
  const base = tokens.filter((t) => !t.includes(':'));
  return {
    primary: base.some(isPrimaryToken),
    amber: base.some(isAmberToken),
  };
}

/**
 * Retorna os rings pintados EXCLUSIVAMENTE sob `:focus-visible`.
 * Considera qualquer token cujo ÚLTIMO variant seja `focus-visible`
 * (ex.: `focus-visible:ring-primary`, `md:focus-visible:ring-primary`),
 * removendo essa cadeia de variants para inspecionar a classe utilitária final.
 */
export function focusRingsOf(btn: Element): RingState {
  const tokens = classListOf(btn);
  const fv: string[] = [];
  for (const t of tokens) {
    if (!t.includes(':')) continue;
    const parts = t.split(':');
    const last = parts[parts.length - 2]; // último variant antes do utilitário
    if (last === 'focus-visible') {
      fv.push(parts[parts.length - 1]!);
    }
  }
  return {
    primary: fv.some(isPrimaryToken),
    amber: fv.some(isAmberToken),
  };
}

/**
 * Retorna todos os botões de miniatura do PreviewSidebar dentro do container.
 */
export function thumbsFrom(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Ir para página"]'),
  );
}
