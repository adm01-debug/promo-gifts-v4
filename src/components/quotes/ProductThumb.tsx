import { useState } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * qvThumb — SSOT de tamanhos dos thumbs de produto no QuoteView.
 * Todos os valores refletem a escala +20% acordada com o PO.
 * Use estes tokens em vez de classes h/w hardcoded para garantir
 * alinhamento consistente entre tabela, sheet, lista e summary.
 */
export const qvThumb = {
  /** Linha da tabela de itens. 48px → 58px (+20%). */
  row: 'h-[58px] w-[58px]',
  /** SheetContent / detalhe do item. 56px → 68px (+20%). */
  sheet: 'h-[68px] w-[68px]',
  /** Card do summary (coluna 3 do builder). */
  summary: 'h-[58px] w-[58px]',
  /** Lista densa / mobile cards. 64px → 77px (+20%). */
  list: 'h-[77px] w-[77px]',
  /** Compact (drag overlay, badges). */
  compact: 'h-12 w-12',
} as const;

export type QvThumbSize = keyof typeof qvThumb;

export interface ProductThumbProps {
  src?: string | null;
  alt?: string;
  /** Token de tamanho (preferido). */
  size?: QvThumbSize;
  /** Classes Tailwind custom (fallback). Usado se `size` não for passado. */
  sizeClassName?: string;
  className?: string;
  /** Border radius class. Default: rounded-md */
  roundedClassName?: string;
  /** Custom icon size class for fallback. */
  iconClassName?: string;
  /** Renderiza ícone de alerta (produto removido / URL inválida). */
  errorMode?: boolean;
  'data-testid'?: string;
}

/**
 * Thumb unificado de produto para QuoteView.
 * - Mantém aspect ratio fixo via h/w (anti-distorção).
 * - Estado de loading com skeleton (mesma área → zero layout shift).
 * - Placeholder com ícone quando não há imagem ou erro de rede.
 * - Estado de erro explícito via `errorMode` (produto removido).
 */
export function ProductThumb({
  src,
  alt = '',
  size,
  sizeClassName,
  className,
  roundedClassName = 'rounded-md',
  iconClassName = 'h-5 w-5',
  errorMode = false,
  'data-testid': testId,
}: ProductThumbProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const sizeCls = size ? qvThumb[size] : sizeClassName ?? qvThumb.row;
  const hasImage = Boolean(src) && !errored && !errorMode;
  const showError = errorMode || errored;

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden border border-border bg-muted',
        sizeCls,
        roundedClassName,
        showError && !src && 'border-destructive/30 bg-destructive/5',
        className,
      )}
      data-testid={testId}
      data-state={hasImage ? (loaded ? 'loaded' : 'loading') : showError ? 'error' : 'empty'}
    >
      {hasImage ? (
        <>
          {!loaded && (
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-muted"
              data-testid={testId ? `${testId}-skeleton` : undefined}
            />
          )}
          <img
            src={src ?? undefined}
            alt={alt}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </>
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center',
            showError ? 'text-destructive' : 'text-muted-foreground',
          )}
          aria-hidden="true"
          data-testid={testId ? `${testId}-placeholder` : undefined}
        >
          {showError ? (
            <AlertTriangle className={iconClassName} />
          ) : (
            <Package className={iconClassName} />
          )}
        </div>
      )}
    </div>
  );
}
