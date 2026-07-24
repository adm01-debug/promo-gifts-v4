/**
 * Helpers específicos das suítes de Magazine.
 *
 * `ringsOf`/`focusRingsOf` foram migrados para o SSOT em
 * `tests/utils/tailwindRings.ts` (auditoria 2026-07-14) — este módulo
 * re-exporta os símbolos para preservar compatibilidade com as suítes
 * existentes e mantém apenas o seletor específico de miniaturas.
 */

export {
  ringsOf,
  focusRingsOf,
  hoverRingsOf,
  ringsByVariant,
  classListOf,
  isPrimaryToken,
  isAmberToken,
} from '../utils/tailwindRings';
export type { RingState } from '../utils/tailwindRings';

/**
 * Retorna todos os botões de miniatura do PreviewSidebar dentro do container.
 */
export function thumbsFrom(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Ir para página"]'),
  );
}
