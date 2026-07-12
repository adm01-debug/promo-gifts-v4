/**
 * Step 1 — Identidade: título, subtítulo, cliente CRM, logo, cores.
 */

import { useState } from 'react';
import { Building2, Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import type { Magazine } from '@/types/magazine';

interface Props {
  magazine: Magazine;
  onTitle: (v: string) => void;
  onSubtitle: (v: string) => void;
  onBranding: (patch: Partial<Magazine['branding']>) => void;
}

export function IdentityStep({ magazine, onTitle, onSubtitle, onBranding }: Props) {
  const [colors, setColors] = useState(magazine.branding.colors);
  const setColor = (k: keyof typeof colors, v: string) => {
    const next = { ...colors, [k]: v };
    setColors(next);
    onBranding({ colors: next });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="h-4 w-4" /> Identidade
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
          <div className="space-y-2">
            <Label htmlFor="mag-client">Nome do cliente</Label>
            <Input
              id="mag-client"
              value={magazine.branding.clientName ?? ''}
              onChange={(e) => onBranding({ clientName: e.target.value || null })}
              placeholder="Ex.: Empresa Cliente Ltda."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mag-logo">URL do logo do cliente</Label>
            <Input
              id="mag-logo"
              value={magazine.branding.clientLogoUrl ?? ''}
              onChange={(e) => onBranding({ clientLogoUrl: e.target.value || null })}
              placeholder="https://…/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              Cole a URL de uma imagem já hospedada. Integração completa com o CRM chega na v2.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Palette className="h-4 w-4" /> Paleta da marca
          </div>
          {(['primary', 'secondary', 'text'] as const).map((k) => (
            <div key={k} className="flex items-center gap-3">
              <input
                type="color"
                value={colors[k]}
                onChange={(e) => setColor(k, e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border"
                aria-label={`Cor ${k}`}
              />
              <div className="flex-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {k === 'primary' ? 'Primária' : k === 'secondary' ? 'Destaque' : 'Texto'}
                </Label>
                <Input value={colors[k]} onChange={(e) => setColor(k, e.target.value)} className="mt-1 h-9" />
              </div>
            </div>
          ))}
          <div
            className="mt-6 flex h-32 items-center justify-center rounded-lg border text-center"
            style={{ background: colors.primary, color: colors.text === colors.primary ? '#fff' : colors.text }}
          >
            <div>
              <div className="text-sm opacity-80">Preview da paleta</div>
              <div className="font-display text-3xl font-bold" style={{ color: colors.secondary }}>
                {magazine.title || 'Sua revista'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
