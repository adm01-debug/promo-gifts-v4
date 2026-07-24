import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  BRAND_LOGO_VARIANTS,
  toHuman,
  type MagicUpBrandLogo,
} from '@/pages/magic-up/magicUpStrategy';
import { ImagePlus } from 'lucide-react';

interface MagicUpLogoLibraryProps {
  logos: MagicUpBrandLogo[];
  activeLogoUrl: string | null;
  onUseLogo: (logo: MagicUpBrandLogo) => void;
  onAddCurrentLogo: () => void;
  onChangeLogoVariant: (logoId: string, variant: MagicUpBrandLogo['variant']) => void;
}

export function MagicUpLogoLibrary({
  logos,
  activeLogoUrl,
  onUseLogo,
  onAddCurrentLogo,
  onChangeLogoVariant,
}: MagicUpLogoLibraryProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Biblioteca de logos</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onAddCurrentLogo}
        >
          <ImagePlus className="h-3.5 w-3.5" /> Adicionar logo atual
        </Button>
      </div>
      {logos.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          Envie ou selecione um logo para montar a biblioteca do cliente.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {logos.map((logo) => {
            const active = activeLogoUrl === logo.url || logo.isPrimary;
            return (
              <div
                key={logo.id}
                className={cn(
                  'space-y-2 rounded-lg border bg-card p-2',
                  active ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border',
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left"
                  onClick={() => onUseLogo(logo)}
                  aria-label={`Aplicar ${logo.label}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-background p-1">
                    <img
                      src={logo.url}
                      alt={logo.label}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{logo.label}</span>
                    <Badge variant={active ? 'secondary' : 'outline'} className="mt-1 text-[9px]">
                      {active ? 'Em uso' : toHuman(logo.variant)}
                    </Badge>
                  </span>
                </button>
                <Select
                  value={logo.variant}
                  onValueChange={(value) =>
                    onChangeLogoVariant(logo.id, value as MagicUpBrandLogo['variant'])
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAND_LOGO_VARIANTS.map((variant) => (
                      <SelectItem key={variant} value={variant}>
                        {toHuman(variant)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
