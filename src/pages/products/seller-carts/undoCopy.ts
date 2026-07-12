/**
 * undoCopy — SSOT das strings de copy do fluxo "Desfazer" no módulo Carrinhos.
 *
 * Reúne, num único módulo, TODA a copy usada em:
 *   • ConfirmDialog destrutivo (linha, lote, popover do header)
 *   • Toast "Desfazer" (título + descrição + duração)
 *   • Toast de resultado do restore (sucesso/parcial/falha) — via `bulkRestoreSummary`
 *
 * Regras:
 *   - Tempo de undo é único (`UNDO_DURATION_MS` = 8000) e a label exibida
 *     (`UNDO_DURATION_LABEL` = "8 segundos") aparece TANTO na descrição do
 *     ConfirmDialog quanto na descrição do toast. Alterar aqui atualiza toda a UI.
 *   - Singular/plural são resolvidos por número, não por sufixo hard-coded.
 *   - `bulkRestoreSummary` continua sendo o SSOT das mensagens de resultado
 *     do restore (sucesso total, parcial, falha total) — reexportado aqui
 *     para deixar a superfície única.
 */
export { bulkRestoreSummary, type BulkRestoreSummary, type BulkRestoreTone } from './bulkRestoreSummary';

/** Duração do toast "Desfazer" em milissegundos. */
export const UNDO_DURATION_MS = 8000;

/** Label humana da duração — usada em copies visíveis ao usuário. */
export const UNDO_DURATION_LABEL = '8 segundos';

/** Descrição padrão do toast "Desfazer" (com tempo consistente). */
export const UNDO_TOAST_DESCRIPTION = `Você pode desfazer por até ${UNDO_DURATION_LABEL}.`;

/**
 * Normaliza um contador vindo da UI: nunca deixa NaN/Infinity/negativo/fracionário
 * vazar para a copy visível. Fallback defensivo = 1 (singular seguro).
 */
function normalizeCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  const n = Math.floor(count);
  return n < 0 ? 0 : n;
}

/** Título do ConfirmDialog destrutivo (singular ou plural). */
export function deleteConfirmDialogTitle(count: number): string {
  const n = normalizeCount(count);
  return n <= 1 ? 'Excluir carrinho?' : `Excluir ${n} carrinhos?`;
}

/** Descrição do ConfirmDialog destrutivo — inclui o tempo de undo. */
export function deleteConfirmDialogDescription(count: number): string {
  const n = normalizeCount(count);
  const prefix = n <= 1 ? 'O carrinho será removido' : 'Os carrinhos serão removidos';
  return `${prefix} — você pode desfazer por até ${UNDO_DURATION_LABEL} após a confirmação.`;
}

/** Título do toast "Desfazer" após DELETE (singular/plural). */
export function deletedToastTitle(count: number): string {
  const n = normalizeCount(count);
  return n <= 1 ? 'Carrinho excluído' : `${n} carrinhos excluídos`;
}

/** Texto do CTA de confirmação (bulk exibe contagem; individual usa label curto). */
export function confirmDialogConfirmLabel(count: number): string {
  const n = normalizeCount(count);
  return n <= 1 ? 'Confirmar exclusão' : `Excluir ${n}`;
}

/** Copy do resultado do restore para o caso individual (1 carrinho). */
export const RESTORE_SINGLE_SUCCESS = 'Carrinho restaurado.';
export const RESTORE_SINGLE_ERROR = 'Não foi possível restaurar o carrinho.';

/** Copy do toast "Item removido" (undo dentro de um carrinho). */
export function itemRemovedToastTitle(itemName: string): string {
  const safe = typeof itemName === 'string' && itemName.trim().length > 0
    ? itemName.trim()
    : 'Item';
  return `${safe} removido`;
}
