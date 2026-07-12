/**
 * Step 3 — Conteúdo: toggles globais dos campos exibidos.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Magazine, MagazineContentSettings } from '@/types/magazine';

interface Props {
  magazine: Magazine;
  onChange: (patch: Partial<MagazineContentSettings>) => void;
}

const TOGGLES: Array<{ key: keyof MagazineContentSettings; label: string; hint: string }> = [
  { key: 'showPrice', label: 'Mostrar preço', hint: 'Preço final ao lado do produto.' },
  { key: 'showCode', label: 'Mostrar código (SKU)', hint: 'Útil para pedidos posteriores.' },
  { key: 'showPersonalization', label: 'Mostrar personalização', hint: 'Badge quando o produto aceita gravação.' },
  { key: 'showDescription', label: 'Mostrar descrição', hint: 'Descrição curta do produto.' },
  { key: 'showDimensions', label: 'Mostrar dimensões', hint: 'Altura, largura, peso quando disponível.' },
  { key: 'showMaterials', label: 'Mostrar materiais', hint: 'Tags de materiais do produto.' },
  { key: 'showColors', label: 'Mostrar cor selecionada', hint: 'Nome da cor da variação escolhida.' },
  { key: 'groupByCategory', label: 'Agrupar por categoria', hint: 'Insere página de seção antes de cada grupo.' },
];

export function ContentStep({ magazine, onChange }: Props) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="mb-6 text-sm text-muted-foreground">
          Escolha quais informações aparecem em cada produto. Overrides por item podem ser feitos depois na etapa
          de layout.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label className="text-sm font-semibold">{t.label}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <Switch
                checked={magazine.content[t.key]}
                onCheckedChange={(v) => onChange({ [t.key]: v } as Partial<MagazineContentSettings>)}
                aria-label={t.label}
                data-testid={`magazine-toggle-${t.key}`}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
