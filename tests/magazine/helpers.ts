/**
 * Helpers compartilhados para os testes do módulo Magazine.
 */

export type RingState = { primary: boolean; amber: boolean };

/**
 * Retorna o conjunto de classes de ring aplicadas na base do elemento.
 * Ignora variantes prefixadas (`hover:`, `focus-visible:`, `active:`, etc.)
 * porque não estão pintadas simultaneamente ao estado observado.
 */
export function ringsOf(btn: HTMLElement): RingState {
  const tokens = btn.className.split(/\s+/);
  const base = tokens.filter((t) => !t.includes(':'));
  return {
    primary: base.includes('ring-primary'),
    amber: base.includes('ring-amber-500'),
  };
}

/**
 * Retorna o conjunto de classes de ring aplicadas SOMENTE sob `focus-visible`.
 * Considera apenas tokens prefixados com `focus-visible:` — não olha para o
 * estado base — de forma que testes de colisão por teclado possam validar,
 * de maneira isolada, qual ring o navegador pintaria ao aplicar `:focus-visible`.
 */
export function focusRingsOf(btn: HTMLElement): RingState {
  const tokens = btn.className.split(/\s+/);
  const fv = tokens
    .filter((t) => t.startsWith('focus-visible:'))
    .map((t) => t.slice('focus-visible:'.length));
  return {
    primary: fv.includes('ring-primary'),
    amber: fv.includes('ring-amber-500'),
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
