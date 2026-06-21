/**
 * Dev harness — /__test/color-swatches
 *
 * Página pública (sem auth) para validação visual manual do
 * `ProductColorSwatches` em modo `wrap` com fixtures de muitas cores,
 * em diferentes tamanhos e viewports (especialmente 320px).
 *
 * NÃO USAR EM PRODUÇÃO PARA NEGÓCIO — apenas inspeção visual de QA.
 */
import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ProductColorSwatches,
  type ColorDotLike,
} from '@/components/products/ProductColorSwatches';

const COLORS_24: ColorDotLike[] = [
  { name: 'Azul Royal', hex: '#1E3A8A' },
  { name: 'Branco', hex: '#FFFFFF' },
  { name: 'Laranja', hex: '#F97316' },
  { name: 'Cinza', hex: '#9CA3AF' },
  { name: 'Preto', hex: '#000000' },
  { name: 'Roxo', hex: '#7C3AED' },
  { name: 'Verde Bandeira', hex: '#16A34A' },
  { name: 'Vermelho', hex: '#DC2626' },
  { name: 'Amarelo', hex: '#FACC15' },
  { name: 'Rosa Pink', hex: '#EC4899' },
  { name: 'Marrom', hex: '#92400E' },
  { name: 'Bege', hex: '#D6CFC4' },
  { name: 'Turquesa', hex: '#06B6D4' },
  { name: 'Vinho', hex: '#7F1D1D' },
  { name: 'Verde Limão', hex: '#84CC16' },
  { name: 'Lilás', hex: '#C4B5FD' },
  { name: 'Prata', hex: '#CBD5E1' },
  { name: 'Dourado', hex: '#D4AF37' },
  { name: 'Coral', hex: '#FB7185' },
  { name: 'Mostarda', hex: '#CA8A04' },
  { name: 'Azul Marinho', hex: '#0F172A' },
  { name: 'Verde Musgo', hex: '#3F6212' },
  { name: 'Caramelo', hex: '#B45309' },
  { name: 'Magenta', hex: '#A21CAF' },
];

const COUNTS = [3, 6, 12, 24];

function MockCard({
  title,
  colors,
  wrap,
}: {
  title: string;
  colors: ColorDotLike[];
  wrap: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="w-full max-w-[200px] overflow-hidden rounded-xl border border-border/50 bg-card">
      <div className="aspect-square w-full bg-muted" />
      <div className="space-y-1.5 p-2">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <ProductColorSwatches
          colors={colors}
          size="sm"
          wrap={wrap}
          max={5}
          hideWhenEmpty={false}
          selectedName={active}
          onSelect={(c) => setActive(c.name)}
        />
        <p className="text-[10px] text-muted-foreground">
          {colors.length} cores · {wrap ? 'wrap' : 'legado +N'}
        </p>
      </div>
    </div>
  );
}

export default function ColorSwatchesHarness() {
  return (
    <TooltipProvider>
      <main className="min-h-screen bg-background p-4">
        <h1 className="mb-1 text-lg font-bold">ProductColorSwatches · QA Harness</h1>
        <p className="mb-4 text-xs text-muted-foreground">
          Redimensione o viewport para 320px e confirme: (a) nenhuma bolinha cortada nas bordas; (b)
          todas as cores visíveis em modo wrap; (c) chip "+N" apenas no modo legado.
        </p>

        {(['wrap', 'legado'] as const).map((mode) => (
          <section key={mode} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Modo{' '}
              {mode === 'wrap'
                ? 'wrap (grid Catálogo/Super Filtro/Novidades/Reposição)'
                : 'legado (lista/tabela)'}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {COUNTS.map((n) => (
                <MockCard
                  key={`${mode}-${n}`}
                  title={`${n} cores`}
                  colors={COLORS_24.slice(0, n)}
                  wrap={mode === 'wrap'}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </TooltipProvider>
  );
}
