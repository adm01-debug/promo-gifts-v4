/**
 * Helpers compartilhados do Comparador de Produtos.
 *
 * Lead time é derivado do stockStatus (fonte única), usado pelo score, radar,
 * tabela e modo duelo — assim todos concordam. Menor é melhor.
 */

/** Proxy numérico de lead time a partir do stockStatus (in-stock=1, low=2, out=4). */
export function leadTimeProxy(status: string | null | undefined): number {
  switch (status) {
    case 'in-stock':
      return 1;
    case 'low-stock':
      return 2;
    case 'out-of-stock':
      return 4;
    default:
      return 2;
  }
}

/** Rótulo legível de lead time a partir do stockStatus. */
export function leadTimeLabel(status: string | null | undefined): string {
  switch (status) {
    case 'in-stock':
      return '1-3 dias';
    case 'low-stock':
      return '5-10 dias';
    case 'out-of-stock':
      return 'Sob consulta';
    default:
      return '—';
  }
}
