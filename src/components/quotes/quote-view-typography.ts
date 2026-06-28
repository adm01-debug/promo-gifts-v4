/**
 * Quote View Typography — SSOT de escala tipográfica e espaçamento.
 *
 * Centraliza variants usadas em QuoteClientInfo, QuoteItemsTable,
 * QuoteTotalsSummary e na seção "Condições Comerciais" do QuoteViewPage,
 * garantindo consistência editorial (eyebrow tracking, body, totais) e
 * facilitando ajustes globais futuros sem caçar classes pelo código.
 *
 * Regras:
 * - Todos os tokens são classes Tailwind compostas — não emitem CSS novo.
 * - Cores SEMPRE via tokens semânticos (foreground/muted-foreground/primary),
 *   sem `text-muted-foreground/<n>` ou cores hardcoded — preserva contraste
 *   WCAG AA em light/dark.
 * - Densidade padrão para visualização do orçamento (mais "clean" que o
 *   builder); responsividade nas tabelas é feita no componente via
 *   `overflow-x-auto` no wrapper.
 */

export const qvType = {
  /** Microlabel editorial em caixa-alta com tracking amplo. */
  eyebrow:
    'font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground',
  /** Eyebrow ainda mais compacto para cards de Condições Comerciais. */
  eyebrowCard:
    'text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground',
  /** Título de bloco — nome de cliente, nome de contato. */
  blockTitle: 'text-sm font-semibold text-foreground',
  /** Corpo metadados (cidade/UF, e-mail, telefone, CNPJ). */
  meta: 'text-xs text-muted-foreground',
  /** Linha do resumo (subtotal, desconto, frete) — numerais tabulares. */
  summaryRow: 'text-xs tabular-nums',
  /** Rótulo do Total na faixa final do resumo. */
  totalLabel: 'text-sm font-semibold text-foreground',
  /** Valor do Total — destaque controlado, sem ostentação. */
  totalValue:
    'font-display text-lg font-semibold tabular-nums text-primary',
  /** Cabeçalho da tabela de itens. */
  tableHead:
    'text-[11px] font-semibold uppercase tracking-wide text-primary',
  /** Nome do produto na célula. */
  productName: 'text-[13px] font-medium leading-snug text-foreground',
  /** Quantidade — coluna estreita centralizada. */
  qty: 'text-xs font-semibold tabular-nums',
  /** Preço unitário — numerais tabulares, peso normal. */
  unitPrice: 'text-xs tabular-nums text-muted-foreground',
  /** Total da linha — leve destaque vs. unitário. */
  rowTotal: 'text-sm font-semibold tabular-nums text-foreground',
  /** Conteúdo de card pequeno (Condições Comerciais). */
  cardValue: 'text-xs font-medium text-foreground',
  /** Título do SheetTitle "Detalhes do Item". */
  sheetTitle: 'text-sm font-semibold tracking-tight text-foreground',
  /** Eyebrow das seções do sheet (Preços / Personalização / Observações). */
  sheetSection:
    'text-[11px] font-semibold uppercase tracking-wider text-foreground',
  /** Linha de dado dentro do sheet (label/valor). */
  sheetRow: 'text-xs tabular-nums',
  /** Microlabel (faixa, sub-rótulos de coluna). */
  microLabel: 'text-[10px] uppercase tracking-wide text-muted-foreground',
  /** Linha de metadados em grade no card de personalização. */
  techGridItem: 'text-[11px]',
} as const;


export const qvSpacing = {
  /** Padding padrão de células da tabela. */
  cell: 'p-2.5',
  /** Padding interno de cards de Condições Comerciais. */
  card: 'p-2.5',
  /** Padding do corpo do summary card. */
  summaryBody: 'px-3.5 py-3',
  /** Padding da faixa final do Total. */
  summaryTotalBar: 'px-3.5 py-2.5',
  /** Gap padrão do grid Empresa/Contato. */
  clientGrid: 'gap-5 md:gap-6',
  /** Gap do grid de Condições Comerciais. */
  termsGrid: 'gap-3',
  /** Ritmo vertical entre blocos do conteúdo do orçamento. */
  sectionStack: 'space-y-3 md:space-y-4',
  /** Espaço entre eyebrow de seção e o conteúdo logo abaixo. */
  eyebrowGap: 'mb-1',
  /** Ritmo vertical entre seções dentro do SheetContent. */
  sheetStack: 'mt-5 space-y-5',
  /** Padding interno do card de personalização. */
  techCard: 'space-y-2 rounded-lg border border-border/50 bg-muted/40 p-2.5',
} as const;


export type QvTypeKey = keyof typeof qvType;
export type QvSpacingKey = keyof typeof qvSpacing;
