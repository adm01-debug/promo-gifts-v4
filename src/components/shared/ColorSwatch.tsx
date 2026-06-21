/**
 * ColorSwatch — primitivo visual ÚNICO de "bolinha de cor", compartilhado por:
 *  • Catálogo / Super Filtro / Novidades / Reposição (`ProductColorSwatches`)
 *  • Estoque (`RichColorSwatch` em VariantStockVisuals)
 *
 * Centralizar aqui:
 *  (a) o fundo (hex sólido OU gradiente conic para cores "mistas"/"sortidas"),
 *  (b) o border + shadow base,
 *  (c) a marcação visual de ESGOTADO (slash diagonal + grayscale + opacity),
 *  (d) a marcação de ATIVO/SELECIONADO (ring primary).
 *
 * Consumidores controlam o elemento (button para catálogo, span para estoque)
 * e composições específicas (tamanho, tooltip, eventos). NÃO duplique classes
 * de fundo/borda/esgotado em consumidores — sempre passe por aqui.
 */
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const MIXED_COLOR_RE = /(colorido|sortido|multi|arco|rainbow|mix)/i;

export const MIXED_COLOR_GRADIENT =
  'conic-gradient(from 180deg, hsl(0 80% 60%), hsl(40 90% 55%), hsl(140 60% 50%), hsl(210 80% 55%), hsl(280 60% 55%), hsl(0 80% 60%))';

/** Resolve o background CSS de um swatch a partir de hex + nome. */
export function resolveSwatchBackground(
  hex?: string | null,
  name?: string | null,
): { background: string | undefined; isMixed: boolean; hasBg: boolean } {
  const trimmed = (hex ?? '').trim();
  if (trimmed) return { background: trimmed, isMixed: false, hasBg: true };
  const isMixed = MIXED_COLOR_RE.test(name ?? '');
  if (isMixed) return { background: MIXED_COLOR_GRADIENT, isMixed: true, hasBg: true };
  return { background: undefined, isMixed: false, hasBg: false };
}

export interface SwatchStateClassesOptions {
  isActive?: boolean;
  isOutOfStock?: boolean;
  hasBg?: boolean;
}

/**
 * Retorna a string de classes Tailwind que aplica a aparência base + estados
 * visuais do swatch (sem tamanho, sem cursor, sem layout do container).
 * Use junto com classes específicas do consumidor.
 */
export function getColorSwatchClasses({
  isActive = false,
  isOutOfStock = false,
  hasBg = true,
}: SwatchStateClassesOptions = {}): string {
  return cn(
    // Base — mesmo border/shadow do catálogo, posicionamento relativo para overlays
    'relative inline-block rounded-full border border-border/40 shadow-sm transition-all',
    // Ativo/selecionado (catálogo + estoque)
    isActive && 'z-10 ring-2 ring-primary ring-offset-1',
    // Sem cor definida — borda tracejada de placeholder
    !hasBg && 'border-dashed border-muted-foreground/40',
    // Esgotado — slash diagonal + grayscale + opacity (SSOT visual)
    isOutOfStock &&
      'opacity-40 grayscale before:absolute before:inset-0 before:rounded-full before:bg-[linear-gradient(45deg,transparent_calc(50%-1px),hsl(var(--foreground)/0.7)_50%,transparent_calc(50%+1px))] before:content-[""]',
  );
}

export interface ColorSwatchProps extends HTMLAttributes<HTMLSpanElement> {
  hex?: string | null;
  name?: string | null;
  isActive?: boolean;
  isOutOfStock?: boolean;
  /** Tamanho do swatch. Aceita classes Tailwind de h/w para casos especiais. */
  sizeClassName?: string;
}

/**
 * Span estilizado (não-interativo) para uso direto onde o consumidor não
 * precisa de um botão. Consumidores interativos (Catálogo) devem usar
 * `getColorSwatchClasses(...)` em um `<button>` próprio.
 */
export const ColorSwatch = forwardRef<HTMLSpanElement, ColorSwatchProps>(function ColorSwatch(
  { hex, name, isActive, isOutOfStock, sizeClassName = 'h-[25px] w-[25px]', className, style, ...rest },
  ref,
) {
  const { background, isMixed, hasBg } = resolveSwatchBackground(hex, name);
  // Gradientes (cores mistas) precisam ir em `background` — `backgroundColor`
  // só aceita <color>, então um conic-gradient seria silenciosamente descartado.
  const bgStyle = background
    ? isMixed
      ? { ...style, background }
      : { ...style, backgroundColor: background }
    : style;
  return (
    <span
      ref={ref}
      className={cn(getColorSwatchClasses({ isActive, isOutOfStock, hasBg }), 'shrink-0', sizeClassName, className)}
      style={bgStyle}
      {...rest}
    />
  );
});
