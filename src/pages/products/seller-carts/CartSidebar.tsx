/**
 * CartSidebar — painel lateral apenas com peso/volume do carrinho.
 * A ação "Gerar Orçamento" vive no header do carrinho ativo
 * (ver CartHeaderActions). Os antigos menus "Gerenciar Carrinho"
 * e o atalho "Ver Orçamentos" foram removidos.
 */
import { type CartTemplateItem, type SellerCart } from '@/hooks/products';
import { Card } from '@/components/ui/card';
import { Weight, Box } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

interface CartSidebarProps {
  cart: SellerCart;
  cartSubtotal: number;
  cartTotalQty: number;
  weightVolume: { weightKg: number; volumeM3: number; volumeCm3: number } | null;
  templates: {
    id: string;
    name: string;
    description?: string | null;
    items: CartTemplateItem[];
    created_at?: string;
  }[];
  canCreateCart: boolean;
  onGenerateQuote: (cart: SellerCart) => void;
  onShareCart: (cartId: string) => void;
  onDuplicateCart: (cartId: string) => void;
  onExportCSV: (cart: SellerCart) => void;
  onExportPDF: (cart: SellerCart) => void;
  onSaveTemplate: (name: string, description: string) => void;
  onLoadTemplate: (items: CartTemplateItem[]) => void;
  onDeleteTemplate: UseMutationResult<void, Error, string>;
  onClear: () => void;
  onNavigate: (path: string) => void;
  onFocusNotes?: () => void;
}

export function CartSidebar({ weightVolume }: CartSidebarProps) {
  const hasWeightVolume =
    !!weightVolume && (weightVolume.weightKg > 0 || weightVolume.volumeCm3 > 0);

  if (!hasWeightVolume) return null;

  return (
    <div className="hidden space-y-4 md:block xl:sticky xl:top-20 xl:self-start">
      <Card
        data-testid="cart-sidebar-hero"
        data-loaded="true"
        className="group/hero relative space-y-5 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-background p-5 shadow-md"
      >
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-colors group-hover/hero:bg-primary/10" />
        <div className="relative z-10 grid grid-cols-2 gap-3 text-xs">
          {weightVolume!.weightKg > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Weight aria-hidden="true" className="h-3 w-3 opacity-60" /> Peso
              </p>
              <p className="text-sm font-bold tabular-nums">
                {weightVolume!.weightKg >= 1
                  ? `${weightVolume!.weightKg.toFixed(1)}kg`
                  : `${(weightVolume!.weightKg * 1000).toFixed(0)}g`}
              </p>
            </div>
          )}
          {weightVolume!.volumeCm3 > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Box aria-hidden="true" className="h-3 w-3 opacity-60" /> Volume
              </p>
              <p className="text-sm font-bold tabular-nums">
                {weightVolume!.volumeM3 >= 0.001
                  ? `${weightVolume!.volumeM3.toFixed(3)}m³`
                  : `${weightVolume!.volumeCm3.toLocaleString('pt-BR')}cm³`}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
