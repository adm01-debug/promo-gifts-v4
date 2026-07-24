/**
 * Kit Conflict Alerts
 * Real-time intelligent validations beyond stock/volume:
 * - Thermal items (chocolate, food) without thermal/insulated box
 * - Weight near/over freight economy threshold
 * - Fragile items without protective packaging
 */
import { AlertTriangle, Lightbulb, Snowflake, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { KitState } from '@/lib/kit-builder';

interface KitConflictAlertsProps {
  kitState: KitState;
}

interface Conflict {
  id: string;
  severity: 'danger' | 'info' | 'warning';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  suggestion: string;
}

const THERMAL_KEYWORDS = [
  'chocolate',
  'bombom',
  'trufa',
  'food',
  'alimento',
  'doce',
  'biscoito',
  'café',
  'cafe',
];
const FRAGILE_KEYWORDS = ['vidro', 'porcelana', 'cerâmica', 'ceramica', 'cristal', 'garrafa'];
const THERMAL_BOX_KEYWORDS = ['térmic', 'termic', 'isolad', 'thermal', 'isotérmic'];
const PROTECTIVE_BOX_KEYWORDS = [
  'rígid',
  'rigid',
  'lata',
  'metal',
  'madeira',
  'mdf',
  'kraft duplo',
];
const ECONOMY_FREIGHT_LIMIT_G = 5000; // 5kg per kit, simplified

function detectConflicts(kitState: KitState): Conflict[] {
  const out: Conflict[] = [];
  const { box, items, totalWeight } = kitState;

  // Thermal
  const thermalItems = items.filter((i) => {
    const text = `${i.name} ${i.category ?? ''}`.toLowerCase();
    return THERMAL_KEYWORDS.some((k) => text.includes(k));
  });
  if (thermalItems.length > 0 && box) {
    const boxText = `${box.name} ${box.material ?? ''} ${box.boxType ?? ''}`.toLowerCase();
    const isThermal = THERMAL_BOX_KEYWORDS.some((k) => boxText.includes(k));
    if (!isThermal) {
      out.push({
        id: 'thermal-mismatch',
        severity: 'warning',
        icon: Snowflake,
        title: `Itens sensíveis a calor (${thermalItems.length}) em embalagem comum`,
        suggestion:
          'Considere uma caixa térmica ou isolada para preservar a qualidade no transporte.',
      });
    }
  }

  // Fragile
  const fragileItems = items.filter((i) => {
    const text = `${i.name} ${i.material ?? ''}`.toLowerCase();
    return FRAGILE_KEYWORDS.some((k) => text.includes(k));
  });
  if (fragileItems.length > 0 && box) {
    const boxText = `${box.name} ${box.boxType ?? ''}`.toLowerCase();
    const isProtective = PROTECTIVE_BOX_KEYWORDS.some((k) => boxText.includes(k));
    if (!isProtective) {
      out.push({
        id: 'fragile-mismatch',
        severity: 'info',
        icon: AlertTriangle,
        title: `${fragileItems.length} item(ns) frágeis detectado(s)`,
        suggestion: 'Recomenda-se papel bolha ou enchimento adicional para garantir a integridade.',
      });
    }
  }

  // Freight weight
  if (totalWeight > ECONOMY_FREIGHT_LIMIT_G) {
    out.push({
      id: 'freight-economy',
      severity: 'warning',
      icon: Truck,
      title: `Peso por kit (${(totalWeight / 1000).toFixed(2)} kg) acima do frete econômico`,
      suggestion:
        'Avalie reduzir itens pesados ou considerar transportadora dedicada para grandes volumes.',
    });
  }

  return out;
}

export function KitConflictAlerts({ kitState }: KitConflictAlertsProps) {
  const conflicts = detectConflicts(kitState);
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2">
      {conflicts.map((c) => {
        const Icon = c.icon;
        const tone =
          c.severity === 'danger'
            ? 'border-destructive/40 bg-destructive/5'
            : c.severity === 'warning'
              ? 'border-warning/40 bg-warning/5'
              : 'border-primary/30 bg-primary/5';
        const iconTone =
          c.severity === 'danger'
            ? 'text-destructive'
            : c.severity === 'warning'
              ? 'text-warning'
              : 'text-primary';
        return (
          <Card key={c.id} className={cn('border-[1.5px]', tone)}>
            <CardContent className="flex items-start gap-3 p-3">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconTone)} />
              <div className="space-y-0.5 text-sm">
                <p className="font-medium leading-tight">{c.title}</p>
                <p className="flex items-start gap-1 text-xs text-muted-foreground">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{c.suggestion}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
