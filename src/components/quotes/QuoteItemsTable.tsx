/**
 * QuoteItemsTable — Items table with kit grouping for QuoteViewPage
 *
 * FIX 2026-06-27: Graceful fallback para itens com product_id = NULL.
 * A FK quote_items.product_id -> products.id usa ON DELETE SET NULL, portanto
 * quando um produto é deletado os itens ficam com product_id=NULL mas mantêm
 * product_name/quantity/unit_price. O componente agora exibe um badge
 * "Produto removido do catálogo" nesses casos, evitando confusão visual e
 * prevenindo que o vendedor envie orçamentos com itens fantasma sem perceber.
 * fix_version: quote_items_null_product_graceful_20260627
 */
import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuoteItemDetailSheet } from './QuoteItemDetailSheet';
import { ProductThumb } from './ProductThumb';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { qvSpacing, qvType } from './quote-view-typography';
import { formatEngravingTitle } from '@/lib/customization/format-engraving-title';
import { SectionEyebrow } from './SectionEyebrow';
import { EngravingBadge } from './EngravingBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface QuotePersonalization {
  id?: string;
  technique_name?: string | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  notes?: string | null;
  width_cm?: number | null;
  height_cm?: number | null;
  colors_count?: number | null;
}

export interface QuoteItem {
  id?: string;
  product_id?: string | null;
  product_name: string;
  product_sku?: string | null;
  product_image_url?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
  quantity: number;
  unit_price: number;
  kit_group_id?: string | null;
  kit_name?: string | null;
  price_updated_at?: string | null;
  price_freshness_threshold_days?: number | null;
  notes?: string | null;
  personalizations?: QuotePersonalization[];
}

interface QuoteItemsTableProps {
  items: QuoteItem[];
}

function RemovedProductBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="bg-destructive/8 gap-1 border-destructive/40 text-xs text-destructive"
          >
            <AlertTriangle className="h-3 w-3" />
            Produto removido do catálogo
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">
            Este produto foi removido do catálogo após o orçamento ser criado. Os valores foram
            preservados para referência histórica.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function QuoteItemsTable({ items }: QuoteItemsTableProps) {
  const hasPersonalizations = items.some(
    (item) => item.personalizations && item.personalizations.length > 0,
  );

  const kitGroups = new Map<string, { name: string; items: QuoteItem[] }>();
  const looseItems: QuoteItem[] = [];

  items.forEach((item) => {
    if (item.kit_group_id && item.kit_name) {
      const group = kitGroups.get(item.kit_group_id) || { name: item.kit_name, items: [] };
      group.items.push(item);
      kitGroups.set(item.kit_group_id, group);
    } else {
      looseItems.push(item);
    }
  });

  const colCount = hasPersonalizations ? 6 : 5;
  const headerCellClass = cn(
    qvSpacing.cell,
    'text-[11px] font-semibold uppercase tracking-wide',
    'bg-primary print:bg-primary/15',
    'text-primary-foreground',
  );

  // IDs estáveis para vincular <td headers> ao <th id> entre as duas tabelas
  // (header e corpo). Garante que leitores de tela leiam corretamente
  // "Produto: X / Quantidade: Y" mesmo com thead/tbody em <table>s distintas.
  const tableUid = React.useId();
  const colIds = React.useMemo(
    () => ({
      produto: `${tableUid}-h-produto`,
      pers: `${tableUid}-h-pers`,
      qtd: `${tableUid}-h-qtd`,
      un: `${tableUid}-h-un`,
      total: `${tableUid}-h-total`,
      act: `${tableUid}-h-act`,
    }),
    [tableUid],
  );
  const headersFor = (key: keyof typeof colIds) => colIds[key];

  const renderItemRow = (item: QuoteItem, index: number) => {
    const allPersonalizations = item.personalizations || [];
    const personalizationCost = allPersonalizations.reduce(
      (acc: number, p: QuotePersonalization) => acc + (p.total_cost ?? 0),
      0,
    );
    const itemTotal = round2(item.quantity * item.unit_price + personalizationCost);
    // FIX: product_id == null indica produto removido (FK ON DELETE SET NULL)
    // fix_version: quote_items_null_product_graceful_20260627
    const isProductRemoved = item.product_id === null || item.product_id === undefined;

    return (
      <tr
        key={item.id || `item-${index}`}
        className={cn(
          'border-b border-border/50 transition-colors hover:bg-muted/40',
          index % 2 === 1 && 'bg-muted/20',
          isProductRemoved && 'hover:bg-destructive/8 bg-destructive/5',
        )}
      >
        <td headers={headersFor('produto')} className={qvSpacing.cell}>
          <div className="flex items-start gap-3">
            <ProductThumb
              src={item.product_image_url}
              alt=""
              size="row"
              roundedClassName="rounded"
              className="print:hidden"
              errorMode={isProductRemoved && !item.product_image_url}
              data-testid={
                isProductRemoved && !item.product_image_url
                  ? 'quote-item-thumb-removed'
                  : 'quote-item-thumb'
              }
            />
            <div className="min-w-0">
              {item.product_sku && (
                <span
                  data-testid="quote-item-sku-badge"
                  data-sku={item.product_sku}
                  className="mb-1 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground"
                >
                  {item.color_hex && (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full border border-border/60"
                      style={{ backgroundColor: item.color_hex }}
                    />
                  )}
                  {item.product_sku}
                </span>
              )}

              <p className={cn(qvType.productName, isProductRemoved && 'text-muted-foreground')}>
                {item.product_name}
              </p>
              {isProductRemoved && (
                <div className="mt-1">
                  <RemovedProductBadge />
                </div>
              )}
            </div>
          </div>
        </td>

        {hasPersonalizations && (
          <td headers={headersFor('pers')} className={qvSpacing.cell}>
            {allPersonalizations.length > 0 ? (
              <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                {allPersonalizations.map((p, pIdx) => {
                  const notesRaw = p.notes || '';
                  const [locationPart, dimPart] = notesRaw.split(' | ');
                  const locationLabel = locationPart ? locationPart.split(' — ')[0] : null;
                  let dimLabel: string | null = null;
                  if (dimPart) {
                    dimLabel = dimPart.replace('cm', ' cm');
                  } else if (p.width_cm && p.height_cm) {
                    dimLabel = `${p.width_cm} × ${p.height_cm} cm`;
                  }
                  const colorsCount = p.colors_count || 1;
                  const meta = [
                    locationLabel,
                    dimLabel,
                    `${colorsCount} cor${colorsCount > 1 ? 'es' : ''}`,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  const displayName = formatEngravingTitle({
                    nomeTabela: p.technique_name,
                    fallback: 'Gravação',
                  });
                  return <EngravingBadge key={pIdx} title={displayName} meta={meta} />;
                })}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </td>
        )}
        <td
          headers={headersFor('qtd')}
          className={cn('w-16 text-center', qvSpacing.cell, qvType.qty)}
        >
          {item.quantity}
        </td>
        <td
          headers={headersFor('un')}
          className={cn('w-24 text-left', qvSpacing.cell, qvType.unitPrice)}
        >
          <div className="flex flex-col gap-0.5">
            <span>
              {formatCurrency(
                item.unit_price +
                  allPersonalizations.reduce((sum: number, p: QuotePersonalization) => {
                    const pTotal = p.total_cost ?? 0;
                    return (
                      sum +
                      (item.quantity > 0 ? Math.round((pTotal / item.quantity) * 100) / 100 : 0)
                    );
                  }, 0),
              )}
            </span>
            {!isProductRemoved && (
              <PriceFreshnessBadge
                priceUpdatedAt={item.price_updated_at}
                thresholdDays={item.price_freshness_threshold_days}
                variant="compact"
              />
            )}
          </div>
        </td>
        <td
          headers={headersFor('total')}
          className={cn('w-28 text-left', qvSpacing.cell, qvType.rowTotal)}
        >
          {formatCurrency(itemTotal)}
        </td>
        <td headers={headersFor('act')} className={cn('text-center print:hidden', qvSpacing.cell)}>
          <QuoteItemDetailSheet
            item={{
              product_name: item.product_name,
              product_sku: item.product_sku ?? undefined,
              product_image_url: item.product_image_url ?? undefined,
              color_name: item.color_name ?? undefined,
              color_hex: item.color_hex ?? undefined,
              quantity: item.quantity,
              unit_price: item.unit_price,
              notes: typeof item.notes === 'string' ? item.notes : undefined,
              personalizations: item.personalizations?.map((p) => ({
                ...p,
                technique_name: p.technique_name ?? undefined,
                unit_cost: p.unit_cost ?? undefined,
                total_cost: p.total_cost ?? undefined,
                notes: p.notes ?? undefined,
                width_cm: p.width_cm ?? undefined,
                height_cm: p.height_cm ?? undefined,
                colors_count: p.colors_count ?? undefined,
              })),
            }}
          />
        </td>
      </tr>
    );
  };

  // Scroll interno: mantém ~5 produtos visíveis sem aumentar a página.
  // Acima de 5 itens, ativa overflow vertical no container da tabela com
  // thead sticky para preservar contexto. Limites responsivos por breakpoint
  // calculados em rem (escalam com root font-size) para evitar cortes de linha
  // e manter ~5 produtos visíveis em sm/md/lg.
  const totalRows = items.length;
  const enableInnerScroll = totalRows > 5;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = React.useState<{
    top: boolean;
    bottom: boolean;
    progress: number;
  }>({ top: true, bottom: !enableInnerScroll, progress: 0 });
  const [announcement, setAnnouncement] = React.useState('');
  const announceTimer = React.useRef<number | null>(null);
  const theadRef = React.useRef<HTMLTableSectionElement>(null);
  const [scrollbarPad, setScrollbarPad] = React.useState<number>(0);

  React.useEffect(() => {
    if (!enableInnerScroll) return;
    const el = theadRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enableInnerScroll]);

  // Mede a largura real da scrollbar vertical do body para reservar
  // padding-right equivalente no header — garante alinhamento das colunas.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const pad = Math.max(0, el.offsetWidth - el.clientWidth);
      setScrollbarPad(pad);
      // Telemetria opcional: ative com `window.__DEBUG_QUOTE_TABLE = true`
      // em ambientes com scrollbar overlay (macOS Safari/iOS) ou bugs de alinhamento.
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { __DEBUG_QUOTE_TABLE?: boolean }).__DEBUG_QUOTE_TABLE
      ) {
        // eslint-disable-next-line no-console
        console.debug('[QuoteItemsTable] scrollbarPad', {
          pad,
          offsetWidth: el.offsetWidth,
          clientWidth: el.clientWidth,
          totalRows,
          enableInnerScroll,
        });
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enableInnerScroll, totalRows]);

  React.useEffect(() => {
    if (!enableInnerScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      const progress = max > 0 ? Math.round((el.scrollTop / max) * 100) : 100;
      setScrollState({ top: atTop, bottom: atBottom, progress });
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [enableInnerScroll, totalRows]);

  // Anuncia transições de fim/início de rolagem para leitores de tela.
  React.useEffect(() => {
    if (!enableInnerScroll) return;
    const msg = scrollState.bottom
      ? 'Fim da lista de itens.'
      : scrollState.top
        ? `Início da lista. ${totalRows} itens disponíveis. Use as setas para rolar.`
        : `Rolando, ${scrollState.progress}% da lista.`;
    if (announceTimer.current) window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(msg), 150);
    return () => {
      if (announceTimer.current) window.clearTimeout(announceTimer.current);
    };
  }, [enableInnerScroll, scrollState.top, scrollState.bottom, scrollState.progress, totalRows]);

  const onScrollerKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!enableInnerScroll) return;
      const el = scrollRef.current;
      if (!el) return;
      // Não interferir quando o foco está num controle interativo dentro da tabela.
      const target = e.target as HTMLElement;
      if (target !== el && target.closest('button,a,input,select,textarea,[role="button"]')) {
        return;
      }
      const line = 88; // altura aproximada de uma linha
      const page = el.clientHeight - line;
      let delta = 0;
      switch (e.key) {
        case 'ArrowDown':
          delta = line;
          break;
        case 'ArrowUp':
          delta = -line;
          break;
        case 'PageDown':
        case ' ':
          delta = page;
          break;
        case 'PageUp':
          delta = -page;
          break;
        case 'Home':
          el.scrollTo({ top: 0, behavior: 'smooth' });
          e.preventDefault();
          return;
        case 'End':
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          e.preventDefault();
          return;
        default:
          return;
      }
      e.preventDefault();
      el.scrollBy({ top: delta, behavior: 'smooth' });
    },
    [enableInnerScroll],
  );

  const ColGroup = () => (
    <colgroup>
      <col style={{ width: 'clamp(180px, 26%, 280px)' }} />
      {hasPersonalizations && <col />}
      <col style={{ width: '3.5rem' }} />
      <col style={{ width: '5.5rem' }} />
      <col style={{ width: '6.5rem' }} />
      <col style={{ width: '6rem' }} className="print:hidden" />
    </colgroup>
  );

  return (
    <section aria-labelledby="quote-items-heading">
      <SectionEyebrow id="quote-items-heading">Itens do Orçamento</SectionEyebrow>
      <div className="relative">
        <div
          className="relative overflow-hidden rounded-lg bg-background"
          data-testid="quote-items-table-wrapper"
        >
          {/* Header fixo — fora da área de scroll, com padding-right igual
              à largura real da scrollbar do body para alinhar colunas. */}
          <div
            className="overflow-hidden print:overflow-visible"
            style={{ paddingRight: scrollbarPad ? `${scrollbarPad}px` : undefined }}
            data-testid="quote-items-table-header-wrap"
            data-scrollbar-pad={scrollbarPad}
          >
            <table
              aria-label="Cabeçalho da tabela de itens do orçamento"
              className="w-full table-fixed border-separate border-spacing-0"
            >
              <ColGroup />
              <thead ref={theadRef}>
                <tr>
                  <th
                    id={colIds.produto}
                    scope="col"
                    className={cn('rounded-tl-lg text-left', headerCellClass)}
                  >
                    Produto
                  </th>
                  {hasPersonalizations && (
                    <th id={colIds.pers} scope="col" className={cn('text-left', headerCellClass)}>
                      Personalização
                    </th>
                  )}
                  <th id={colIds.qtd} scope="col" className={cn('text-center', headerCellClass)}>
                    Qtd
                  </th>
                  <th id={colIds.un} scope="col" className={cn('text-left', headerCellClass)}>
                    Unitário
                  </th>
                  <th id={colIds.total} scope="col" className={cn('text-left', headerCellClass)}>
                    Total
                  </th>
                  <th
                    id={colIds.act}
                    scope="col"
                    aria-label="Ações"
                    className={cn('rounded-tr-lg text-center print:hidden', headerCellClass)}
                  />
                </tr>
              </thead>
            </table>
          </div>

          {/* Corpo rolável — scroll começa abaixo do header */}
          <div
            ref={scrollRef}
            onKeyDown={onScrollerKeyDown}
            className={cn(
              'overflow-x-hidden',
              enableInnerScroll && [
                'overflow-y-auto',
                'max-h-[30.25rem] md:max-h-[32.5rem] lg:max-h-[34rem]',
                'print:max-h-none print:overflow-visible',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              ],
            )}
            data-testid="quote-items-table-scroll"
            data-inner-scroll={enableInnerScroll ? 'true' : 'false'}
            data-scroll-at-top={scrollState.top ? 'true' : 'false'}
            data-scroll-at-bottom={scrollState.bottom ? 'true' : 'false'}
            data-scroll-progress={enableInnerScroll ? String(scrollState.progress) : '0'}
            {...(enableInnerScroll && {
              tabIndex: 0,
              role: 'region',
              'aria-label': `Lista rolável de ${totalRows} itens do orçamento. Use setas, PageUp/PageDown, Home e End para navegar.`,
              'aria-describedby': 'quote-items-scroll-help',
            })}
          >
            <table
              aria-label={`Lista de ${totalRows} itens do orçamento`}
              className="w-full table-fixed border-separate border-spacing-0"
            >
              <ColGroup />
              <tbody>
                {Array.from(kitGroups.entries()).map(([groupId, group]) => (
                  <React.Fragment key={groupId}>
                    <tr className="border-b border-border bg-accent/60">
                      <td colSpan={colCount} className="p-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-primary">Kit: {group.name}</span>
                          <Badge variant="outline" className="ml-1 text-xs">
                            {group.items.length} itens
                          </Badge>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((item, idx) => renderItemRow(item, idx))}
                  </React.Fragment>
                ))}
                {kitGroups.size > 0 && looseItems.length > 0 && (
                  <tr className="border-b border-border bg-muted/30">
                    <td colSpan={colCount} className="p-2 px-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Itens Avulsos
                      </span>
                    </td>
                  </tr>
                )}
                {looseItems.map((item, idx) => renderItemRow(item, idx))}
              </tbody>
            </table>
          </div>
        </div>
        {enableInnerScroll && !scrollState.bottom && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-lg bg-gradient-to-t from-background to-transparent print:hidden"
          />
        )}

        {enableInnerScroll && (
          <>
            <span id="quote-items-scroll-help" className="sr-only">
              Pressione setas para cima e para baixo para rolar uma linha, PageUp e PageDown para
              uma página, Home para o início e End para o fim.
            </span>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
