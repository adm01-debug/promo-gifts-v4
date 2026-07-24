/**
 * VariantColorSelect — dropdown shadcn com bolinha da cor.
 * Substitui o <select> nativo do painel de produtos selecionados.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MagazineItem } from '@/types/magazine';

interface Props {
  item: MagazineItem;
  onChange: (colorName: string | null) => void;
}

const NONE = '__none__';

export function VariantColorSelect({ item, onChange }: Props) {
  const colors = item.productSnapshot.colors;
  if (!colors.length) return null;

  const value = item.variantColorName ?? NONE;
  const active = colors.find((c) => c.name === item.variantColorName);

  return (
    <Select value={value} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="mt-1 h-7 text-xs" aria-label="Cor selecionada">
        <div className="flex items-center gap-2">
          {active && (
            <span
              className="inline-block h-3 w-3 rounded-full border"
              style={{ background: active.hex ?? '#ccc', borderColor: 'rgba(0,0,0,0.15)' }}
              aria-hidden
            />
          )}
          <SelectValue placeholder="Imagem principal" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Imagem principal</SelectItem>
        {colors.map((c) => (
          <SelectItem key={c.name} value={c.name}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full border"
                style={{ background: c.hex ?? '#ccc', borderColor: 'rgba(0,0,0,0.15)' }}
                aria-hidden
              />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
