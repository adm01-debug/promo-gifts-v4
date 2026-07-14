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
 * Retorna todos os botões de miniatura do PreviewSidebar dentro do container.
 */
export function thumbsFrom(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Ir para página"]'),
  );
}
