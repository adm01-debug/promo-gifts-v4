import React, { useState, useCallback } from 'react';
import {
  Package,
  Palette,
  Settings2,
  Weight,
  Eye,
  Layers,
  ChevronUp,
  ChevronDown,
  Tag,
  FileText,
  Hash,
  Copy,
  CheckCheck,
  Box,
  Utensils,
  ArrowUpDown,
  ArrowLeftRight,
  MoveHorizontal,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';
import type { KitComponent } from '@/types/product-catalog';

// BUG-KIT-02 FIX (2026-06-21): formatWeight era recriada dentro de KitComponentCard
// em cada render. Movida para módulo — função pura sem deps de props/state.
const formatWeight = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`);

/* ── Copy Button ── */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [text],
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-muted"
            aria-label="Copiar"
          >
            {copied ? (
              <CheckCheck className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{copied ? 'Copiado!' : 'Copiar'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── Smart Badge ── */
export function SmartBadge({
  children,
  tooltip,
  className,
  icon: Icon,
}: {
  children: React.ReactNode;
  tooltip: string;
  className?: string;
  icon?: React.ElementType;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('cursor-help gap-1 px-2 py-0.5 text-[10px]', className)}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {children}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── Kit Component Card ── */
export interface KitComponentCardProps {
  item: KitComponent;
  index: number;
  variant: 'item' | 'packaging';
  onViewProduct?: (productId: string) => void;
  onZoomImage?: (url: string) => void;
}

export function KitComponentCard({
  item,
  index,
  variant,
  onViewProduct,
  onZoomImage,
}: KitComponentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDimensions =
    (item.heightMm ?? 0) > 0 ||
    (item.widthMm ?? 0) > 0 ||
    (item.lengthMm ?? 0) > 0 ||
    (item.diameterMm ?? 0) > 0 ||
    (item.circumferenceMm ?? 0) > 0;
  const hasExpandableInfo = item.description || item.personalizationNotes;
  const hasSpecs = hasDimensions || (item.weightG ?? 0) > 0 || (item.volumeMl ?? 0) > 0;
  const isPackaging = variant === 'packaging';
  const borderColor = isPackaging ? 'border-warning/25' : 'border-border';
  // Galeria extra (além da capa): mostra mini-thumbs clicáveis se houver >1 foto.
  const extraImages = (item.images ?? []).filter((url) => url && url !== item.imageUrl);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-all',
        cn(borderColor, 'bg-card hover:shadow-sm'),
      )}
    >
      {/* Header Row */}
      <div
        className="group flex cursor-pointer items-start gap-3.5 px-4 pb-3 pt-4"
        onClick={() => hasExpandableInfo && setExpanded(!expanded)}
      >
        <div className="shrink-0">
          <div className="relative">
            <div
              className={cn(
                'flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border',
                isPackaging ? 'border-warning/20 bg-warning/5' : 'border-border/50 bg-muted/60',
                item.imageUrl && 'cursor-zoom-in transition-all hover:ring-2 hover:ring-primary/40',
              )}
              onClick={(e) => {
                if (item.imageUrl && onZoomImage) {
                  e.stopPropagation();
                  onZoomImage(item.imageUrl);
                }
              }}
            >
              {item.imageUrl ? (
                <OptimizedImage
                  src={getCdnUrl(item.imageUrl, 'thumbnail')}
                  alt={item.productName}
                  className="object-contain p-1"
                  containerClassName="h-full w-full"
                />
              ) : isPackaging ? (
                <Box className="h-7 w-7 text-warning/40 dark:text-warning/40" />
              ) : (
                <Utensils className="h-6 w-6 text-muted-foreground/30" />
              )}
            </div>
            <div className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted">
              <span className="text-[9px] font-bold tabular-nums text-muted-foreground">
                {index}
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <Badge
                variant="secondary"
                className="shrink-0 border-0 bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary"
              >
                {item.quantity}x
              </Badge>
              <h4 className="text-sm font-semibold leading-tight text-foreground">
                {item.productName}
              </h4>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {hasExpandableInfo && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Expandir"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                >
                  {expanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              )}
              {onViewProduct && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Visualizar"
                        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewProduct(item.productId);
                        }}
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Ver produto</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {item.sku && (
              <span className="flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 font-mono">
                SKU: {item.sku}
                <CopyButton text={item.sku} />
              </span>
            )}
            {item.supplierComponentCode && (
              <span className="flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 font-mono">
                <Tag className="h-3 w-3 opacity-50" />
                {item.supplierComponentCode}
                <CopyButton text={item.supplierComponentCode} />
              </span>
            )}
            {item.componentTypeCode && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3 opacity-50" />
                {item.componentTypeCode}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {item.isPackaging && (
              <SmartBadge
                icon={Package}
                tooltip="Este componente é a embalagem do kit."
                className="border-warning/30 bg-warning/10 text-warning dark:text-warning"
              >
                Embalagem
              </SmartBadge>
            )}
            {item.isOptional && (
              <SmartBadge
                tooltip="Item opcional — pode ser removido do kit."
                className="border-primary/30 bg-primary/10 text-primary"
              >
                Opcional
              </SmartBadge>
            )}
            {item.isReplaceable && (
              <SmartBadge
                icon={Settings2}
                tooltip="Item substituível."
                className="border-primary/25 bg-primary/15 text-primary/80"
              >
                Substituível
              </SmartBadge>
            )}
            {item.allowsPersonalization && (
              <SmartBadge
                icon={Palette}
                tooltip="Aceita personalização."
                className="border-primary/30 bg-primary/5 text-primary"
              >
                Personalizável
              </SmartBadge>
            )}
            {item.color && (
              <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[10px]">
                Cor: {item.color}
              </Badge>
            )}
            <SmartBadge
              icon={Layers}
              tooltip="Material principal do item."
              className="border-border bg-muted/40 text-foreground"
            >
              {item.material || '—'}
            </SmartBadge>
          </div>
        </div>
      </div>

      {/* Specs */}
      {hasSpecs && (
        <div className="px-4 pb-2.5">
          <div className="flex items-center gap-1 divide-x divide-border rounded-lg border border-border bg-muted/20 px-1 py-0.5">
            {(item.heightMm ?? 0) > 0 && (
              <div className="flex min-w-0 items-center gap-1 px-2 py-0.5">
                <ArrowUpDown className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-[10px] text-muted-foreground">Altura</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  {item.heightMm}
                  <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">mm</span>
                </span>
              </div>
            )}
            {(item.widthMm ?? 0) > 0 && (
              <div className="flex min-w-0 items-center gap-1 px-2 py-0.5">
                <ArrowLeftRight className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-[10px] text-muted-foreground">Largura</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  {item.widthMm}
                  <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">mm</span>
                </span>
              </div>
            )}
            {(item.lengthMm ?? 0) > 0 && (
              <div className="flex min-w-0 items-center gap-1 px-2 py-0.5">
                <MoveHorizontal className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-[10px] text-muted-foreground">Prof.</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  {item.lengthMm}
                  <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">mm</span>
                </span>
              </div>
            )}
            {(item.diameterMm ?? 0) > 0 && (
              <div className="flex min-w-0 items-center gap-1 px-2 py-0.5">
                <Circle className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-[10px] text-muted-foreground">Diâm.</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  {item.diameterMm}
                  <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">mm</span>
                </span>
              </div>
            )}
            {(item.circumferenceMm ?? 0) > 0 && (item.diameterMm ?? 0) === 0 && (
              <div className="flex min-w-0 items-center gap-1 px-2 py-0.5">
                <Circle className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-[10px] text-muted-foreground">Circ.</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  {item.circumferenceMm}
                  <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">mm</span>
                </span>
              </div>
            )}
            {(item.weightG ?? 0) > 0 && (
              <div className="flex min-w-0 items-center gap-1 px-2 py-0.5">
                <Weight className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-[10px] text-muted-foreground">Peso</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  {formatWeight(item.weightG ?? 0)}
                </span>
              </div>
            )}
            {(item.volumeMl ?? 0) > 0 && (
              <div className="flex min-w-0 items-center gap-1 px-2 py-0.5">
                <Box className="h-3 w-3 shrink-0 text-primary" />
                <span className="text-[10px] text-muted-foreground">Vol.</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  {item.volumeMl}
                  <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">ml</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mini-galeria: fotos adicionais do componente (kit nativo) */}
      {extraImages.length > 0 && (
        <div className="px-4 pb-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3 w-3" />+{extraImages.length}{' '}
            {extraImages.length === 1 ? 'foto' : 'fotos'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {extraImages.slice(0, 6).map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onZoomImage) onZoomImage(url);
                }}
                aria-label={`Ver foto ${i + 2} de ${item.productName}`}
                className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted/40 transition-all hover:ring-2 hover:ring-primary/40"
              >
                <OptimizedImage
                  src={getCdnUrl(url, 'thumbnail')}
                  alt={`${item.productName} — foto ${i + 2}`}
                  className="object-cover"
                  containerClassName="h-full w-full"
                />
              </button>
            ))}
            {extraImages.length > 6 && (
              <span className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-[10px] font-semibold text-muted-foreground">
                +{extraImages.length - 6}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expandable Details */}
      {expanded && hasExpandableInfo && (
        <div className="space-y-3 border-t border-border/50 px-4 pb-4 duration-200 animate-in slide-in-from-top-1">
          {item.description && (
            <div className="pt-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3 w-3" />
                Descrição
              </div>
              <p className="whitespace-pre-line rounded-lg bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground/90">
                {item.description}
              </p>
            </div>
          )}
          {item.personalizationNotes && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Palette className="h-3 w-3" />
                Notas de Personalização
              </div>
              <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {item.personalizationNotes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
