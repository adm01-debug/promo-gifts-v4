/**
 * Admin: Badges de Inteligência Comercial
 *
 * Permite habilitar/desabilitar e ajustar thresholds das badges 🔥 Hot Item
 * e 🏅 Best-seller exibidas no ProductCard (catálogo + super filtro), sem
 * precisar de deploy. Persistência em `admin_settings` (chave
 * `intelligence_badges`) via {@link useIntelligenceBadgeSettings}.
 *
 * Rota: /admin/badges-inteligencia  (DevRoute).
 */
import { useEffect, useState } from 'react';
import { Flame, Trophy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageSEO } from '@/components/seo/PageSEO';
import {
  useIntelligenceBadgeSettings,
  DEFAULT_INTELLIGENCE_BADGE_SETTINGS,
  type IntelligenceBadgeSettings,
} from '@/hooks/admin/useIntelligenceBadgeSettings';

export default function IntelligenceBadgeSettingsPage() {
  const { settings, saving, save } = useIntelligenceBadgeSettings();
  const [draft, setDraft] = useState<IntelligenceBadgeSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirty =
    draft.hotItem.enabled !== settings.hotItem.enabled ||
    draft.bestSeller.enabled !== settings.bestSeller.enabled ||
    draft.bestSeller.minAvgDailyDepletion7d !== settings.bestSeller.minAvgDailyDepletion7d;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <PageSEO title="Badges de Inteligência Comercial — Admin" />

      <header>
        <h1
          className="font-display text-2xl font-semibold"
          data-testid="page-title-admin-intelligence-badges"
        >
          Badges de Inteligência Comercial
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controle quais badges aparecem nos cards do catálogo e ajuste o limiar de “Best-seller”
          (vendas médias por dia nos últimos 7 dias). As mudanças entram em vigor para todos os
          admins assim que você salvar — sem deploy.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-primary" aria-hidden />
              🔥 Hot Item
            </CardTitle>
            <CardDescription>
              Exibida quando a Inteligência Comercial classifica o produto como Hot Item (
              <code>mv_product_intelligence.is_hot_product = true</code>).
            </CardDescription>
          </div>
          <Switch
            checked={draft.hotItem.enabled}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, hotItem: { enabled: v } }))}
            aria-label="Habilitar badge Hot Item"
          />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-primary" aria-hidden />
              🏅 Best-seller
            </CardTitle>
            <CardDescription>
              Exibida quando a média de venda diária do produto nos últimos 7 dias (
              <code>avg_daily_depletion_7d</code>) for ≥ ao limiar abaixo.
            </CardDescription>
          </div>
          <Switch
            checked={draft.bestSeller.enabled}
            onCheckedChange={(v) =>
              setDraft((d) => ({ ...d, bestSeller: { ...d.bestSeller, enabled: v } }))
            }
            aria-label="Habilitar badge Best-seller"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="best-seller-threshold">Limiar mínimo (unidades / dia, média 7d)</Label>
          <Input
            id="best-seller-threshold"
            type="number"
            min={1}
            step={1}
            disabled={!draft.bestSeller.enabled}
            value={draft.bestSeller.minAvgDailyDepletion7d}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDraft((d) => ({
                ...d,
                bestSeller: {
                  ...d.bestSeller,
                  minAvgDailyDepletion7d:
                    Number.isFinite(n) && n > 0 ? n : d.bestSeller.minAvgDailyDepletion7d,
                },
              }));
            }}
            className="h-9 max-w-[180px]"
          />
          <p className="text-xs text-muted-foreground">
            Padrão: {DEFAULT_INTELLIGENCE_BADGE_SETTINGS.bestSeller.minAvgDailyDepletion7d} un/dia.
            Subir o limiar = badge mais rara; abaixar = mais produtos qualificam.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => setDraft(DEFAULT_INTELLIGENCE_BADGE_SETTINGS)}
          disabled={saving}
        >
          Restaurar padrão
        </Button>
        <Button
          onClick={() => {
            save(draft);
          }}
          disabled={!dirty || saving}
          data-testid="save-intelligence-badge-settings"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}
