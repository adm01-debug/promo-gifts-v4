/**
 * Step 3 — Conteúdo: toggles agrupados semanticamente em fieldsets:
 *  - Campos por produto
 *  - Estrutura da revista
 */

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Magazine, MagazineContentSettings } from '@/types/magazine';

interface Props {
  magazine: Magazine;
  onChange: (patch: Partial<MagazineContentSettings>) => void;
}

/** Somente keys booleanas — introText/closingText são texto e têm UI própria. */
type BooleanContentKey =
  'groupByCategory' | 'showCode' | 'showColors' | 'showDescription' | 'showDimensions' | 'showMaterials' | 'showPersonalization' | 'showPrice';
type Toggle = { key: BooleanContentKey; label: string; hint: string };

const FIELD_TOGGLES: Toggle[] = [
  { key: 'showPrice', label: 'Mostrar preço', hint: 'Preço final ao lado do produto.' },
  { key: 'showCode', label: 'Mostrar código (SKU)', hint: 'Útil para pedidos posteriores.' },
  { key: 'showPersonalization', label: 'Mostrar personalização', hint: 'Badge quando o produto aceita gravação.' },
  { key: 'showDescription', label: 'Mostrar descrição', hint: 'Descrição curta do produto.' },
  { key: 'showDimensions', label: 'Mostrar dimensões', hint: 'Altura, largura, peso quando disponível.' },
  { key: 'showMaterials', label: 'Mostrar materiais', hint: 'Tags de materiais do produto.' },
  { key: 'showColors', label: 'Mostrar cor selecionada', hint: 'Nome da cor da variação escolhida.' },
];

const STRUCTURE_TOGGLES: Toggle[] = [
  {
    key: 'groupByCategory',
    label: 'Agrupar por categoria',
    hint: 'Insere uma página de seção antes de cada grupo de categoria.',
  },
];

function ToggleRow({
  toggle,
  checked,
  onCheck,
}: {
  toggle: Toggle;
  checked: boolean;
  onCheck: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div>
        <Label className="text-sm font-semibold">{toggle.label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{toggle.hint}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheck}
        aria-label={toggle.label}
        data-testid={`magazine-toggle-${toggle.key}`}
      />
    </div>
  );
}

export function ContentStep({ magazine, onChange }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Campos exibidos por produto</legend>
            <p className="text-xs text-muted-foreground">
              Estas configurações valem para todos os produtos. Overrides individuais estão na etapa
              de layout.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELD_TOGGLES.map((t) => (
                <ToggleRow
                  key={t.key}
                  toggle={t}
                  checked={magazine.content[t.key]}
                  onCheck={(v) =>
                    onChange({ [t.key]: v } as Partial<MagazineContentSettings>)
                  }
                />
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Estrutura da revista</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {STRUCTURE_TOGGLES.map((t) => (
                <ToggleRow
                  key={t.key}
                  toggle={t}
                  checked={magazine.content[t.key]}
                  onCheck={(v) =>
                    onChange({ [t.key]: v } as Partial<MagazineContentSettings>)
                  }
                />
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  );
}
