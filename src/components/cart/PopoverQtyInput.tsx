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
 */

import { useEffect, useRef, useState } from 'react';

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
  // Ref usada pelo Esc para pular o commit disparado por blur() na sequência.
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(quantity));
  }, [quantity, editing]);

  const commit = () => {
    setEditing(false);
    const next = normalizeQty(draft);
    if (next === null) {
      setDraft(String(quantity));
      return;
    }
    setDraft(String(next));
    if (next !== quantity) onCommit(next);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      autoFocus={autoFocus}
      aria-label={`Quantidade de ${productName}`}
      data-testid={`cart-item-qty-${itemId}`}
      value={draft}
      onFocus={(e) => {
        setEditing(true);
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
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
          setEditing(false);
          (e.currentTarget as HTMLInputElement).blur();
        }
        // Tab: comportamento padrão do browser (não interceptamos).
      }}
      className="m-0 flex h-6 w-10 appearance-none border-x border-border/30 bg-muted/20 text-center text-[11px] font-bold tabular-nums text-foreground [appearance:textfield] focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

