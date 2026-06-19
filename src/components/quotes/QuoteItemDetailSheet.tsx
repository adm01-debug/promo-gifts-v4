import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Info,
  Palette,
  Ruler,
  MapPin,
  Layers,
  DollarSign,
  Package,
  Wrench,
  TrendingDown,
} from 'lucide-react';

const QUANTITY_TIERS = [
  { min: 1, max: 9 },
  { min: 10, max: 24 },
  { min: 25, max: 49 },
  { min: 50, max: 99 },
  { min: 100, max: 249 },
  { min: 250, max: 499 },
  { min: 500, max: 999 },
  { min: 1000, max: null },
];

interface Personalization {
  technique_name?: string;
  technique_id?: string;
  colors_count?: number;
  width_cm?: number;
  height_cm?: number;
  area_cm2?: number;
  setup_cost?: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  [key: string]: unknown;
}

interface QuoteItem {
  product_name: string;
  product_sku?: string;
  product_image_url?: string;
  color_name?: string;
  color_hex?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  personalizations?: Personalization[];
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseNotesField(notes: string) {
  const [locationPart, dimPart] = notes.split(' | ');
  const locationSegments = locationPart?.split(' — ') ?? [];
  const location = locationSegments[0] || null;
  const code = locationSegments[1] || null;
  let dimensions: string | null = null;
  if (dimPart) {
    dimensions = dimPart.replace('cm', ' cm');
  }
  return { location, code, dimensions };
}

function getNextTier(qty: number) {
  for (const tier of QUANTITY_TIERS) {
    if (tier.min > qty) {
      return tier;
    }
  }
  return null;
}

function getCurrentTierLabel(qty: number) {
  for (let i = QUANTITY_TIERS.length - 1; i >= 0; i--) {
    if (qty >= QUANTITY_TIERS[i].min) {
      const t = QUANTITY_TIERS[i];
      return t.max ? `${t.min}-${t.max}` : `${t.min}+`;
    }
  }
  return '1-9';
}

/** Component that fetches and shows next tier pricing */
function NextTierHint({ currentQty }: { currentQty: number }) {
  const nextTier = getNextTier(currentQty);

  if (!nextTier) return null;

  const unitsNeeded = nextTier.min - currentQty;
  const nextTierLabel = nextTier.max ? `${nextTier.min}-${nextTier.max}` : `${nextTier.min}+`;

  return (
    <div className="space-y-2 rounded-lg border border-accent bg-accent/50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <TrendingDown className="h-3.5 w-3.5 text-primary" />
        Próxima faixa de desconto
      </div>
      <div className="text-xs text-muted-foreground">
        Faltam{' '}
        <span className="font-bold text-foreground">
          {unitsNeeded} {unitsNeeded === 1 ? 'unidade' : 'unidades'}
        </span>{' '}
        para a faixa de <span className="font-bold text-foreground">{nextTierLabel} un</span>
      </div>
    </div>
  );
}
export function QuoteItemDetailSheet({ item }: { item: QuoteItem }) {
  const personalizations = item.personalizations ?? [];
  const allInUnit =
    item.unit_price +
    personalizations.reduce((sum, p) => {
      const pTotal = p.total_cost ?? 0;
      return sum + (item.quantity > 0 ? Math.round((pTotal / item.quantity) * 100) / 100 : 0);
    }, 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary/80"
        >
          <Info className="h-3.5 w-3.5" />
          Detalhes
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left">Detalhes do Item</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Product Info */}
          <div className="flex items-start gap-3">
            {item.product_image_url && (
              <img
                src={item.product_image_url}
                alt={item.product_name}
                className="h-16 w-16 rounded-lg border border-border object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              {item.product_sku && (
                <span
                  className="mb-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs"
                  style={{
                    backgroundColor: item.color_hex ? `${item.color_hex}22` : undefined,
                    borderColor: item.color_hex || 'hsl(var(--border))',
                    color: item.color_hex || 'hsl(var(--foreground))',
                  }}
                >
                  {item.color_hex && (
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-border/50"
                      style={{ backgroundColor: item.color_hex }}
                    />
                  )}
                  {item.product_sku}
                  {item.color_name ? `-${item.color_name}` : ''}
                </span>
              )}
              <p className="font-semibold text-foreground">{item.product_name}</p>
              {!item.product_sku && item.color_name && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {item.color_hex && (
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-border"
                      style={{ backgroundColor: item.color_hex }}
                    />
                  )}
                  <span className="text-sm text-muted-foreground">{item.color_name}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Pricing Summary */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <DollarSign className="h-4 w-4 text-primary" />
              Preços
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço unitário (produto)</span>
                <span className="font-medium">{fmt(item.unit_price)}</span>
              </div>
              {personalizations.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço unitário (gravação)</span>
                  <span className="font-medium">
                    {fmt(
                      personalizations.reduce((sum, p) => {
                        const pTotal = p.total_cost ?? 0;
                        return (
                          sum +
                          (item.quantity > 0 ? Math.round((pTotal / item.quantity) * 100) / 100 : 0)
                        );
                      }, 0),
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
                <span className="text-foreground">Unitário all-in</span>
                <span className="text-primary">{fmt(allInUnit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantidade</span>
                <span className="font-medium">
                  {item.quantity}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    (faixa {getCurrentTierLabel(item.quantity)} un)
                  </span>
                </span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2 font-semibold">
                <span className="text-foreground">Total do item</span>
                <span className="text-foreground">
                  {fmt(Math.round(allInUnit * item.quantity * 100) / 100)}
                </span>
              </div>
            </div>
          </div>

          {/* Personalizations Detail */}
          {personalizations.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-primary" />
                  Personalização ({personalizations.length})
                </h4>
                <div className="space-y-4">
                  {personalizations.map((p, idx) => {
                    const parsed = parseNotesField(p.notes ?? '');
                    const unitRounded =
                      item.quantity > 0
                        ? Math.round(((p.total_cost ?? 0) / item.quantity) * 100) / 100
                        : 0;
                    const totalRounded = Math.round(unitRounded * item.quantity * 100) / 100;

                    return (
                      <div
                        key={`${p.technique_id || p.technique_name}-${idx}`}
                        className="space-y-3"
                      >
                        <div className="space-y-2.5 rounded-lg border border-border/50 bg-muted/50 p-3">
                          {/* Technique */}
                          <div className="flex items-center gap-2">
                            <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                              ✦ {p.technique_name || 'Gravação'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {parsed.location && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Local:</span>
                                <span className="font-medium text-foreground">
                                  {parsed.location}
                                </span>
                              </div>
                            )}
                            {parsed.code && (
                              <div className="flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Código:</span>
                                <span className="font-mono font-medium text-foreground">
                                  {parsed.code}
                                </span>
                              </div>
                            )}
                            {(parsed.dimensions || (p.width_cm && p.height_cm)) && (
                              <div className="flex items-center gap-1.5">
                                <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Tamanho:</span>
                                <span className="font-medium text-foreground">
                                  {parsed.dimensions || `${p.width_cm}×${p.height_cm} cm`}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Cores:</span>
                              <span className="font-medium text-foreground">
                                {p.colors_count || 1}
                              </span>
                            </div>
                            {p.area_cm2 && (
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Área:</span>
                                <span className="font-medium text-foreground">
                                  {p.area_cm2} cm²
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Costs */}
                          <Separator className="my-1" />
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="block text-muted-foreground">Unitário</span>
                              <span className="font-semibold text-foreground">
                                {fmt(unitRounded)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground">Setup</span>
                              <span className="font-semibold text-foreground">
                                {fmt(p.setup_cost ?? 0)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground">Total</span>
                              <span className="font-semibold text-primary">
                                {fmt(totalRounded)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Next Tier Hint */}
                        {getNextTier(item.quantity) && <NextTierHint currentQty={item.quantity} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Item Notes */}
          {item.notes && !item.notes.includes('|||') && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Observações</h4>
                <p className="text-sm text-muted-foreground">{item.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
