/**
 * ColorSwatch — SSOT visual para bolinhas de cor em toda a plataforma.
 *
 * ⚠️  REGRA DE OURO (ver docs/COLOR_SWATCH_SSOT.md e mem://design/color-swatch-ssot):
 *     Qualquer alteração visual em bolinhas de cor (estado ativo, esgotado,
 *     reposição prevista, cores mistas, tamanho, borda, anel, slash de
 *     esgotado) DEVE ser feita exclusivamente neste arquivo. NÃO duplicar
 *     classes em outros componentes — consumi-los via `getColorSwatchClasses`
 *     e `resolveSwatchBackground`.
 *
 * Consumidores atuais:
 *  - src/components/products/ProductColorSwatches.tsx (Catálogo/Super Filtro/
 *    Novidades/Reposição — botões interativos)
 *  - src/components/inventory/VariantStockVisuals.tsx (RichColorSwatch — estoque)
 */
import { cn } from '@/lib/utils';

/** Regex para detectar nomes de cores "mistas" (gradiente conic). */
export const MIXED_COLOR_RE = /color(ido)?|sortido|multi/i;

/** Gradiente conic usado para cores mistas/sortidas. */
export const MIXED_COLOR_GRADIENT =
  'conic-gradient(from 180deg, hsl(0 80% 60%), hsl(40 90% 55%), hsl(140 60% 50%), hsl(210 80% 55%), hsl(280 60% 55%), hsl(0 80% 60%))';

export interface SwatchClassOptions {
  /** Variação selecionada/destacada. Aplica ring-primary + glow. */
  isActive?: boolean;
  /** Estoque zerado sem reposição prevista. Aplica slash diagonal + grayscale. */
  isOutOfStock?: boolean;
  /** Estoque zerado COM reposição prevista. Aplica grayscale leve (sem slash). */
  isUpcoming?: boolean;
  /** Botão clicável (hover scale + opacity). Default false. */
  isInteractive?: boolean;
}

/**
 * Retorna a string de classes Tailwind padronizada para um swatch de cor.
 * Não inclui tamanho — o caller é responsável por aplicar h-* / w-* conforme
 * o preset (xs/sm/md) ou um tamanho fixo (ex.: 25px em inventory).
 */
export function getColorSwatchClasses({
  isActive = false,
  isOutOfStock = false,
  isUpcoming = false,
  isInteractive = false,
}: SwatchClassOptions = {}): string {
  return cn(
    // Base — borda e sombra unificadas com o Catálogo de Produtos.
    'relative inline-block rounded-full border border-border/40 shadow-sm transition-all',
    isInteractive && 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    // Ativo: ring + glow. Tem precedência visual sobre hover idle.
    isActive
      ? 'z-10 scale-[var(--swatch-scale-hover,1.1)] opacity-100 ring-[var(--swatch-ring-width,2px)] ring-primary ring-offset-1 after:absolute after:inset-[-1px] after:rounded-full after:shadow-[0_0_12px_2px_hsl(var(--primary)/0.5)] after:content-[""]'
      : isInteractive &&
          'opacity-90 hover:z-10 hover:scale-[var(--swatch-scale-hover,1.1)] hover:opacity-100',
    // Esgotado: slash diagonal + grayscale forte. Sobrepõe opacidade idle.
    isOutOfStock &&
      'opacity-40 grayscale before:absolute before:inset-0 before:rounded-full before:bg-[linear-gradient(45deg,transparent_calc(50%-1px),hsl(var(--foreground)/0.7)_50%,transparent_calc(50%+1px))] before:content-[""]',
    // Reposição prevista (sem slash — apenas atenuação leve).
    isUpcoming && !isOutOfStock && 'opacity-70',
  );
}

/**
 * Resolve o `background-color`/`background-image` apropriado para o swatch.
 *  - hex válido → cor sólida
 *  - sem hex + nome "Colorido/Sortido/Multi" → gradiente conic (mista)
 *  - sem hex + nome qualquer → `undefined` (caller aplica borda tracejada)
 */
export function resolveSwatchBackground(
  hex?: string | null,
  name?: string | null,
): string | undefined {
  if (hex && hex.trim()) return hex;
  if (name && MIXED_COLOR_RE.test(name)) return MIXED_COLOR_GRADIENT;
  return undefined;
}

// ============================================
// <ColorSwatch /> — primitiva não-interativa (span)
// ============================================

export interface ColorSwatchProps extends SwatchClassOptions {
  hex?: string | null;
  name?: string | null;
  /** Tamanho em pixels (default 25 — espelha o swatch do estoque). */
  sizePx?: number;
  /** Classe extra para sobrescrever tamanho/posicionamento. */
  className?: string;
  /** aria-label customizado. Default: nome da cor. */
  ariaLabel?: string;
}

/**
 * Primitiva visual (span) — uso em legendas, chips e cabeçalhos de tabela
 * onde a bolinha NÃO é clicável. Para botões interativos use
 * `ProductColorSwatches` (catálogo) ou aplique `getColorSwatchClasses` em um
 * `<button>` próprio (inventory).
 */
export function ColorSwatch({
  hex,
  name,
  sizePx = 25,
  className,
  ariaLabel,
  isActive,
  isOutOfStock,
  isUpcoming,
}: ColorSwatchProps) {
  const bg = resolveSwatchBackground(hex, name);
  const label = ariaLabel ?? name?.trim() ?? 'Sem cor';
  return (
    <span
      role="img"
      aria-label={label}
      data-testid="color-swatch"
      data-stock-state={isOutOfStock ? 'out' : isUpcoming ? 'upcoming' : 'in-stock'}
      className={cn(
        getColorSwatchClasses({ isActive, isOutOfStock, isUpcoming }),
        !bg && 'border-dashed border-muted-foreground/40',
        className,
      )}
      style={{
        width: sizePx,
        height: sizePx,
        ...(bg
          ? bg.startsWith('conic-gradient')
            ? { backgroundImage: bg }
            : { backgroundColor: bg }
          : {}),
      }}
    />
  );
}
