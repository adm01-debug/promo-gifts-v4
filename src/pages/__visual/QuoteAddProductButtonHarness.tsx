/**
 * Dev-only harness para o botão `quote-add-product-button-summary`.
 *
 * Replica APENAS o gatilho ("+ Produto") + `QuoteBuilderProductSearch` com
 * fixtures sintéticas, evitando montar o `QuoteBuilderSummaryColumn` inteiro
 * (que exige dezenas de props do builder). O contrato visual e o
 * `data-testid` do botão são idênticos aos do componente real.
 *
 * Query params:
 *  - `longContent=1` → gera 50 produtos no resultado para estressar a lista.
 *  - `loading=1`     → simula estado `quotesLoading` (botão disabled).
 *
 * Rota: `/__visual/quote-add-product-button` (somente em DEV).
 *
 * fix_version: harness-type-safe-2026-07-03 — imagens cast + assinatura onAddWithColor correta
 */
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuoteBuilderProductSearch } from '@/components/quotes/QuoteBuilderProductSearch';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Mirrors QuoteBuilderProductSearch local Product interface (not exported).
// fix_version: harness-type-mirror-2026-07-03 — tipo explícito evita TS2322/TS2345
// ANTI-REGRESSÃO: não remover o tipo explícito; stubs inferidos causam TS2322+TS2345
type StubProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  images: string[] | null;
  colors?: { name: string; hex?: string; stock?: number }[];
  totalStock?: number;
};

function makeStubProducts(n: number): StubProduct[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `stub-prod-${i + 1}`,
    name: `Produto sintético ${i + 1} — caneca personalizada premium`,
    sku: `STUB-${String(i + 1).padStart(4, '0')}`,
    price: 19.9 + i,
    images: null as string[] | null,
    colors: [{ name: 'Azul', hex: '#1d4ed8' }],
    totalStock: 100,
  }));
}

export default function QuoteAddProductButtonHarness() {
  const params = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const longContent = params.get('longContent') === '1';
  const loading = params.get('loading') === '1';

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // fix_version: harness-type-mirror-2026-07-03 — usa StubProduct para evitar TS2345
  const [selected, setSelected] = useState<StubProduct | null>(null);

  const products = useMemo(
    () => makeStubProducts(longContent ? 50 : 6),
    [longContent],
  );

  return (
    <main
      data-testid="quote-add-product-button-harness"
      className="min-h-dvh bg-background p-4"
    >
      <div
        data-testid="product-search-open-state"
        data-open={open ? '1' : '0'}
        className="sr-only"
      >
        {open ? 'open' : 'closed'}
      </div>

      {/* Mesmo markup e a11y do botão real do QuoteBuilderSummaryColumn. */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={loading}
        aria-disabled={loading}
        aria-label="Adicionar novo produto ao orçamento"
        title="Adicionar novo produto ao orçamento"
        data-testid="quote-add-product-button-summary"
        className="group h-7 gap-1.5 rounded-full border-[1.5px] border-primary/70 bg-transparent px-3 text-xs text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium">Produto</span>
      </Button>

      <QuoteBuilderProductSearch
        open={open}
        onOpenChange={setOpen}
        productSearch={search}
        setProductSearch={setSearch}
        filteredProducts={products}
        selectedProductForColor={selected}
        setSelectedProductForColor={setSelected}
        onProductClick={(p) => setSelected(p)}
        onAddWithColor={(_p, _v) => setOpen(false)}
        formatCurrency={fmt}
      />
    </main>
  );
}
