/**
 * TechniqueCard helpers — Constantes, estilos e sub-componentes extraídos
 */
import { Clock, DollarSign, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, type TechniqueWithRecommendation } from '@/hooks/simulation';

// Miniaturas de exemplo por categoria de técnica
export const TECHNIQUE_THUMBNAILS: Record<string, string> = {
  SILK: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=100&h=100&fit=crop',
  SERIGRAFIA: 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=100&h=100&fit=crop',
  DTF: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=100&h=100&fit=crop',
  SUB: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=100&h=100&fit=crop',
  BORD: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=100&h=100&fit=crop',
  LASER: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100&h=100&fit=crop',
  TRANSFER: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=100&h=100&fit=crop',
  UV: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=100&h=100&fit=crop',
};

export function getTechniqueStyle(code: string) {
  const c = code?.toUpperCase() ?? '';
  if (c.includes('SILK') || c.includes('SERIGRAFIA'))
    return { color: 'bg-primary', textColor: 'text-primary', icon: '🎨' };
  if (c.includes('DTF')) return { color: 'bg-info', textColor: 'text-info', icon: '🖨️' };
  if (c.includes('SUB') || c.includes('TRANSFER'))
    return { color: 'bg-primary', textColor: 'text-primary', icon: '🌈' };
  if (c.includes('BORD') || c.includes('EMBROID'))
    return { color: 'bg-warning', textColor: 'text-warning', icon: '🧵' };
  if (c.includes('LASER'))
    return { color: 'bg-destructive', textColor: 'text-destructive', icon: '⚡' };
  if (c.includes('UV')) return { color: 'bg-primary', textColor: 'text-primary', icon: '💜' };
  return { color: 'bg-muted-foreground', textColor: 'text-muted-foreground', icon: '✨' };
}

export function getTechniqueThumbnail(code: string): string | null {
  const c = code?.toUpperCase() ?? '';
  for (const [key, url] of Object.entries(TECHNIQUE_THUMBNAILS)) {
    if (c.includes(key)) return url;
  }
  return null;
}

export function getSlaInfo(days: number) {
  if (days <= 3) return { label: 'Express', color: 'bg-primary', textColor: 'text-primary' };
  if (days <= 7) return { label: 'Padrão', color: 'bg-warning', textColor: 'text-warning' };
  return { label: 'Estendido', color: 'bg-destructive', textColor: 'text-destructive' };
}

/** Componente de preview da técnica (HoverCard) */
export function TechniquePreview({
  technique,
  thumbnail,
  expanded = false,
}: {
  technique: TechniqueWithRecommendation;
  thumbnail: string | null;
  expanded?: boolean;
}) {
  const style = getTechniqueStyle(technique.code || '');

  return (
    <div className="space-y-3">
      {thumbnail && (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
          <img
            src={thumbnail.replace('w=100&h=100', 'w=400&h=225')}
            alt={technique.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg text-lg',
            style.color,
            'text-primary-foreground',
          )}
        >
          {style.icon}
        </div>
        <div>
          <h4 className="text-sm font-semibold">{technique.name}</h4>
          <p className="text-xs text-muted-foreground">{technique.code}</p>
        </div>
      </div>

      {expanded && (
        <>
          <p className="text-sm text-muted-foreground">
            {technique.description || 'Técnica de personalização de alta qualidade.'}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{technique.estimated_days} dias úteis</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span>{formatCurrency(technique.unit_cost)}/un</span>
            </div>
          </div>

          {technique.recommendation.isRecommended && (
            <div className="flex items-center gap-2 rounded-lg bg-warning/5 p-2">
              <Sparkles className="h-4 w-4 text-warning" />
              <p className="text-xs text-warning">
                {technique.recommendation.recommendationReason}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
