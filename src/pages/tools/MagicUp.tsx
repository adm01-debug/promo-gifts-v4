/**
 * MagicUp — Gerador de Imagens Publicitárias com IA
 *
 * v5: Extracted config/result panels into sub-components.
 */

import { PageSEO } from '@/components/seo/PageSEO';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMagicUpState } from '@/hooks/intelligence';
import { MagicUpConfigPanel } from '@/pages/magic-up/MagicUpConfigPanel';
import { MagicUpResultPanel } from '@/pages/magic-up/MagicUpResultPanel';

// ─── Sub-components ──────────────────────────────────────────────────

function MagicUpSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

function MagicUpHeader({
  variationsCount,
  historyCount,
  summary,
}: {
  variationsCount: number;
  historyCount: number;
  summary: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-6">
      <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-2 ring-primary/20">
            <Sparkles className="h-7 w-7 animate-pulse text-primary" />
          </div>
          <div>
            <h1
              data-testid="page-title-magic-up"
              className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text font-display text-3xl font-bold"
            >
              Magic Up
            </h1>
            <p className="mt-1 text-muted-foreground">
              Crie imagens publicitárias profissionais com IA ✨
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{summary}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {variationsCount > 1 && (
            <Badge variant="secondary" className="gap-1">
              {variationsCount} variações
            </Badge>
          )}
          {historyCount > 0 && (
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              {historyCount} geradas
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function MagicUpProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {['Produto', 'Logo', 'Cenário', 'Gerar'].map((label, i) => {
        const s = i + 1;
        const done = step > s;
        const active = step === s;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                done
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : active
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                    : 'border-border bg-muted/30 text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? '✓' : s}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < 3 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function MagicUp() {
  const m = useMagicUpState();

  return (
    <>
      <PageSEO
        title="MagicUp — Gerador de Imagens IA"
        description="Crie imagens publicitárias profissionais com inteligência artificial."
        path="/magic-up"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <MagicUpHeader
          variationsCount={m.variations.length}
          historyCount={m.history.length}
          summary={`${m.selectedClient?.name || 'Cliente não definido'} · ${m.selectedProduct?.name || 'Produto não selecionado'} · ${m.brief.channel} · ${m.brief.objective} · ${m.brief.tone}`}
        />
        <MagicUpProgress step={m.step} />

        {m.loadingProducts && <MagicUpSkeleton />}

        {!m.loadingProducts && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MagicUpConfigPanel m={m} />
            <MagicUpResultPanel m={m} />
          </div>
        )}
      </div>
    </>
  );
}
