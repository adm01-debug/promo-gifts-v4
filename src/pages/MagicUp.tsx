/**
 * MagicUp — Gerador de Imagens Publicitárias com IA
 * 
 * v5: Extracted config/result panels into sub-components.
 */

import { PageSEO } from "@/components/seo/PageSEO";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMagicUpState } from "@/hooks/useMagicUpState";
import { MagicUpConfigPanel } from "./magic-up/MagicUpConfigPanel";
import { MagicUpResultPanel } from "./magic-up/MagicUpResultPanel";

// ─── Sub-components ──────────────────────────────────────────────────

function MagicUpSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="aspect-square w-full rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function MagicUpHeader({ variationsCount, historyCount, summary }: { variationsCount: number; historyCount: number; summary: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-6 border border-primary/20">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 ring-2 ring-primary/20">
            <Sparkles className="h-7 w-7 text-primary animate-pulse" />
          </div>
          <div>
            <h1 data-testid="page-title-magic-up" className="font-display text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Magic Up</h1>
            <p className="text-muted-foreground mt-1">Crie imagens publicitárias profissionais com IA ✨</p>
            <p className="text-xs text-muted-foreground mt-2">{summary}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {variationsCount > 1 && <Badge variant="secondary" className="gap-1">{variationsCount} variações</Badge>}
          {historyCount > 0 && <Badge variant="outline" className="gap-1.5"><Clock className="h-3 w-3" />{historyCount} geradas</Badge>}
        </div>
      </div>
    </div>
  );
}

function MagicUpProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {["Produto", "Logo", "Cenário", "Gerar"].map((label, i) => {
        const s = i + 1;
        const done = step > s;
        const active = step === s;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all flex-1",
              done ? "border-primary/30 bg-primary/5 text-primary" :
              active ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" :
              "border-border bg-muted/30 text-muted-foreground"
            )}>
              <span className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                done ? "bg-primary text-primary-foreground" :
                active ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              )}>
                {done ? "✓" : s}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
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
      <PageSEO title="MagicUp — Gerador de Imagens IA" description="Crie imagens publicitárias profissionais com inteligência artificial." path="/magic-up" />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
        <MagicUpHeader variationsCount={m.variations.length} historyCount={m.history.length} summary={`${m.selectedClient?.name || "Cliente não definido"} · ${m.selectedProduct?.name || "Produto não selecionado"} · ${m.brief.channel} · ${m.brief.objective} · ${m.brief.tone}`} />
        <MagicUpProgress step={m.step} />

        {m.loadingProducts && <MagicUpSkeleton />}

        {!m.loadingProducts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MagicUpConfigPanel m={m} />
            <MagicUpResultPanel m={m} />
          </div>
        )}
      </div>
  );
}
