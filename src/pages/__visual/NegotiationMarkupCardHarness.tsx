/**
 * Dev-only harness para o trio de cards do `NegotiationMarkupCard`
 * (Margem de Negociação + REAL + CLIENTE VÊ).
 *
 * Renderiza o card com valores fixos e o markup já ativo (10%), permitindo
 * ao spec Playwright validar visualmente a ordem e o alinhamento horizontal
 * do trio nos breakpoints sm/md/lg (a rota é pública em DEV, sem auth).
 *
 * Rota: `/__visual/negotiation-markup-card` (somente em DEV).
 */
import { useState } from 'react';
import { NegotiationMarkupCard } from '@/components/quotes/NegotiationMarkupCard';

export default function NegotiationMarkupCardHarness() {
  const [markup, setMarkup] = useState(10);
  return (
    <main
      data-testid="negotiation-markup-card-harness"
      className="min-h-dvh bg-background p-4"
    >
      {/* Wrapper reproduz o mesmo w-3/5 min-w-[320px] usado no QuoteBuilderSummaryColumn */}
      <div className="mx-auto w-3/5 min-w-[320px] max-w-md">
        <NegotiationMarkupCard
          value={markup}
          onChange={setMarkup}
          realSubtotal={4679.4}
          apparentDiscountPercent={0}
          realDiscountPercent={0}
          maxDiscountPercent={20}
        />
      </div>
    </main>
  );
}
