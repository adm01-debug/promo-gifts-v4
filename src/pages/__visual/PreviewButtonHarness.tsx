/**
 * Dev-only visual harness for the Preview button.
 *
 * Rota: `/__visual/preview-button` (somente em `import.meta.env.DEV`).
 * Tema: `?theme=dark` adiciona `.dark` no `<html>`; default = light.
 *
 * Marcação 1:1 com QuoteViewPage.tsx — se uma mudar, a outra DEVE mudar junto.
 * A duplicação é intencional: isolar o botão de auth/providers/router permite
 * snapshots determinísticos via Playwright sem fixtures pesadas.
 */
import { useEffect } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const PREVIEW_CLASS = `group relative h-6 min-w-[78px] justify-center gap-1.5 overflow-hidden rounded-full border-primary/40 px-2.5 text-[11px]
  animate-[preview-breath_6s_ease-in-out_infinite] motion-reduce:animate-none
  shadow-[0_0_6px_hsl(var(--primary)/0.2)] transition-all duration-500
  hover:animate-none focus-visible:animate-none
  hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_14px_hsl(var(--primary)/0.5)]
  before:absolute before:inset-0 before:rounded-full
  before:bg-[linear-gradient(110deg,transparent_30%,hsl(var(--primary)/0.35)_50%,transparent_70%)]
  before:translate-x-[-120%] before:transition-transform before:duration-700 before:ease-out
  hover:before:translate-x-[120%]
  after:absolute after:inset-0 after:rounded-full after:border after:border-primary/25
  after:animate-[preview-breath-border_6s_ease-in-out_infinite] after:motion-reduce:animate-none
  hover:after:animate-none focus-visible:after:animate-none hover:after:border-primary/0
  focus-visible:shadow-[0_0_14px_hsl(var(--primary)/0.5)]`;

export default function PreviewButtonHarness() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get("theme");
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    return () => {
      root.classList.remove("dark");
    };
  }, []);

  return (
    <main
      data-testid="visual-harness-root"
      className="flex min-h-dvh items-center justify-center bg-background p-12"
    >
      <div className="flex flex-col items-center gap-8">
        <h1 className="sr-only">Preview Button Visual Harness</h1>

        <Button
          variant="outline"
          data-testid="pdf-preview-trigger"
          aria-label="Abrir preview da proposta para exportar PDF"
          className={PREVIEW_CLASS}
        >
          <Eye className="relative z-10 h-3 w-3 text-primary transition-transform duration-300 group-hover:scale-125 group-hover:drop-shadow-[0_0_4px_hsl(var(--primary))]" />
          <span className="relative z-10 tracking-wide">Preview</span>
        </Button>

        {/* Âncora para Tab-navigation no spec de focus-visible */}
        <button
          data-testid="anchor-before"
          className="rounded border border-border bg-card px-3 py-1 text-sm text-foreground"
        >
          âncora
        </button>
      </div>
    </main>
  );
}
