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

/** Título do ConfirmDialog destrutivo (singular ou plural). */
export function deleteConfirmDialogTitle(count: number): string {
  return count <= 1 ? 'Excluir carrinho?' : `Excluir ${count} carrinhos?`;
}

/** Descrição do ConfirmDialog destrutivo — inclui o tempo de undo. */
export function deleteConfirmDialogDescription(count: number): string {
  const prefix =
    count <= 1
      ? 'O carrinho será removido'
      : 'Os carrinhos serão removidos';
  return `${prefix} — você pode desfazer por até ${UNDO_DURATION_LABEL} após a confirmação.`;
}

/** Título do toast "Desfazer" após DELETE (singular/plural). */
export function deletedToastTitle(count: number): string {
  return count <= 1 ? 'Carrinho excluído' : `${count} carrinhos excluídos`;
}

/** Texto do CTA de confirmação (bulk exibe contagem; individual usa label curto). */
export function confirmDialogConfirmLabel(count: number): string {
  return count <= 1 ? 'Confirmar exclusão' : `Excluir ${count}`;
}

/** Copy do resultado do restore para o caso individual (1 carrinho). */
export const RESTORE_SINGLE_SUCCESS = 'Carrinho restaurado.';
export const RESTORE_SINGLE_ERROR = 'Não foi possível restaurar o carrinho.';

/** Copy do toast "Item removido" (undo dentro de um carrinho). */
export function itemRemovedToastTitle(itemName: string): string {
  return `${itemName} removido`;
}
