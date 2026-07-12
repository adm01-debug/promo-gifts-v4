/**
 * bulkRestoreSummary — copy do toast após tentativa de restaurar em lote.
 *
 * Encapsula, como função pura, a regra de mensagem exibida ao usuário após um
 * "Desfazer" de exclusão em lote de carrinhos. Extraído de `CartsListPage.confirmBulkDelete`
 * para permitir cobertura de teste isolada (feliz + falha parcial + falha total).
 */
export type BulkRestoreTone = 'success' | 'warning' | 'error';

export interface BulkRestoreSummary {
  tone: BulkRestoreTone;
  message: string;
}

/**
 * @param attempted quantidade de carrinhos que a restauração tentou recriar
 *                  (equivalente ao número de DELETEs bem-sucedidos originais).
 * @param restored  quantidade efetivamente restaurada (INSERT ok).
 */
export function bulkRestoreSummary(attempted: number, restored: number): BulkRestoreSummary {
  const failed = Math.max(0, attempted - restored);
  const isSingular = attempted === 1;

  if (restored === attempted && attempted > 0) {
    return {
      tone: 'success',
      message: restored === 1 ? 'Carrinho restaurado.' : `${restored} carrinhos restaurados.`,
    };
  }
  if (restored > 0) {
    return {
      tone: 'warning',
      message: `${restored} restaurado(s), ${failed} falhou(aram).`,
    };
  }
  return {
    tone: 'error',
    message: isSingular
      ? 'Não foi possível restaurar o carrinho.'
      : 'Não foi possível restaurar os carrinhos.',
  };
}
