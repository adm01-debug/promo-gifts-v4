import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, TrendingUp, TrendingDown, Minus, GitCompare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { QuoteVersion } from '@/hooks/quotes';
import { formatCurrency } from '@/lib/format';

interface QuoteItem {
  id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number | null;
  color_name: string | null;
}

interface QuoteDetail {
  id: string;
  quote_number: string;
  version: number;
  status: string;
  subtotal: number;
  total: number;
  discount_amount: number;
  discount_percent: number;
  shipping_cost: number | null;
  payment_terms: string | null;
  delivery_time: string | null;
  notes: string | null;
  created_at: string;
  items: QuoteItem[];
}

interface QuoteVersionCompareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: QuoteVersion[];
  currentQuoteId?: string;
}

function DiffBadge({
  oldVal,
  newVal,
  format: fmt,
}: {
  oldVal: number;
  newVal: number;
  format?: (v: number) => string;
}) {
  const diff = newVal - oldVal;
  const formatted = fmt ? fmt(Math.abs(diff)) : Math.abs(diff).toString();
  if (diff === 0)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Minus className="mr-1 h-3 w-3" />
        Igual
      </Badge>
    );
  if (diff > 0)
    return (
      <Badge className="border-primary/30 bg-primary/15 text-primary">
        <TrendingUp className="mr-1 h-3 w-3" />+{formatted}
      </Badge>
    );
  return (
    <Badge className="border-destructive/20 bg-destructive/15 text-destructive">
      <TrendingDown className="mr-1 h-3 w-3" />-{formatted}
    </Badge>
  );
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
} as const;

export function QuoteVersionCompare({
  open,
  onOpenChange,
  versions,
  currentQuoteId: _currentQuoteId,
}: QuoteVersionCompareProps) {
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [leftDetail, setLeftDetail] = useState<QuoteDetail | null>(null);
  const [rightDetail, setRightDetail] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (versions.length >= 2) {
      setLeftId(versions[versions.length - 2].id);
      setRightId(versions[versions.length - 1].id);
    }
  }, [versions]);

  useEffect(() => {
    if (!leftId || !rightId) return;
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftId, rightId]);

  async function loadDetails() {
    setLoading(true);
    try {
      const [left, right] = await Promise.all([
        fetchQuoteDetail(leftId),
        fetchQuoteDetail(rightId),
      ]);
      setLeftDetail(left);
      setRightDetail(right);
    } finally {
      setLoading(false);
    }
  }

  async function fetchQuoteDetail(id: string): Promise<QuoteDetail | null> {
    const { data: quote } = await supabase
      // rls-allow: lookup por id específico; RLS valida ownership
      .from('quotes')
      .select(
        'id, quote_number, version, status, subtotal, total, discount_amount, discount_percent, shipping_cost, payment_terms, delivery_time, notes, created_at',
      )
      .eq('id', id)
      .single();

    if (!quote) return null;

    const { data: items } = await supabase
      .from('quote_items')
      .select('id, product_name, product_sku, quantity, unit_price, subtotal, color_name')
      .eq('quote_id', id)
      .order('sort_order', { ascending: true });

    return { ...quote, items: items || [] } as QuoteDetail;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Comparar Versões do Orçamento
          </DialogTitle>
        </DialogHeader>

        {/* Version selectors */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Versão A</label>
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar versão" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} — {v.quote_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="mt-5 h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Versão B</label>
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar versão" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} — {v.quote_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && <div className="py-8 text-center text-muted-foreground">Carregando...</div>}

        {leftDetail && rightDetail && !loading && (
          <div className="space-y-4">
            {/* Summary comparison */}
            <div className="grid grid-cols-2 gap-4">
              {[leftDetail, rightDetail].map((detail, idx) => (
                <Card key={detail.id} className={idx === 1 ? 'border-primary/30' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>
                        v{detail.version} — {detail.quote_number}
                      </span>
                      <Badge variant={detail.status === 'approved' ? 'default' : 'outline'}>
                        {QUOTE_STATUS_LABELS[detail.status] || detail.status}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(detail.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(detail.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Desconto</span>
                      <span>
                        {detail.discount_percent}% ({formatCurrency(detail.discount_amount)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete</span>
                      <span>{formatCurrency(detail.shipping_cost || 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(detail.total)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Itens</span>
                      <span>{detail.items.length}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Differences summary */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Diferenças</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <DiffBadge
                    oldVal={leftDetail.total}
                    newVal={rightDetail.total}
                    format={formatCurrency}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Itens:</span>
                  <DiffBadge oldVal={leftDetail.items.length} newVal={rightDetail.items.length} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Desconto:</span>
                  <DiffBadge
                    oldVal={leftDetail.discount_percent}
                    newVal={rightDetail.discount_percent}
                    format={(v) => `${v}%`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Items comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Itens do Orçamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[leftDetail, rightDetail].map((detail) => (
                    <div key={detail.id} className="space-y-2">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        v{detail.version}
                      </p>
                      {detail.items.map((item, _i) => {
                        const otherDetail = detail === leftDetail ? rightDetail : leftDetail;
                        const otherItem = otherDetail.items.find(
                          (oi) => oi.product_sku === item.product_sku,
                        );
                        const isNew = !otherItem;
                        const changed =
                          otherItem &&
                          (otherItem.quantity !== item.quantity ||
                            otherItem.unit_price !== item.unit_price);

                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-2 text-xs ${isNew ? 'bg-success/5/50 border-success/30 dark:bg-success/10' : changed ? 'bg-warning/5/50 border-warning/30 dark:bg-warning/10' : 'border-border'}`}
                          >
                            <p className="truncate font-medium">{item.product_name}</p>
                            <div className="mt-1 flex justify-between text-muted-foreground">
                              <span>
                                {item.quantity}x {formatCurrency(item.unit_price)}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(item.subtotal || item.quantity * item.unit_price)}
                              </span>
                            </div>
                            {isNew && (
                              <Badge className="mt-1 h-4 bg-primary text-[10px]">Novo</Badge>
                            )}
                            {changed && (
                              <Badge className="mt-1 h-4 bg-warning text-[10px]">Alterado</Badge>
                            )}
                          </div>
                        );
                      })}
                      {detail.items.length === 0 && (
                        <p className="text-xs italic text-muted-foreground">Nenhum item</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
