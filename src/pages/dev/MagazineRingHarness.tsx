/**
 * Harness dev-only para validação **pixel-perfect** do highlight de teclado
 * (`focus-visible:ring-*`) e do highlight base (`ring-primary` / `ring-amber-500`)
 * dos thumbs do `PreviewSidebar` — fecha o gap M5 da auditoria
 * (variantes de ring dependentes de CSS que jsdom não pinta).
 *
 * Renderiza um clone isolado da grade de thumbs com o MESMO `cn()` do
 * `PreviewSidebar.tsx` (linhas ~248-269), sem depender de `MagazinePageRenderer`
 * para manter o snapshot 100% determinístico entre CI e local.
 *
 * Rota:  /__test/magazine-ring?active=<idx>&highlight=<idx>&focus=<idx>&count=<n>
 * Sem auth, sem side-effects. Usado por `e2e/ui/magazine-ring-visual.spec.ts`.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

const DEFAULT_COUNT = 6;

export default function MagazineRingHarness() {
  const [params] = useSearchParams();
  const count = clampInt(params.get('count'), DEFAULT_COUNT, 1, 24);
  const activeIdx = clampInt(params.get('active'), 0, -1, count - 1);
  const highlightedIdx = clampInt(params.get('highlight'), -1, -1, count - 1);
  const focusIdx = clampInt(params.get('focus'), -1, -1, count - 1);

  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    // Programaticamente aciona focus-visible via .focus({focusVisible:true})
    // não é suportado universalmente — então usamos o polyfill CSS que o
    // Tailwind aplica via seletor `:focus-visible` (ativado por keyboard).
    // Simulamos foco por teclado disparando TAB até o índice desejado seria
    // frágil; usamos `focus()` combinado com um atributo `data-force-focus-visible`
    // que o spec valida via computed style. Alternativa robusta: o spec envia
    // Tab do navegador — mantemos aqui apenas o foco programático como
    // fallback; o Playwright é quem dispara o Tab real.
    if (focusIdx >= 0 && refs.current[focusIdx]) {
      refs.current[focusIdx]!.focus();
    } else {
      // limpa foco
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }, [focusIdx]);

  return (
    <div
      className="min-h-dvh w-full bg-background p-4"
      data-testid="harness-ready"
      data-harness-count={String(count)}
      data-harness-active={String(activeIdx)}
      data-harness-highlight={String(highlightedIdx)}
      data-harness-focus={String(focusIdx)}
    >
      {/* Container com o MESMO layout do PreviewSidebar (grid-cols-2 sm:grid-cols-3) */}
      <div
        className="mx-auto max-w-[420px] rounded border bg-card p-3"
        data-testid="magazine-ring-thumbs"
      >
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          Navegar entre páginas
        </div>
        <div className="grid grid-cols-2 gap-2 pr-2 sm:grid-cols-3">
          {Array.from({ length: count }, (_, idx) => {
            const isActive = idx === activeIdx;
            const isHighlighted = idx === highlightedIdx;
            return (
              <button
                key={idx}
                ref={(el) => {
                  refs.current[idx] = el;
                }}
                type="button"
                data-testid={`thumb-${idx}`}
                data-active={isActive ? 'true' : 'false'}
                data-highlighted={isHighlighted ? 'true' : 'false'}
                // === MESMO cn() do PreviewSidebar.tsx (mantido em sincronia manual) ===
                className={cn(
                  'group relative overflow-hidden rounded border bg-background text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive && 'ring-2 ring-primary',
                  !isActive && isHighlighted && 'ring-2 ring-amber-500',
                  !isActive && !isHighlighted && 'hover:border-primary/60',
                )}
                aria-label={`Ir para página ${idx + 1}`}
                aria-current={isActive ? 'true' : undefined}
              >
                {/* Placeholder estático para eliminar variação de pixels */}
                <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100" />
                <div className="flex items-center justify-between px-1.5 py-1 text-[10px]">
                  <span className="font-mono">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="truncate text-muted-foreground">Página</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
