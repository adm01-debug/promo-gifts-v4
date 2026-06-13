import { cn } from '@/lib/utils';

/**
 * Classes utilitárias compartilhadas entre os cards de produtos (Novidades, Reposição, Catálogo)
 * para garantir consistência visual em paddings, bordas, margens e alinhamentos.
 */

export const productCardStyles = {
  // Container principal do Card
  container: cn(
    'group cursor-pointer overflow-hidden rounded-xl transition-all duration-300 sm:rounded-2xl',
    'border-border/50 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg',
  ),

  // Estados especiais de borda/ring
  recent: 'border-success/30 shadow-[0_0_16px_hsl(var(--success)/0.1)]',
  selected: 'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.15)] ring-2 ring-primary',

  // Seção de informações (texto e preços) — espaçamentos reduzidos ~20%
  infoSection: 'relative space-y-1.5 bg-card p-2 sm:space-y-2 sm:p-3',

  // Título do produto (line-clamp e min-height para alinhamento)
  title: cn(
    'line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] font-display text-sm font-semibold leading-snug text-foreground',
    'transition-colors duration-300 group-hover:text-primary sm:text-base',
  ),

  // Seção de preço e estoque
  priceStockSection: 'flex items-end justify-between pt-0',

  // Container de preço
  priceContainer: 'min-h-[2.5rem] sm:min-h-[3rem] flex flex-col justify-end',

  // Seção de categoria
  categoryBadgeSection: 'mt-0 flex flex-wrap gap-1 border-t border-primary/20 pt-1',

  // Seção de Sparkline/Gráfico
  sparklineSection: 'border-t border-border/30 pt-1 sm:pt-1.5',
};
