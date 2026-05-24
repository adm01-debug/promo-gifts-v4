import { Box, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { KitComponent, BoxInternalDimensions } from './types';

export function VolumeValidation({
  components,
  boxDimensions,
}: {
  components: KitComponent[];
  boxDimensions?: BoxInternalDimensions;
}) {
  const boxH = boxDimensions?.height_cm ? boxDimensions.height_cm * 10 : null;
  const boxW = boxDimensions?.width_cm ? boxDimensions.width_cm * 10 : null;
  const boxL = boxDimensions?.length_cm ? boxDimensions.length_cm * 10 : null;

  const hasBoxDimensions = boxH && boxW && boxL;
  const boxVolumeMm3 = hasBoxDimensions ? boxH * boxW * boxL : null;

  const componentVolumes = components
    .filter((c) => !c.is_packaging && c.is_active)
    .map((c) => {
      const h = c.height_mm ?? 0;
      const w = c.width_mm ?? 0;
      const l = c.length_mm ?? 0;
      const vol = h * w * l;
      const qty = c.quantity ?? 1;
      return {
        ...c,
        unitVolume: vol,
        totalVolume: vol * qty,
        hasDimensions: h > 0 && w > 0 && l > 0,
      };
    });

  const totalComponentsVolume = componentVolumes.reduce((sum, c) => sum + c.totalVolume, 0);
  const totalWeight = components
    .filter((c) => c.is_active)
    .reduce((sum, c) => sum + (c.weight_g ?? 0) * (c.quantity ?? 1), 0);
  const missingDimensions = componentVolumes.filter((c) => !c.hasDimensions);

  if (!hasBoxDimensions) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Box className="h-4 w-4 shrink-0" />
        <span>
          Preencha as <strong>dimensões internas</strong> na aba Detalhes para validar volume dos
          componentes.
        </span>
      </div>
    );
  }

  const usagePercent = boxVolumeMm3 ? Math.round((totalComponentsVolume / boxVolumeMm3) * 100) : 0;
  const fits = usagePercent <= 100;

  const checkItemFits = (h: number, w: number, l: number) => {
    if (!boxH || !boxW || !boxL) return true;
    const dims = [h, w, l].sort((a, b) => a - b);
    const boxDims = [boxH, boxW, boxL].sort((a, b) => a - b);
    return dims[0] <= boxDims[0] && dims[1] <= boxDims[1] && dims[2] <= boxDims[2];
  };

  return (
    <div
      className={cn(
        'space-y-2.5 rounded-lg border p-3 text-xs',
        fits ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Validação de Volume</span>
        </div>
        <div className="flex items-center gap-1.5">
          {fits ? (
            <Badge
              variant="outline"
              className="gap-1 border-success/50 bg-success/10 px-1.5 py-0 text-[10px] text-success"
            >
              <CheckCircle2 className="h-3 w-3" /> CABE
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-destructive/50 bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive"
            >
              <XCircle className="h-3 w-3" /> NÃƒO CABE
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            Volume usado:{' '}
            <strong className="text-foreground">
              {(totalComponentsVolume / 1000).toFixed(0)} cm³
            </strong>{' '}
            / {(boxVolumeMm3! / 1000).toFixed(0)} cm³
          </span>
          <span className={cn('font-bold', fits ? 'text-success' : 'text-destructive')}>
            {usagePercent}%
          </span>
        </div>
        <Progress
          value={Math.min(usagePercent, 100)}
          className={cn('h-2', !fits && '[&>div]:bg-destructive')}
        />
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          Caixa interna: {boxW?.toFixed(0)}Ã—{boxL?.toFixed(0)}Ã—{boxH?.toFixed(0)} mm
        </span>
        {totalWeight > 0 && <span>â€¢ Peso total: {(totalWeight / 1000).toFixed(2)} kg</span>}
      </div>

      {componentVolumes.length > 0 && (
        <div className="space-y-1 border-t border-border/50 pt-1">
          {componentVolumes.map((c) => {
            const itemFits = c.hasDimensions
              ? checkItemFits(c.height_mm ?? 0, c.width_mm ?? 0, c.length_mm ?? 0)
              : null;
            return (
              <div key={c.id} className="flex items-center justify-between text-[10px]">
                <span className="flex-1 truncate text-muted-foreground">
                  {c.component_name || 'Sem nome'} {(c.quantity ?? 1) > 1 ? `Ã—${c.quantity}` : ''}
                </span>
                {c.hasDimensions ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                      {c.width_mm}Ã—{c.length_mm}Ã—{c.height_mm} mm
                    </span>
                    {itemFits ? (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                  </div>
                ) : (
                  <span className="italic text-warning">sem dimensões</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {missingDimensions.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-warning">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {missingDimensions.length} componente(s) sem dimensões â€” o cálculo pode ser impreciso.
        </div>
      )}
    </div>
  );
}
