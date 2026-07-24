/**
 * SimilarKitsWidget — sidebar do Kit Builder mostrando até 3 templates
 * semelhantes ao kit atual (overlap >=30% por SKU).
 */
import { useNavigate } from 'react-router-dom';
import {
  Package, Sparkles,
  Gift, Heart, Star, Crown, Briefcase, Coffee, Laptop, Leaf, Trophy, Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSimilarKits } from '@/hooks/kit-builder';
import { formatCurrency } from '@/lib/kit-builder';

interface Props {
  currentSkus: string[];
  excludeId?: string;
}

/** Lookup estático dos ícones do PRESET_ICONS — evita namespace import. */
const ICON_MAP: Record<string, LucideIcon | undefined> = {
  Package, Gift, Heart, Star, Crown, Sparkles,
  Briefcase, Coffee, Laptop, Leaf, Trophy, Users,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Package;
}

export function SimilarKitsWidget({ currentSkus, excludeId }: Props) {
  const navigate = useNavigate();
  const { data, isLoading } = useSimilarKits({ currentSkus, excludeId });

  if (currentSkus.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Kits semelhantes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <>
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </>
        )}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum template parecido. Continue montando — sua criação é única!
          </p>
        )}
        {(data ?? []).map(({ template, ratio, overlap }) => {
          const Icon = getIcon(template.icon);
          return (
            <button
              key={template.id}
              onClick={() => navigate(`/montar-kit?template=${template.id}`)}
              className="flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent/50"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${template.color}22`, color: template.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-xs font-medium">{template.name}</p>
                  {template.tag && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px]">
                      {template.tag}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {Math.round(ratio * 100)}% em comum · {overlap} itens ·{' '}
                  {formatCurrency(template.total_price)}
                </p>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
