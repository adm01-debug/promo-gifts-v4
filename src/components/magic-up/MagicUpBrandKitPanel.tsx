import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { MagicUpBrandKit, MagicUpBrandLogo } from '@/pages/magic-up/magicUpStrategy';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { MagicUpBrandSafetyChecklist } from './MagicUpBrandSafetyChecklist';
import { MagicUpLogoLibrary } from './MagicUpLogoLibrary';

interface MagicUpBrandKitPanelProps {
  kit: MagicUpBrandKit;
  loading: boolean;
  selectedClientName?: string | null;
  logoPreview: string | null;
  onUpdate: (patch: Partial<MagicUpBrandKit>) => void;
  onUseLogo: (logo: MagicUpBrandLogo) => void;
  onAddCurrentLogo: () => void;
  onSave: () => void;
}

const parseWordList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function MagicUpBrandKitPanel({
  kit,
  loading,
  selectedClientName,
  logoPreview,
  onUpdate,
  onUseLogo,
  onAddCurrentLogo,
  onSave,
}: MagicUpBrandKitPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" /> Brand Kit & segurança
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
        <CardDescription className="text-xs">
          Identidade visual persistente por cliente para reduzir peças genéricas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MagicUpBrandSafetyChecklist
          kit={kit}
          hasClient={!!selectedClientName}
          hasLogo={!!logoPreview}
        />
        <MagicUpLogoLibrary
          logos={kit.logoUrls}
          activeLogoUrl={logoPreview || kit.primaryLogoUrl}
          onUseLogo={onUseLogo}
          onAddCurrentLogo={onAddCurrentLogo}
          onChangeLogoVariant={(logoId, variant) =>
            onUpdate({
              logoUrls: kit.logoUrls.map((logo) =>
                logo.id === logoId ? { ...logo, variant } : logo,
              ),
            })
          }
        />
        <Separator />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor primária</Label>
            <Input
              value={kit.primaryColor ?? ''}
              onChange={(e) => onUpdate({ primaryColor: e.target.value })}
              placeholder="#1D4ED8"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor secundária</Label>
            <Input
              value={kit.secondaryColor ?? ''}
              onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
              placeholder="#F59E0B"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tom de voz</Label>
            <Input
              value={kit.toneOfVoice}
              onChange={(e) => onUpdate({ toneOfVoice: e.target.value })}
              placeholder="premium-consultivo"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estilo visual</Label>
            <Input
              value={kit.visualStyle}
              onChange={(e) => onUpdate({ visualStyle: e.target.value })}
              placeholder="limpo-corporativo"
              className="h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Palavras obrigatórias</Label>
            <Input
              value={kit.requiredWords.join(', ')}
              onChange={(e) => onUpdate({ requiredWords: parseWordList(e.target.value) })}
              placeholder="sustentável, premium"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Palavras proibidas</Label>
            <Input
              value={kit.forbiddenWords.join(', ')}
              onChange={(e) => onUpdate({ forbiddenWords: parseWordList(e.target.value) })}
              placeholder="barato, genérico"
              className="h-9"
            />
          </div>
        </div>
        <Textarea
          value={kit.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Ex: manter logo em área limpa, priorizar fundos claros, evitar linguagem informal..."
          rows={3}
          className="resize-none text-sm"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px]">
            {selectedClientName || 'Sem cliente vinculado'}
          </Badge>
          <Button type="button" size="sm" className="gap-1.5" onClick={onSave}>
            <Save className="h-3.5 w-3.5" /> Salvar Brand Kit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
