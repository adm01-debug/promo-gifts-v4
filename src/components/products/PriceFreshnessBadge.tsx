/**
 * PriceFreshnessBadge
 *
 * Visual indicator showing when the supplier last updated this product's price.
 * Three variants:
 *  - `inline`: full text + icon (PDP, Quick View)
 *  - `compact`: shortened "há Nd" (sticky header, quote builder line)
 *  - `icon-only`: icon w/ aria-label (catalog cards, table)
 *
 * In `compact` and `icon-only` variants, the badge only renders for
 * `aging`/`stale` statuses to avoid noise on freshly-updated products.
 */
import { AlertTriangle, Clock, CheckCircle2, HelpCircle, ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  getPriceFreshness,
  formatPriceDateLong,
  formatPriceDateShort,
  type PriceFreshnessStatus,
  type PriceFreshness,
} from '@/utils/price-freshness';

const STATUS_LABELS: Record<PriceFreshnessStatus, string> = {
  fresh: 'Atualizado',
  aging: 'Próximo do limite',
  stale: 'Possivelmente defasado',
  unknown: 'Sem informação',
};

/**
 * Aria-label rico para leitores de tela. O label do util é otimizado para
 * UI ("Atualizado há 5 dias"), mas em `icon-only`/`compact` o leitor de
 * tela não tem o contexto visual do "$ 19,90" ao lado — precisa ouvir
 * **Preço** + status legível + data por extenso quando disponível. Para
 * contexto mais rico do que aria-label sozinho consegue, complementamos
 * com `title` (lido por SRs como descrição auxiliar e útil offline).
 */
function buildAccessibleLabel(
  freshness: PriceFreshness,
  priceUpdatedAt?: string | Date | null,
): { ariaLabel: string; title: string } {
  const dateValue = priceUpdatedAt
    ? priceUpdatedAt instanceof Date
      ? priceUpdatedAt
      : new Date(priceUpdatedAt)
    : null;
  const isValid = dateValue && !Number.isNaN(dateValue.getTime());
  const longDate = isValid ? formatPriceDateLong(dateValue) : null;
  const days = freshness.daysSinceUpdate;
  const relative =
    days === null ? null : days <= 0 ? 'hoje' : days === 1 ? 'há 1 dia' : `há ${days} dias`;

  // Frase principal lida pelo screen reader (curta e direta).
  let ariaLabel: string;
  switch (freshness.status) {
    case 'fresh':
      ariaLabel = longDate
        ? `Preço atualizado pelo fornecedor em ${longDate}, ${relative}.`
        : 'Preço atualizado pelo fornecedor recentemente.';
      break;
    case 'aging':
      ariaLabel = longDate
        ? `Preço próximo do limite de validade. Última atualização do fornecedor em ${longDate}, ${relative}. Recomendamos confirmar antes de fechar o orçamento.`
        : 'Preço próximo do limite de validade. Recomendamos confirmar com o fornecedor.';
      break;
    case 'stale':
      ariaLabel = longDate
        ? `Atenção: preço possivelmente defasado. Última atualização do fornecedor em ${longDate}, ${relative}. Confirme o valor antes de enviar o orçamento ao cliente.`
        : 'Atenção: preço possivelmente defasado. Confirme com o fornecedor antes de enviar o orçamento.';
      break;
    case 'unknown':
    default: {
      // Diferencia entre data ausente e data inválida (ambas caem em
      // `unknown` na utility, mas o `freshness.label` carrega a causa).
      const isInvalid = /inválida/i.test(freshness.label);
      ariaLabel = isInvalid
        ? 'Preço com data de atualização inválida informada pelo fornecedor. Confirme o valor antes de enviar o orçamento.'
        : 'Preço com data de atualização não informada pelo fornecedor. Confirme o valor antes de enviar o orçamento.';
    }
  }

  // `title` espelha o aria-label para que o tooltip nativo do navegador
  // funcione mesmo quando o Radix Tooltip não estiver disponível (ex.: foco
  // por teclado em browsers sem suporte a hover).
  return { ariaLabel, title: ariaLabel };
}

/** Data + hora exatas no fuso local do usuário (PT-BR). Ex.: "24/04/2026 09:32". */
function formatExactDateTime(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function buildClassificationRule(thresholdDays: number): string {
  const half = Math.floor(thresholdDays / 2);
  return `Regra: até ${half} dias = atualizado · ${half + 1}–${thresholdDays} dias = próximo do limite · acima de ${thresholdDays} dias = possivelmente defasado.`;
}

interface FreshnessTooltipProps {
  freshness: PriceFreshness;
  priceUpdatedAt?: string | Date | null;
}

function FreshnessTooltipBody({ freshness, priceUpdatedAt }: FreshnessTooltipProps) {
  const dateValue = priceUpdatedAt
    ? priceUpdatedAt instanceof Date
      ? priceUpdatedAt
      : new Date(priceUpdatedAt)
    : null;
  const isValidDate = dateValue && !Number.isNaN(dateValue.getTime());
  // Padrão único pt-BR: "em DD/MM/AAAA". A hora local e a forma por extenso
  // ficam como detalhamento auxiliar, sem repetir a data curta.
  const shortDate = isValidDate ? formatPriceDateShort(dateValue) : null;
  const longDate = isValidDate ? formatPriceDateLong(dateValue) : null;
  const exactDateTime = isValidDate ? formatExactDateTime(dateValue) : null;
  const statusLabel = STATUS_LABELS[freshness.status];
  const rule = buildClassificationRule(freshness.thresholdDays);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold">{statusLabel}</span>
        {freshness.status !== 'unknown' && (
          <span className="text-muted-foreground">
            ·{' '}
            {freshness.label
              .replace(/^Atualizado\s+/i, '')
              .replace(/^Preço pode estar defasado\s*/i, '')}
          </span>
        )}
      </div>
      {shortDate && (
        <div className="leading-snug">
          <span className="text-muted-foreground">Atualizado</span>{' '}
          <span className="font-medium tabular-nums">em {shortDate}</span>
          {longDate && <span className="text-muted-foreground"> ({longDate})</span>}
        </div>
      )}
      {!shortDate && (
        <div className="leading-snug text-muted-foreground">
          O fornecedor não informou a data da última atualização deste preço.
        </div>
      )}
      <div className="leading-snug text-muted-foreground">{rule}</div>
      {freshness.status === 'stale' && (
        <div className="leading-snug text-amber-600 dark:text-amber-400">
          Confirme o valor com o fornecedor antes de enviar o orçamento ao cliente.
        </div>
      )}
      {freshness.status === 'aging' && (
        <div className="leading-snug text-muted-foreground">
          Recomendamos confirmar o valor antes de fechar o orçamento.
        </div>
      )}
    </div>
  );
}

export interface PriceFreshnessBadgeProps {
  priceUpdatedAt?: string | Date | null;
  thresholdDays?: number | null;
  variant?: 'inline' | 'compact' | 'icon-only' | 'pdp';
  className?: string;
  /** Force render even when status is `fresh`/`unknown` in compact/icon-only variants. */
  alwaysShow?: boolean;
  /**
   * Quando informado, o badge passa a expor a ação "Confirmei com fornecedor"
   * para itens aging/stale ainda não confirmados. Após o clique, o consumidor
   * deve atualizar `confirmedAt` para que o badge entre no estado "confirmado".
   * Sem esta prop o badge continua somente leitura (catálogo/PDP padrão).
   */
  onConfirm?: () => void;
  /**
   * ISO timestamp do momento em que o vendedor confirmou o preço com o
   * fornecedor neste contexto (ex.: orçamento). Quando preenchido, o alerta
   * stale/aging é substituído por um pill verde "Confirmado por você".
   */
  confirmedAt?: string | Date | null;
}

function formatConfirmedRelative(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'agora';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return formatPriceDateLong(d);
}

/**
 * Threshold é "explícito" quando vem do produto (não é o default global).
 * Só nesse caso enriquecemos o badge com "(limite Yd)" — caso contrário
 * o sufixo poluiria a UI de >99% do catálogo que ainda não tem o campo.
 */
function hasExplicitThreshold(thresholdDays?: number | null): thresholdDays is number {
  return typeof thresholdDays === 'number' && thresholdDays > 0;
}

const STATUS_STYLES: Record<PriceFreshnessStatus, { color: string; Icon: typeof Clock }> = {
  // amber-700 garante contraste ≥ 4.5:1 (WCAG AA) sobre fundos claros e
  // ≥ 4.6:1 com amber-300 no dark mode — necessário para aging/stale que
  // sempre carregam um ícone de alerta junto ao preço.
  fresh: { color: 'text-emerald-700 dark:text-emerald-400', Icon: CheckCircle2 },
  aging: { color: 'text-amber-700 dark:text-amber-300', Icon: Clock },
  stale: { color: 'text-amber-700 dark:text-amber-300', Icon: AlertTriangle },
  unknown: { color: 'text-muted-foreground', Icon: HelpCircle },
};

function formatCompactRelative(days: number | null): string {
  if (days === null) return '—';
  if (days <= 0) return 'hoje';
  if (days < 30) return `há ${days}d`;
  if (days < 365) return `há ${Math.floor(days / 30)}m`;
  return `há ${Math.floor(days / 365)}a`;
}

/**
 * Padrão único pt-BR para a data absoluta exibida no corpo do badge:
 * "DD/MM/AAAA". Usado em todas as variantes (inline, compact, pdp) para
 * garantir consistência entre cards, lista e tabela. A data por extenso
 * + hora local fica reservada ao tooltip (camada de detalhamento).
 */
function formatAbsoluteDate(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return formatPriceDateShort(d);
}

function formatRelativeDaysShort(days: number | null): string {
  if (days === null) return '';
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

export function PriceFreshnessBadge({
  priceUpdatedAt,
  thresholdDays,
  variant = 'inline',
  className,
  alwaysShow = false,
  onConfirm,
  confirmedAt,
}: PriceFreshnessBadgeProps) {
  const freshness = getPriceFreshness(priceUpdatedAt, thresholdDays);
  const { Icon, color } = STATUS_STYLES[freshness.status];

  // Sufixo "(limite Yd)" só aparece quando o produto traz threshold próprio.
  // Para o resto do catálogo (default global de 60d) o badge segue limpo.
  const explicitThreshold = hasExplicitThreshold(thresholdDays);
  const limitSuffix = explicitThreshold ? ` (limite ${thresholdDays}d)` : '';

  // Estado "confirmado pelo vendedor" — substitui o alerta stale/aging por um
  // pill verde discreto. Só faz sentido quando o item realmente entrava em
  // alerta; para `fresh`/`unknown` ignoramos (não polui o catálogo padrão).
  const isConfirmed = Boolean(confirmedAt) && freshness.shouldWarn;
  const canOfferConfirm = typeof onConfirm === 'function' && freshness.shouldWarn && !isConfirmed;

  // Quiet variants only render when there's something worth flagging.
  if (!alwaysShow && (variant === 'compact' || variant === 'icon-only') && !freshness.shouldWarn) {
    return null;
  }

  // Estado "confirmado pelo vendedor" — pill verde discreto que substitui o
  // alerta. Mantém o tooltip (mostra data SSOT + regra) para auditoria.
  if (isConfirmed) {
    const confirmedLabel = `Preço confirmado por você ${formatConfirmedRelative(confirmedAt as string | Date)}`;
    const confirmedBody =
      variant === 'icon-only' ? (
        <span
          role="status"
          aria-label={confirmedLabel}
          className={cn(
            'inline-flex items-center justify-center text-emerald-600 dark:text-emerald-500',
            className,
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ) : variant === 'compact' ? (
        <span
          role="status"
          aria-label={confirmedLabel}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-500',
            className,
          )}
        >
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          <span>Confirmado</span>
        </span>
      ) : (
        <span
          role="status"
          aria-label={confirmedLabel}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400',
            className,
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Confirmado com fornecedor</span>
        </span>
      );
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{confirmedBody}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold">Preço confirmado com fornecedor</div>
              <div className="leading-snug text-muted-foreground">
                Você validou este preço {formatConfirmedRelative(confirmedAt as string | Date)}. O
                alerta de preço defasado fica suprimido neste contexto até o próximo recálculo.
              </div>
              <FreshnessTooltipBody freshness={freshness} priceUpdatedAt={priceUpdatedAt} />
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const { ariaLabel } = buildAccessibleLabel(freshness, priceUpdatedAt);

  // Anel de foco visível padronizado para os triggers compactos. Usa o token
  // `--ring` para herdar a cor do tema (light/dark/skins) e respeitar o
  // contraste configurado pelo design system.
  const focusRing =
    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm';

  let body: React.ReactNode;
  if (variant === 'icon-only') {
    body = (
      <span
        role="status"
        aria-label={ariaLabel}
        tabIndex={0}
        className={cn('inline-flex items-center justify-center', color, focusRing, className)}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  } else if (variant === 'compact') {
    // `compact` é usado em listas densas (ProductListItem). Mostra o
    // relativo curto ("há 12d") + a data numérica pt-BR como sufixo
    // discreto para que o vendedor consiga conferir sem abrir o tooltip.
    const compactDate = priceUpdatedAt ? formatAbsoluteDate(priceUpdatedAt) : null;
    body = (
      <span
        role="status"
        aria-label={ariaLabel}
        tabIndex={0}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium',
          color,
          focusRing,
          className,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">
          {formatCompactRelative(freshness.daysSinceUpdate)}
          {compactDate && <span className="text-muted-foreground"> · em {compactDate}</span>}
          {limitSuffix && <span className="text-muted-foreground">{limitSuffix}</span>}
        </span>
      </span>
    );
  } else if (variant === 'pdp') {
    const absolute = priceUpdatedAt ? formatAbsoluteDate(priceUpdatedAt) : null;
    const relative = formatRelativeDaysShort(freshness.daysSinceUpdate);

    if (freshness.status === 'stale') {
      // Versão suavizada: pill discreto (mesmo footprint visual do `aging`),
      // mantendo a cor de aviso âmbar mas sem o bloco cheio que competia
      // com o preço. Detalhes (data + recomendação) migram para o tooltip.
      body = (
        <span
          role="status"
          aria-label={ariaLabel}
          tabIndex={0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
            focusRing,
            className,
          )}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            Preço pode estar defasado
            {absolute && (
              <span className="text-muted-foreground"> · {relative}</span>
            )}
          </span>
        </span>
      );
    } else if (freshness.status === 'aging' && absolute) {
      body = (
        <span
          role="status"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
            className,
          )}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            Atualizado em {absolute}
            <span className="text-amber-700/70 dark:text-amber-300/70"> · {relative}</span>
            {limitSuffix}
          </span>
        </span>
      );
    } else if (freshness.status === 'fresh' && absolute) {
      body = (
        <span
          role="status"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400',
            className,
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            Atualizado em {absolute}
            <span className="text-emerald-700/70 dark:text-emerald-400/70"> · {relative}</span>
            {limitSuffix}
          </span>
        </span>
      );
    } else {
      // unknown / invalid date
      body = (
        <span
          role="status"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground',
            className,
          )}
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Data de atualização não informada</span>
        </span>
      );
    }
  } else {
    // `inline` (default) — usado em PDP/Quick View. Mantém o label do util
    // ("Atualizado há N dias" / "Preço pode estar defasado (há N dias)") e
    // anexa a data numérica pt-BR no padrão "em DD/MM/AAAA".
    const inlineDate = priceUpdatedAt ? formatAbsoluteDate(priceUpdatedAt) : null;
    body = (
      <span
        role="status"
        aria-label={ariaLabel}
        className={cn('inline-flex items-center gap-1.5 text-xs font-medium', color, className)}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {freshness.label}
          {inlineDate && (
            <span className="tabular-nums text-muted-foreground"> · em {inlineDate}</span>
          )}
          {limitSuffix}
        </span>
      </span>
    );
  }

  const tooltipped = (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{body}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <FreshnessTooltipBody freshness={freshness} priceUpdatedAt={priceUpdatedAt} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Sem ação individual configurada → comportamento clássico (somente leitura).
  if (!canOfferConfirm) return tooltipped;

  // Com ação configurada → agrupa o badge + botão "Confirmei com fornecedor".
  // Em variants compactas o CTA encolhe para "Confirmei" para caber em linha.
  const ctaLabel =
    variant === 'compact' || variant === 'icon-only' ? 'Confirmei' : 'Confirmei com fornecedor';
  return (
    <span className="inline-flex items-center gap-1.5">
      {tooltipped}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onConfirm?.();
        }}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border-[1.5px] border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
        )}
        aria-label="Confirmar que validei este preço com o fornecedor"
      >
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        <span>{ctaLabel}</span>
      </button>
    </span>
  );
}
