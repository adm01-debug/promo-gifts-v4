/**
 * Step 1 — Identidade: título, subtítulo, picker de cliente CRM, paleta shadcn com WCAG.
 */

import { Building2, Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import type { Magazine } from '@/types/magazine';
import { BrandColorPicker } from '../BrandColorPicker';
import { MagazineClientPicker } from '../MagazineClientPicker';

interface Props {
  magazine: Magazine;
  onTitle: (v: string) => void;
  onSubtitle: (v: string) => void;
  onBranding: (patch: Partial<Magazine['branding']>) => void;
}

export function IdentityStep({ magazine, onTitle, onSubtitle, onBranding }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="h-4 w-4" aria-hidden /> Identidade
          </div>

          <div className="space-y-2">
            <Label htmlFor="mag-title">Título da revista</Label>
            <Input
              id="mag-title"
              value={magazine.title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Coleção Corporativa 2026"
              data-testid="magazine-title-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mag-subtitle">Subtítulo</Label>
            <Textarea
              id="mag-subtitle"
              value={magazine.subtitle}
              onChange={(e) => onSubtitle(e.target.value)}
              rows={2}
              placeholder="Uma seleção especial preparada para você"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Cliente (CRM)</legend>
            <MagazineClientPicker
              clientName={magazine.branding.clientName ?? null}
              clientLogoUrl={magazine.branding.clientLogoUrl ?? null}
              onChange={onBranding}
            />
          </fieldset>

          <details className="rounded-md border bg-muted/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Preencher manualmente (avançado)
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mag-client" className="text-xs">
                  Nome do cliente
                </Label>
                <Input
                  id="mag-client"
                  value={magazine.branding.clientName ?? ''}
                  onChange={(e) => onBranding({ clientName: e.target.value || null })}
                  placeholder="Ex.: Empresa Cliente Ltda."
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mag-logo" className="text-xs">
                  URL do logo do cliente
                </Label>
                <Input
                  id="mag-logo"
                  value={magazine.branding.clientLogoUrl ?? ''}
                  onChange={(e) => onBranding({ clientLogoUrl: e.target.value || null })}
                  placeholder="https://…/logo.png"
                  className="h-9"
                />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Palette className="h-4 w-4" aria-hidden /> Paleta da marca
          </div>
          <BrandColorPicker
            colors={magazine.branding.colors}
            onChange={(colors) => onBranding({ colors })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
