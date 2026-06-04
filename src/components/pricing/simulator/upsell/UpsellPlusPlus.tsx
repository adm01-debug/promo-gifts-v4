/**
 * UpsellPlusPlus — Componente visual de sugestões inteligentes de upsell/cross-sell.
 * Design 10/10 com animações premium via framer-motion.
 */
import { useMemo } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Sparkles, PackagePlus, ArrowUpRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductTechnique, ConfiguredEngraving } from '../types';
import {
  generateSuggestions,
  type UpsellSuggestion,
  type UpsellType,
  type UpsellPriority,
} from './upsell-engine';

// ============================================
// PROPS
// ============================================

interface UpsellPlusPlusProps {
  product: {
    id: string;
    name: string;
    price: number;
    category_name?: string | null;
  };
  currentEngravings: ConfiguredEngraving[];
  availableTechniques: ProductTechnique[];
  quantity: number;
  className?: string;
  onSuggestionClick?: (suggestion: UpsellSuggestion) => void;
  /** Máximo de sugestões exibidas (padrão: 3) */
  maxVisible?: number;
}

// ============================================
// VISUAIS
// ============================================

const ICON_MAP: Record<UpsellType, typeof Sparkles> = {
  technique_upgrade: ArrowUpRight,
  add_position: PackagePlus,
  quantity_tier: TrendingUp,
  complementary: Zap,
};

const PRIORITY_STYLES: Record<UpsellPriority, string> = {
  high: 'border-l-accent bg-accent/10',
  medium: 'border-l-primary bg-primary/5',
  low: 'border-l-muted bg-muted/30',
};

// ============================================
// ANIMAÇÕES
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12, scale: 0.97 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  exit: {
    opacity: 0,
    x: 12,
    scale: 0.97,
    transition: { duration: 0.15 },
  },
};

// ============================================
// COMPONENTE
// ============================================

export function UpsellPlusPlus({
  product,
  currentEngravings,
  availableTechniques,
  quantity,
  className,
  onSuggestionClick,
  maxVisible = 3,
}: UpsellPlusPlusProps) {
  const suggestions = useMemo(
    () =>
      generateSuggestions(currentEngravings, availableTechniques, quantity, product.category_name),
    [currentEngravings, availableTechniques, quantity, product.category_name],
  );

  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Card className={cn('border-dashed', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <motion.div
              animate={{ rotate: [0, 12, -12, 0] }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Sparkles className="h-4 w-4 text-accent" />
            </motion.div>
            Sugestões inteligentes
            <Badge variant="secondary" className="text-xs">
              {suggestions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="popLayout">
            <motion.div
              className="space-y-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {suggestions.slice(0, maxVisible).map((s) => {
                const Icon = ICON_MAP[s.type];
                return (
                  <motion.button
                    key={s.id}
                    variants={itemVariants}
                    exit="exit"
                    layout
                    onClick={() => onSuggestionClick?.(s)}
                    whileHover={{ scale: 1.01, x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      'w-full rounded-md border-l-4 p-3 text-left transition-colors',
                      PRIORITY_STYLES[s.priority],
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{s.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {s.impact}
                        </Badge>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default UpsellPlusPlus;
