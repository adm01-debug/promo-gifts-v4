/**
 * ColorSwatchPicker — picker INTERATIVO de bolinhas de cor para o caminho V2
 * (flag `useColorSwatchesV2`), alimentado por `products.color_swatches` JSONB.
 * Renderizado por ProductCard (grid de Catálogo/Super Filtro), ProductListItem
 * (lista) e ProductTableRow (tabela) quando o produto possui swatches V2.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  fix_version=swatch-ssot-v2-20260627  •  ANTI-REGRESSÃO (NÃO REMOVER)
 * ──────────────────────────────────────────────────────────────────────────────
 *  REGRESSÃO CORRIGIDA: este componente HARD-CODAVA o diâmetro do dot em pixels
 *  (`const dotPx = size === 'sm' ? 16 : 20`), renderizando bolinhas de 16px
 *  enquanto TODO o resto do sistema (ProductColorSwatches) usa o token SSOT
 *  `--swatch-size-sm` (24,2px). Resultado: produtos COM swatches V2 apareciam com
 *  bolinhas visivelmente menores que produtos no fallback V1 — quebrando o padrão
 *  visual em Catálogo, Super Filtro, Novidades e Reposição.
 *
 *  CORREÇÃO: o tamanho, o gap, o border/shadow, os estados ATIVO e ESGOTADO e o
 *  hover passam a vir EXCLUSIVAMENTE da SSOT compartilhada:
 *    • tamanho/gap  → CSS tokens `--swatch-size-*` / `--swatch-gap-*` (src/index.css)
 *    • aparência    → `getColorSwatchClasses()` + `resolveSwatchBackground()`
 *      (src/components/shared/ColorSwatch.tsx) — MESMA fonte do ProductColorSwatches.
 *
 *  PROIBIDO reintroduzir tamanhos numéricos em px (dotPx/width:16/h-4 w-4) aqui.
 *  Para ajustar o tamanho do swatch em TODO o sistema, edite os tokens em
 *  src/index.css — nunca este arquivo isoladamente.
 * ──────────────────────────────────────────────────────────────────────────────
 */
import { cn } from '@/lib/utils';
import {
  getColorSwatchClasses,
  resolveSwatchBackground,
} from '@/components/shared/ColorSwatch';
import type { ColorSwatch } from '@/hooks/useProductColorSwatch';

interface ColorSwatchPickerProps {
  swatches: ColorSwatch[];
  activeVariantId: string | null;
  onSelect: (variantId: string) => void;
  onReset: () => void;
  maxVisible?: number;
  size?: 'md' | 'sm';
  className?: string;
}

/** Diâmetro do dot por preset — sempre via token SSOT (ver index.css). */
const SIZE_VAR: Record<NonNullable<ColorSwatchPickerProps['size']>, string> = {
  sm: 'var(--swatch-size-sm)',
  md: 'var(--swatch-size-md)',
};

export function ColorSwatchPicker({
  swatches,
  activeVariantId,
  onSelect,
  onReset,
  maxVisible = 14,
  size = 'md',
  className,
}: ColorSwatchPickerProps) {
  if (!swatches || swatches.length === 0) return null;

  const sizeVar = SIZE_VAR[size];
  // Regra: mostra TODAS as bolinhas que couberem em 2 linhas (limite `maxVisible`).
  // Se sobrarem cores, a ÚLTIMA bolinha visível vira o chip "+N" — nunca após o limite.
  const hasOverflow = swatches.length > maxVisible;
  const visible = hasOverflow ? swatches.slice(0, maxVisible - 1) : swatches;
  const overflow = hasOverflow ? swatches.length - (maxVisible - 1) : 0;

  return (
    <div
      className={cn(
        'flex min-h-[var(--swatch-size-sm)] flex-wrap items-center gap-x-[var(--swatch-gap-x)] gap-y-[var(--swatch-gap-y)] overflow-hidden px-[2px] py-[var(--swatch-container-py)]',
        className,
      )}
      style={{
        // Rede de segurança: nunca passa de 2 linhas, mesmo em cards muito estreitos.
        maxHeight: `calc(2 * ${sizeVar} + var(--swatch-gap-y) + 2 * var(--swatch-container-py))`,
      }}
    >
      {visible.map((swatch) => {
        const isActive = activeVariantId === swatch.variant_id;
        const isOut = !swatch.is_in_stock;
        const bg = resolveSwatchBackground(swatch.color_hex, swatch.color_name);
        return (
          <button
            key={swatch.variant_id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(swatch.variant_id);
            }}
            className={cn(
              // SSOT visual: base + estados out-of-stock/active (igual ao ProductColorSwatches)
              getColorSwatchClasses({ isActive, isOutOfStock: isOut, hasBg: bg.hasBg }),
              'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isActive
                ? 'scale-[var(--swatch-scale-hover)] opacity-100 ring-[var(--swatch-ring-width)] ring-primary after:absolute after:inset-[-1px] after:rounded-full after:shadow-[0_0_12px_2px_hsl(var(--primary)/0.5)] after:content-[""]'
                : !isOut &&
                    'opacity-90 hover:z-10 hover:scale-[var(--swatch-scale-hover)] hover:opacity-100',
            )}
            style={{
              width: sizeVar,
              height: sizeVar,
              backgroundColor: bg.background ?? 'transparent',
            }}
            title={`${swatch.color_name}${
              isOut
                ? ' (sem estoque)'
                : ` — ${swatch.stock_quantity.toLocaleString('pt-BR')} un.`
            }`}
            aria-label={swatch.color_name}
            aria-pressed={isActive}
          />
        );
      })}

      {overflow > 0 && (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-none text-muted-foreground"
          style={{ height: sizeVar, minWidth: sizeVar }}
          aria-label={`Mais ${overflow} cor${overflow === 1 ? '' : 'es'}`}
          title={`+${overflow}`}
        >
          +{overflow}
        </span>
      )}


      {/* Botão Todos — aparece apenas quando há seleção ativa (mesmo estilo do ProductColorSwatches) */}
      {activeVariantId !== null && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          aria-label="Ver todas as cores"
          className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Todos
        </button>
      )}
    </div>
  );
}
