import { Button } from '@/components/ui/button';
import { Loader2, Download, ShoppingCart, MessageCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/kit-builder';

interface KitActionsBarProps {
  isValid: boolean;
  isAddingToQuote?: boolean;
  kitName: string;
  kitTag?: string | null;
  kitQuantity: number;
  unitPrice: number;
  total: number;
  items: Array<{ quantity: number; name: string }>;
  onAddToQuote?: () => void;
  onExportPDF?: () => void;
}

export function KitActionsBar({
  isValid,
  isAddingToQuote,
  kitName,
  kitTag,
  kitQuantity,
  unitPrice,
  total,
  items,
  onAddToQuote,
  onExportPDF,
}: KitActionsBarProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Button variant="outline" onClick={onExportPDF}>
        <Download className="mr-2 h-4 w-4" />
        Exportar PDF
      </Button>
      <Button disabled={!isValid || isAddingToQuote} onClick={onAddToQuote}>
        {isAddingToQuote ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="mr-2 h-4 w-4" />
        )}
        {isAddingToQuote ? 'Criando...' : 'Criar Orçamento'}
      </Button>
      <Button
        variant="outline"
        className="border-primary/50 text-primary hover:bg-primary/10 dark:text-primary"
        disabled={!isValid}
        onClick={() => {
          const kitLabel = kitName || 'Kit Personalizado';
          const title = kitTag ? `*${kitLabel} — ${kitTag}*` : `*${kitLabel}*`;
          const itemsList = items.map((i) => `• ${i.quantity}x ${i.name}`).join('\n');
          const text = `${title} (${kitQuantity}x)\n\n${itemsList}\n\n💰 *${formatCurrency(unitPrice)}/kit*\n📦 Total: *${formatCurrency(total)}*`;
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }}
      >
        <MessageCircle className="mr-2 h-4 w-4" />
        WhatsApp
      </Button>
    </div>
  );
}
