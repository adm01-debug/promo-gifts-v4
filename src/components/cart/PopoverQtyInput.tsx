/**
 * PopoverQtyInput — input controlado de quantidade dentro do popover do carrinho.
 *
 * Regras:
 *  - Permite digitar valores numéricos livremente (ex.: "80")
 *  - Sanitiza a entrada: aceita apenas dígitos (vírgula, ponto, espaço, letras
 *    e símbolos são descartados no momento do onChange)
 *  - Commit em Enter ou blur; Esc restaura o último valor válido sem commit
 *  - Clamp entre MIN_QTY (1) e MAX_QTY (999.999)
 *  - Valores vazios / inválidos / abaixo do mínimo revertem ao valor externo
 *  - Sincroniza com prop externa quando o usuário não está editando
 *  - stopPropagation em click/keydown para não interferir no popover pai
 *  - aria-label descritivo por item; tabIndex padrão (Tab navega naturalmente)
 *  - Feedback visual sutil: ring âmbar (sanitizado / clamped) ou vermelho
 *    (inválido → revertido), com auto-clear em 700ms. Largura fixa mantida.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export const MIN_QTY = 1;
export const MAX_QTY = 999_999;

/**
 * Normaliza uma string qualquer para um inteiro válido dentro de [MIN, MAX],
 * ou retorna `null` quando a entrada não representa uma quantidade legítima.
 */
export function normalizeQty(raw: string): number | null {
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 0) return null;
  const parsed = parseInt(digitsOnly, 10);
  if (Number.isNaN(parsed)) return null;
  if (parsed < MIN_QTY) return null;
  return Math.min(MAX_QTY, parsed);
}

type FeedbackState = 'clamped' | 'idle' | 'invalid' | 'sanitized';

const FEEDBACK_TIMEOUT_MS = 700;

const FEEDBACK_CLASSES: Record<FeedbackState, string> = {
  idle: '',
  sanitized: 'ring-1 ring-warning/60 bg-warning/10',
  clamped: 'ring-1 ring-warning/60 bg-warning/10',
  invalid: 'ring-1 ring-destructive/70 bg-destructive/10',
};

const FEEDBACK_MESSAGE: Record<FeedbackState, string> = {
  idle: '',
  sanitized: 'Apenas dígitos são aceitos',
  clamped: `Valor limitado a ${MAX_QTY.toLocaleString('pt-BR')}`,
  invalid: 'Valor inválido — quantidade restaurada',
};

export interface PopoverQtyInputProps {
  itemId: string;
  productName: string;
  quantity: number;
  onCommit: (next: number) => void;
  /** Foco automático (usado no primeiro item quando o popover abre). */
  autoFocus?: boolean;
}

export function PopoverQtyInput({
  itemId,
  productName,
  quantity,
  onCommit,
  autoFocus,
}: PopoverQtyInputProps) {
  const [draft, setDraft] = useState<string>(String(quantity));
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  // Ref usada pelo Esc para pular o commit disparado por blur() na sequência.
  const skipCommitRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(String(quantity));
  }, [quantity, editing]);

  // Auto-clear do feedback visual + limpeza no unmount para evitar leaks.
  useEffect(() => {
    if (feedback === 'idle') return;
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(
      () => setFeedback('idle'),
      FEEDBACK_TIMEOUT_MS,
    );
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [feedback]);

  const flash = (state: Exclude<FeedbackState, 'idle'>) => setFeedback(state);

  const commit = () => {
    setEditing(false);
    const next = normalizeQty(draft);
    if (next === null) {
      setDraft(String(quantity));
      flash('invalid');
      return;
    }
    setDraft(String(next));
    // Se o valor digitado (só dígitos) foi maior que MAX, sinalizar clamped.
    const digitsOnly = draft.replace(/[^0-9]/g, '');
    if (digitsOnly.length > 0 && parseInt(digitsOnly, 10) > MAX_QTY) {
      flash('clamped');
    }
    if (next !== quantity) onCommit(next);
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={`Quantidade de ${productName}`}
        aria-invalid={feedback === 'invalid' || undefined}
        aria-describedby={
          feedback !== 'idle' ? `cart-item-qty-fb-${itemId}` : undefined
        }
        data-testid={`cart-item-qty-${itemId}`}
        data-feedback={feedback}
        value={draft}
        onFocus={(e) => {
          setEditing(true);
          e.target.select();
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const clean = raw.replace(/[^0-9]/g, '');
          if (raw !== clean) flash('sanitized');
          setDraft(clean);
        }}
        onBlur={() => {
          if (skipCommitRef.current) {
            skipCommitRef.current = false;
            setEditing(false);
            return;
          }
          commit();
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            skipCommitRef.current = true;
            setDraft(String(quantity));
            setFeedback('idle');
            setEditing(false);
            // NÃO chamamos blur() aqui: manter o foco no próprio input evita
            // que o Radix/Popover perca a referência de foco e mande o cursor
            // para o <body>. O input é o "trigger" de edição daquele item.
            (e.currentTarget as HTMLInputElement).focus();
          }
          // Tab / Shift+Tab: comportamento padrão (não interceptamos).
        }}
        className={cn(
          'm-0 flex h-6 w-10 appearance-none border-x border-border/30 bg-muted/20 text-center text-[11px] font-bold tabular-nums text-foreground transition-shadow duration-200 [appearance:textfield] focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          FEEDBACK_CLASSES[feedback],
        )}
      />
      {feedback !== 'idle' && (
        <span
          id={`cart-item-qty-fb-${itemId}`}
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {FEEDBACK_MESSAGE[feedback]}
        </span>
      )}
    </div>
  );
}
