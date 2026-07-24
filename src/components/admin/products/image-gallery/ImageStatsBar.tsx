import { CheckCircle2, AlertTriangle, Shield, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type GalleryStats, IMAGE_TYPES } from './types';

interface Props {
  stats: GalleryStats;
  hasPrimary: boolean;
  hasOgImage: boolean;
}

function getSeoScore(stats: GalleryStats, hasPrimary: boolean, hasOgImage: boolean) {
  let score = 0;
  let max = 0;

  // Has primary image (30 pts)
  max += 30;
  if (hasPrimary) score += 30;

  // % with alt text (40 pts)
  max += 40;
  if (stats.total > 0) score += Math.round((stats.withAlt / stats.total) * 40);

  // Has OG image (15 pts)
  max += 15;
  if (hasOgImage) score += 15;

  // Has at least 3 images (15 pts)
  max += 15;
  if (stats.total >= 3) score += 15;

  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return {
    pct,
    color: pct >= 80 ? 'text-primary' : pct >= 50 ? 'text-warning' : 'text-destructive',
    bg: pct >= 80 ? 'bg-primary' : pct >= 50 ? 'bg-warning' : 'bg-destructive',
  };
}

export function ImageStatsBar({ stats, hasPrimary, hasOgImage }: Props) {
  const seo = getSeoScore(stats, hasPrimary, hasOgImage);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/30 bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/70">{stats.total} no BD externo</span>
      <span className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-primary" />
        {stats.withAlt}/{stats.total} com alt text
      </span>
      {stats.withoutVariant > 0 && <span>{stats.withoutVariant} gerais (sem cor)</span>}
      {stats.total > 0 && stats.cfVerified > 0 && (
        <span className="flex items-center gap-1">
          <Cloud className="h-2.5 w-2.5 text-emerald-500" />
          {stats.cfVerified}/{stats.total} no Cloudflare
        </span>
      )}
      {Array.from(stats.byType.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => {
          const info = IMAGE_TYPES.find((t) => t.value === type);
          return (
            <span key={type} className="flex items-center gap-1">
              {info && <info.icon className={cn('h-2.5 w-2.5', info.color)} />}
              {info?.label || type}: {count}
            </span>
          );
        })}

      {/* SEO Score */}
      <div className="ml-auto flex items-center gap-1.5">
        <Shield className={cn('h-3 w-3', seo.color)} />
        <span className={cn('font-semibold', seo.color)}>SEO {seo.pct}%</span>
        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', seo.bg)}
            style={{ width: `${seo.pct}%` }}
          />
        </div>
        {seo.pct < 80 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
            <AlertTriangle className="h-2.5 w-2.5" />
            {!hasPrimary
              ? 'Sem principal'
              : stats.withAlt < stats.total
                ? 'Alt text faltando'
                : !hasOgImage
                  ? 'Sem OG image'
                  : ''}
          </span>
        )}
      </div>
    </div>
  );
}
