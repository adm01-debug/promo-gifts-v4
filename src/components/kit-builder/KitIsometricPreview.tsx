/**
 * KitIsometricPreview — visualização 2.5D isométrica da caixa com itens
 * empilhados em proporção real. Indicador semântico de capacidade.
 */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KitState } from '@/lib/kit-builder/types';

interface KitIsometricPreviewProps {
  kitState: KitState;
  className?: string;
}

interface PlacedItem {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
}

// Paleta semântica determinística por id
const PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--accent))',
  'hsl(220 70% 60%)',
  'hsl(280 60% 60%)',
  'hsl(160 60% 50%)',
  'hsl(30 80% 60%)',
];

function colorFor(_id: string, idx: number): string {
  return PALETTE[idx % PALETTE.length];
}

// Bin packing 3D simplificado (shelf packing por camadas Y)
function packItems(
  boxW: number,
  boxH: number,
  boxD: number,
  items: Array<{ id: string; name: string; w: number; h: number; d: number; quantity: number }>,
): PlacedItem[] {
  const placed: PlacedItem[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let cursorZ = 0;
  let rowDepth = 0;
  let layerHeight = 0;
  let itemIdx = 0;

  for (const item of items) {
    const color = colorFor(item.id, itemIdx++);
    for (let q = 0; q < item.quantity; q++) {
      // Linha cheia? Avança em Z
      if (cursorX + item.w > boxW) {
        cursorX = 0;
        cursorZ += rowDepth;
        rowDepth = 0;
      }
      // Camada cheia? Sobe em Y
      if (cursorZ + item.d > boxD) {
        cursorZ = 0;
        cursorY += layerHeight;
        layerHeight = 0;
      }
      // Caixa cheia? Para
      if (cursorY + item.h > boxH) return placed;

      placed.push({
        id: `${item.id}-${q}`,
        name: item.name,
        color,
        x: cursorX,
        y: cursorY,
        w: item.w,
        h: item.h,
        d: item.d,
      });
      cursorX += item.w;
      rowDepth = Math.max(rowDepth, item.d);
      layerHeight = Math.max(layerHeight, item.h);
    }
  }
  return placed;
}

// Projeção isométrica 2.5D
function iso(x: number, y: number, z: number): { px: number; py: number } {
  const angle = Math.PI / 6; // 30°
  return {
    px: (x - z) * Math.cos(angle),
    py: (x + z) * Math.sin(angle) - y,
  };
}

export function KitIsometricPreview({ kitState, className }: KitIsometricPreviewProps) {
  const { box, items, volumeUsagePercent } = kitState;

  const layout = useMemo(() => {
    if (!box) return null;
    const placed = packItems(
      box.internalWidth,
      box.internalHeight,
      box.internalDepth,
      items.map((i) => ({
        id: i.id,
        name: i.name,
        w: Math.max(i.width, 1),
        h: Math.max(i.height, 1),
        d: Math.max(i.depth, 1),
        quantity: i.quantity,
      })),
    );
    return { placed, totalRequested: items.reduce((s, i) => s + i.quantity, 0) };
  }, [box, items]);

  if (!box) {
    return (
      <Card className={cn('flex items-center justify-center p-8 text-muted-foreground', className)}>
        <Package className="mr-2 h-5 w-5" /> Selecione uma caixa para visualizar
      </Card>
    );
  }

  const { internalWidth: bw, internalHeight: bh, internalDepth: bd } = box;
  const corners = [
    iso(0, 0, 0),
    iso(bw, 0, 0),
    iso(bw, 0, bd),
    iso(0, 0, bd),
    iso(0, bh, 0),
    iso(bw, bh, 0),
    iso(bw, bh, bd),
    iso(0, bh, bd),
  ];
  const xs = corners.map((c) => c.px);
  const ys = corners.map((c) => c.py);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const pad = 12;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;
  const tx = -minX + pad;
  const ty = -minY + pad;

  // Cor semântica do status
  const statusColor =
    volumeUsagePercent > 100
      ? 'destructive'
      : volumeUsagePercent > 85
        ? 'warning'
        : volumeUsagePercent > 50
          ? 'primary'
          : 'muted';
  const statusLabel =
    volumeUsagePercent > 100
      ? 'Excedido'
      : volumeUsagePercent > 85
        ? 'Quase cheio'
        : volumeUsagePercent > 50
          ? 'Bom uso'
          : 'Sobra espaço';

  // Helpers para faces de cubo
  const facePath = (pts: Array<{ px: number; py: number }>) =>
    `${pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.px + tx).toFixed(1)},${(p.py + ty).toFixed(1)}`)
      .join(' ')} Z`;

  // Caixa: face traseira-direita + base + lateral
  const boxBack = facePath([corners[1], corners[2], corners[6], corners[5]]);
  const boxLeft = facePath([corners[0], corners[3], corners[7], corners[4]]);
  const boxBottom = facePath([corners[0], corners[1], corners[2], corners[3]]);

  // Itens — desenhar do mais distante (z+x maior) ao mais próximo, baixo→alto
  const sorted = layout
    ? [...layout.placed].sort((a, b) => a.y - b.y || b.x + b.d - (a.x + a.d))
    : [];

  const placedCount = sorted.length;
  const totalRequested = layout?.totalRequested ?? 0;
  const overflowCount = Math.max(0, totalRequested - placedCount);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Package className="h-4 w-4 text-primary" />
            Preview da Caixa
          </h3>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px]',
              statusColor === 'destructive' && 'border-destructive text-destructive',
              statusColor === 'warning' && 'border-warning text-warning',
              statusColor === 'primary' && 'border-primary text-primary',
            )}
          >
            {volumeUsagePercent.toFixed(0)}% — {statusLabel}
          </Badge>
        </div>

        <div className="flex items-center justify-center rounded-lg bg-muted/30 p-2">
          <svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            className="h-auto max-h-[280px] w-full"
            role="img"
            aria-label={`Visualização isométrica da caixa ${box.name} com ${placedCount} itens`}
          >
            {/* Faces da caixa (vazia/wireframe) */}
            <path
              d={boxBottom}
              fill="hsl(var(--muted))"
              fillOpacity="0.4"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
            <path
              d={boxBack}
              fill="hsl(var(--muted))"
              fillOpacity="0.25"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
            <path
              d={boxLeft}
              fill="hsl(var(--muted))"
              fillOpacity="0.3"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />

            {/* Itens empilhados */}
            {sorted.map((p) => {
              const c100 = iso(p.x + p.w, p.y, 0);
              const c101 = iso(p.x + p.w, p.y, p.d);
              const c001 = iso(p.x, p.y, p.d);
              const c010 = iso(p.x, p.y + p.h, 0);
              const c110 = iso(p.x + p.w, p.y + p.h, 0);
              const c111 = iso(p.x + p.w, p.y + p.h, p.d);
              const c011 = iso(p.x, p.y + p.h, p.d);

              const top = facePath([c010, c110, c111, c011]);
              const right = facePath([c110, c100, c101, c111]);
              const front = facePath([c011, c111, c101, c001]);

              return (
                <g key={p.id}>
                  <title>{p.name}</title>
                  <path
                    d={right}
                    fill={p.color}
                    fillOpacity="0.65"
                    stroke="hsl(var(--background))"
                    strokeWidth="0.6"
                  />
                  <path
                    d={front}
                    fill={p.color}
                    fillOpacity="0.85"
                    stroke="hsl(var(--background))"
                    strokeWidth="0.6"
                  />
                  <path
                    d={top}
                    fill={p.color}
                    fillOpacity="1"
                    stroke="hsl(var(--background))"
                    strokeWidth="0.6"
                  />
                </g>
              );
            })}

            {/* Borda superior (wireframe) */}
            <path
              d={facePath([corners[4], corners[5], corners[6], corners[7]])}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
          </svg>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {bw}×{bh}×{bd} cm — {box.name}
          </span>
          <span>
            {placedCount}/{totalRequested} itens visíveis
            {overflowCount > 0 && (
              <span className="ml-1 text-destructive">(+{overflowCount} fora)</span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
