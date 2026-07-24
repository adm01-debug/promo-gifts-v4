import { AlertCircle, Filter, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useZeroResultDiagnosis,
  type FilterKey,
} from '@/hooks/intelligence/useZeroResultDiagnosis';

interface Props {
  /** Só ativa quando pedidos+orçamentos = 0. Pai controla. */
  enabled: boolean;
  days: number;
  categoryId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  categoryName?: string | null;
  supplierName?: string | null;
  productName?: string | null;
  /** Callback para ampliar um filtro específico (limpar o valor). */
  onClearFilter?: (key: FilterKey) => void;
  /** Callback para ampliar a janela em dias. */
  onWidenWindow?: () => void;
}

const KEY_LABEL: Record<FilterKey, string> = {
  category: 'categoria',
  supplier: 'fornecedor',
  product: 'produto',
};

/**
 * Callout inteligente exibido apenas quando o painel retorna zero E há filtros
 * ativos. Aponta explicitamente qual dimensão está causando o vazio e oferece
 * ações rápidas de ampliação.
 */
export function ZeroResultDiagnosisCallout({
  enabled,
  days,
  categoryId,
  supplierId,
  productId,
  categoryName,
  supplierName,
  productName,
  onClearFilter,
  onWidenWindow,
}: Props) {
  const { data, isLoading } = useZeroResultDiagnosis({
    enabled,
    days,
    categoryId,
    supplierId,
    productId,
    categoryName,
    supplierName,
    productName,
  });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <Alert data-testid="zero-diagnosis-callout" data-state="loading" className="border-amber-500/30 bg-amber-500/5">
        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">
          Analisando por que o resultado deu zero…
        </AlertTitle>
        <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
          Testando cada filtro para identificar o gargalo.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  // Monta o texto explicativo por caso ------------------------------------
  let title: string;
  let body: React.ReactNode;
  const actions: React.ReactNode[] = [];

  if (data.culprit === 'window') {
    title = 'Nenhuma venda registrada nesta janela';
    body = (
      <>
        O banco Gold não tem <strong>nenhum</strong> orçamento ou pedido nos últimos{' '}
        <strong>{days} dias</strong> — nem mesmo sem os filtros aplicados. Amplie o período para
        buscar dados históricos.
      </>
    );
    if (onWidenWindow) {
      actions.push(
        <Button
          key="widen"
          size="sm"
          variant="outline"
          onClick={onWidenWindow}
          data-testid="zero-diagnosis-widen-window"
        >
          Ampliar janela
        </Button>,
      );
    }
  } else if (data.culprit === 'intersection') {
    title = 'A combinação de filtros zerou os resultados';
    body = (
      <>
        Existem <strong>{data.unfilteredQuoteCount}</strong> orçamentos no período, mas a
        <em> intersecção</em> dos filtros aplicados não bate com nenhum deles. Remova pelo menos um
        dos filtros abaixo para recuperar resultados:
      </>
    );
    data.filtersToWiden.forEach((f) => {
      actions.push(
        <Button
          key={f.key}
          size="sm"
          variant="outline"
          onClick={() => onClearFilter?.(f.key)}
          data-testid={`zero-diagnosis-clear-${f.key}`}
        >
          Remover {KEY_LABEL[f.key]}: {f.label}
        </Button>,
      );
    });
  } else if (data.culprit) {
    const filter = data.filtersToWiden[0];
    const probe = data.leaveOneOut[data.culprit];
    title = `Filtro de ${KEY_LABEL[data.culprit]} está bloqueando os resultados`;
    body = (
      <>
        Sem o filtro de {KEY_LABEL[data.culprit]}{' '}
        <Badge variant="outline" className="border-primary/30 text-primary">
          {filter?.label ?? '—'}
        </Badge>{' '}
        haveria <strong>{probe}</strong> orçamento{probe === 1 ? '' : 's'} na janela de{' '}
        <strong>{days} dias</strong>. Amplie ou remova esse filtro para ver os dados.
      </>
    );
    if (onClearFilter && filter) {
      actions.push(
        <Button
          key={filter.key}
          size="sm"
          variant="outline"
          onClick={() => onClearFilter(filter.key)}
          data-testid={`zero-diagnosis-clear-${filter.key}`}
        >
          Remover filtro de {KEY_LABEL[filter.key]}
        </Button>,
      );
    }
  } else {
    // Não há filtros ativos e o resultado é zero — pai deve tratar, mas por segurança:
    title = 'Sem resultados no período';
    body = <>Não há orçamentos nem pedidos na janela selecionada.</>;
    if (onWidenWindow) {
      actions.push(
        <Button key="widen" size="sm" variant="outline" onClick={onWidenWindow}>
          Ampliar janela
        </Button>,
      );
    }
  }

  return (
    <Alert
      data-testid="zero-diagnosis-callout"
      data-state={data.culprit ?? 'none'}
      className="border-amber-500/30 bg-amber-500/5"
    >
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-200">{title}</AlertTitle>
      <AlertDescription className="space-y-3 text-amber-900/80 dark:text-amber-200/80">
        <p>{body}</p>
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Filter className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            {actions}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
