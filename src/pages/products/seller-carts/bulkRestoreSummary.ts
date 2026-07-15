/**
 * bulkRestoreSummary — copy do toast após tentativa de restaurar em lote.
 *
 * Encapsula, como função pura, a regra de mensagem exibida ao usuário após um
 * "Desfazer" de exclusão em lote de carrinhos. Extraído de `CartsListPage.confirmBulkDelete`
 * para permitir cobertura de teste isolada (feliz + falha parcial + falha total).
 */
export type BulkRestoreTone = 'error' | 'success' | 'warning';

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
  // Normalização defensiva: NaN/Infinity/negativo/fracionário nunca chegam à UI.
  const norm = (v: number) => {
    if (!Number.isFinite(v)) return 0;
    const n = Math.floor(v);
    return n < 0 ? 0 : n;
  };
  const a = norm(attempted);
  // `restored` é logicamente limitado por `attempted` — clamp para evitar
  // mensagens como "3 restaurados, -1 falhou" caso um caller reporte errado.
  const r = Math.min(norm(restored), a);
  const failed = a - r;
  const isSingular = a === 1;

  if (r === a && a > 0) {
    return {
      tone: 'success',
      message: r === 1 ? 'Carrinho restaurado.' : `${r} carrinhos restaurados.`,
    };
  }
  if (r > 0) {
    return {
      tone: 'warning',
      message: `${r} restaurado(s), ${failed} falhou(aram).`,
    };
  }
  return {
    tone: 'error',
    message: isSingular
      ? 'Não foi possível restaurar o carrinho.'
      : 'Não foi possível restaurar os carrinhos.',
  };
}
