/**
 * PurchaseOrderModal — Modal "Pedir Reposição".
 * Cria registro em purchase_orders via fn_create_purchase_order().
 * qty_suggested = ceil(max(0, 30 - cobertura_atual) × ema_diaria).
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/ui';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingCart, Loader2, Package } from 'lucide-react';
import type { RuptureAlertRow } from '@/hooks/stock/useRuptureAlerts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: RuptureAlertRow | null;
}

/** Cobertura alvo: 30 dias. Qty = ceil((30 - cobertura_atual) × ema_diaria). */
function calcSuggestedQty(row: RuptureAlertRow): number {
  if (!row.ema_diaria || row.ema_diaria <= 0) return 1;
  const gap = Math.max(0, 30 - (row.cobertura_dias ?? 0));
  return Math.max(1, Math.ceil(gap * row.ema_diaria));
}

type AnyRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ error: Error | null }>;

export function PurchaseOrderModal({ open, onOpenChange, row }: Props) {
  const { toast } = useToast();
  const [qty, setQty] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!row) return null;

  const suggested = calcSuggestedQty(row);
  const displaySku = row.supplier_sku ?? row.variant_id.slice(0, 16);

  async function handleSubmit() {
    const qtyNum = parseInt(qty || String(suggested), 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast({ title: 'Quantidade inválida', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await (supabase.rpc as unknown as AnyRpc)('fn_create_purchase_order', {
        p_variant_id: row.variant_id,
        p_supplier_id: row.supplier_id ?? '',
        p_qty_requested: qtyNum,
        p_qty_suggested: suggested,
        p_estimated_arrival_at: arrivalDate ? new Date(arrivalDate).toISOString() : null,
        p_notes: notes.trim() || null,
        p_nivel_alerta: row.nivel_alerta,
      });
      if (error) throw error;
      toast({
        title: '✅ Pedido de reposição criado',
        description: `${qtyNum.toLocaleString('pt-BR')} un · ${row.supplier_name ?? '?'} · ${displaySku}`,
      });
      setQty('');
      setArrivalDate('');
      setNotes('');
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Erro ao criar pedido',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Pedir Reposição
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Resumo do SKU */}
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-0.5">
                <div className="font-semibold text-foreground">{displaySku}</div>
                <div className="text-muted-foreground">
                  {row.supplier_name ?? '—'} · Nível:{' '}
                  <span className="font-medium">{row.nivel_alerta}</span>
                </div>
                <div className="text-muted-foreground">
                  Cobertura:{' '}
                  {row.cobertura_dias !== null ? `${row.cobertura_dias.toFixed(1)}d` : '—'} · EMA:{' '}
                  {row.ema_diaria !== null ? `${row.ema_diaria.toFixed(2)}/dia` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label htmlFor="po-qty">
              Quantidade solicitada{' '}
              <span className="text-xs text-muted-foreground">
                (sugerida: {suggested.toLocaleString('pt-BR')})
              </span>
            </Label>
            <Input
              id="po-qty"
              type="number"
              min={1}
              placeholder={String(suggested)}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>

          {/* ETA */}
          <div className="space-y-1.5">
            <Label htmlFor="po-eta">
              Previsão de chegada{' '}
              <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="po-eta"
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="po-notes">
              Observações{' '}
              <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="po-notes"
              placeholder="Ex.: aguardando cotação, negociando desconto..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Criar Pedido
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
