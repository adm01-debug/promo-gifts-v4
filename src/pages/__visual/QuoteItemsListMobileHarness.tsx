/**
 * Dev-only visual harness para validar o layout do `QuoteItemsList` em
 * larguras críticas (320 / 375 / 768).
 *
 * Garante que a linha de inputs (Qtd / Preço / Subtotal) permaneça em uma
 * única linha — sem overflow horizontal — mesmo com textos longos
 * (nomes de produto, SKUs e valores monetários grandes).
 *
 * Rota: `/__visual/quote-items-list-mobile` (somente em DEV).
 */
import { useState } from 'react';
import { QuoteItemsList } from '@/components/quotes/QuoteItemsList';
import type { QuoteItem } from '@/hooks/quotes/quoteTypes';

const LONG_NAME =
  'Garrafa térmica em aço inoxidável com tampa rosqueável, alça de silicone e parede dupla para conservação prolongada — 750 ml';

const FIXTURES: QuoteItem[] = [
  {
    id: 'fx-short',
    product_id: 'p-short',
    product_name: 'Caneta',
    product_sku: '001',
    color_name: 'AZUL',
    color_hex: '#1E88E5',
    quantity: 10,
    unit_price: 2.5,
    personalizations: [],
  } as QuoteItem,
  {
    id: 'fx-long',
    product_id: 'p-long',
    product_name: LONG_NAME,
    product_sku: '9999999999',
    color_name: 'AZUL MARINHO ESCURO',
    color_hex: '#0A1F44',
    quantity: 9999,
    unit_price: 12345.67,
    personalizations: [],
  } as QuoteItem,
];

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function QuoteItemsListMobileHarness() {
  const [items, setItems] = useState<QuoteItem[]>(FIXTURES);

  return (
    <main
      data-testid="quote-items-list-mobile-harness"
      className="min-h-dvh bg-background p-2"
    >
      <div className="mx-auto w-full max-w-[430px]">
        <QuoteItemsList
          items={items}
          onUpdateQuantity={(i, q) =>
            setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, quantity: q } : it)))
          }
          onUpdatePrice={(i, p) =>
            setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, unit_price: p } : it)))
          }
          onRemove={(i) => setItems((prev) => prev.filter((_, idx) => idx !== i))}
          formatCurrency={fmt}
        />
      </div>
    </main>
  );
}
