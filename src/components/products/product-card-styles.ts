import { cn } from '@/lib/utils';

/**
 * Classes utilitárias compartilhadas entre os cards de produtos (Novidades, Reposição, Catálogo)
 * para garantir consistência visual em paddings, bordas, margens e alinhamentos.
 */

export const productCardStyles = {
  // Container principal do Card
  container: cn(
    'group cursor-pointer overflow-hidden rounded-xl transition-all duration-300 sm:rounded-2xl',
    'border-border/50 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg'
  ),
  
  // Estados especiais de borda/ring
  recent: 'border-success/30 shadow-[0_0_16px_hsl(var(--success)/0.1)]',
  selected: 'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.15)] ring-2 ring-primary',
  
  // Seção de informações (texto e preços)
  infoSection: 'relative space-y-2 bg-card p-2.5 sm:space-y-3 sm:p-4',
  
  // Título do produto (line-clamp e min-height para alinhamento)
  // Padronizado para 2 linhas de texto com fallback de altura para evitar desalinhamento
  title: cn(
    'line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem] font-display text-sm font-semibold leading-snug text-foreground',
    'transition-colors duration-300 group-hover:text-primary sm:text-base'
  ),
  
  // Seção de preço e estoque
  priceStockSection: 'flex items-end justify-between pt-0.5 sm:pt-1',
  
  // Container de preço (min-height para manter botões/indicadores alinhados na mesma base)
  // Padronizado para comportar preços com e sem label "A partir de" ou "Preço sob consulta"
  priceContainer: 'min-h-[3.25rem] sm:min-h-[3.75rem] flex flex-col justify-end',
  
  // Seção de categoria
  categoryBadgeSection: 'mt-0.5 flex flex-wrap gap-1.5 border-t border-primary/20 pt-1.5',
  
  // Seção de Sparkline/Gráfico
  sparklineSection: 'border-t border-border/30 pt-1.5 sm:pt-2'
};
