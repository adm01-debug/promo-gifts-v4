/**
 * CartItemErrorAlert — alerta inline mostrado sob um item do popover
 * quando a mutation otimista falha e o hook aplica rollback.
 *
 * Requisitos cobertos:
 *  • Menciona o item (nome do produto) para que o vendedor saiba EXATAMENTE
 *    qual linha voltou ao estado anterior.
 *  • Expõe uma ação de retry focada (autoFocus opcional) — o botão recebe
 *    foco quando o erro aparece se `focusRetry` estiver ativo, para que o
 *    usuário possa apenas apertar Enter para tentar de novo (a11y).
 *  • Não vaza detalhes técnicos: mensagem fixa PT-BR, sem `error.message`
 *    do servidor.
 */
import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface CartItemErrorAlertProps {
  itemId: string;
  productName: string;
  onRetry: () => void;
  onDismiss?: () => void;
  /** Se true, coloca foco no botão Tentar de novo assim que renderiza. */
  focusRetry?: boolean;
}

export function CartItemErrorAlert({
  itemId,
  productName,
  onRetry,
  onDismiss,
  focusRetry = false,
}: CartItemErrorAlertProps) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (focusRetry && btnRef.current) {
      btnRef.current.focus();
    }
  }, [focusRetry]);

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid={`cart-item-error-${itemId}`}
      className="mt-1 flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-1.5 py-1 text-[10px] text-destructive"
    >
      <AlertCircle aria-hidden="true" className="mt-[1px] h-3 w-3 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">
          Falha ao salvar “{productName}”
        </span>
        <span className="text-destructive/80">
          Suas alterações foram desfeitas. Tente novamente.
        </span>
      </div>
      <button
        ref={btnRef}
        type="button"
        data-testid={`cart-item-error-retry-${itemId}`}
        className="shrink-0 self-center rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss?.();
          onRetry();
        }}
      >
        Tentar de novo
      </button>
    </div>
  );
}
