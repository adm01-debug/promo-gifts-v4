/**
 * MagazineMiniMap — barra de progresso interativa:
 *  - Clique/arraste em qualquer ponto para pular (scrub)
 *  - Dots âmbar dos marcadores clicáveis
 *  - Thumb da página atual
 *  - Tooltip flutuante durante o arrasto
 *  - Hover-preview: mostra miniatura da página sob o cursor (desktop)
 *  - Mouse + touch, acessível (role=slider)
 */
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface Props {
  total: number;
  currentIndex: number;
  bookmarks: Set<number>;
  onGo: (index: number) => void;
  /** Renderiza a miniatura para hover-preview (opcional, apenas desktop). */
  renderPreview?: (index: number) => ReactNode;
}

export function MagazineMiniMap({ total, currentIndex, bookmarks, onGo, renderPreview }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const progressPct = total > 1 ? ((currentIndex + 1) / total) * 100 : 100;
  const thumbIdx = scrubIdx ?? currentIndex;
  const thumbLeft = total > 1 ? (thumbIdx / Math.max(total - 1, 1)) * 100 : 0;
  const previewLeft =
    hoverIdx != null && total > 1 ? (hoverIdx / Math.max(total - 1, 1)) * 100 : 0;

  const idxFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || total <= 1) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      return Math.round(ratio * (total - 1));
    },
    [total],
  );

  const handleDown = useCallback(
    (clientX: number) => {
      setDragging(true);
      const idx = idxFromClientX(clientX);
      setScrubIdx(idx);
      onGo(idx);
    },
    [idxFromClientX, onGo],
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!dragging) return;
      const idx = idxFromClientX(clientX);
      setScrubIdx(idx);
      onGo(idx);
    },
    [dragging, idxFromClientX, onGo],
  );

  const handleUp = useCallback(() => {
    setDragging(false);
    setScrubIdx(null);
  }, []);

  // C3: durante drag, escuta mouseup/mousemove no window (não apenas no track).
  // Cobre o caso do cursor sair pela borda superior sem disparar mouseleave.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX);
    const onUp = () => handleUp();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, handleMove, handleUp]);

  // I5: filtra marcadores que apontam para páginas que não existem mais
  const validBookmarks = useMemo(
    () => Array.from(bookmarks).filter((idx) => idx >= 0 && idx < total),
    [bookmarks, total],
  );

  const showPreview = !dragging && hoverIdx != null && renderPreview && total > 1;

  return (
    <div className="relative mx-auto mb-3 max-w-[1100px]">
      <div
        ref={trackRef}
        className="group relative flex h-4 cursor-pointer items-center"
        role="slider"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentIndex + 1}
        aria-label={`Progresso da leitura: página ${currentIndex + 1} de ${total}. Arraste para pular.`}
        tabIndex={0}
        onKeyDown={(e) => {
          // L: navegação por teclado no slider (a11y)
          if (total <= 1) return;
          let handled = true;
          switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
              onGo(Math.max(currentIndex - 1, 0));
              break;
            case 'ArrowRight':
            case 'ArrowUp':
              onGo(Math.min(currentIndex + 1, total - 1));
              break;
            case 'PageDown':
              onGo(Math.max(currentIndex - 5, 0));
              break;
            case 'PageUp':
              onGo(Math.min(currentIndex + 5, total - 1));
              break;
            case 'Home':
              onGo(0);
              break;
            case 'End':
              onGo(total - 1);
              break;
            default:
              handled = false;
          }
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          handleDown(e.clientX);
        }}
        onMouseMove={(e) => {
          handleMove(e.clientX);
          setHoverIdx(idxFromClientX(e.clientX));
        }}
        onMouseEnter={(e) => setHoverIdx(idxFromClientX(e.clientX))}
        onMouseUp={handleUp}
        onMouseLeave={() => {
          handleUp();
          setHoverIdx(null);
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) handleDown(t.clientX);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) {
            e.preventDefault();
            handleMove(t.clientX);
          }
        }}
        onTouchEnd={handleUp}
      >
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10 transition-[height] group-hover:h-[5px]">
          <div
            className="h-full bg-white/80 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {total > 1 &&
          validBookmarks.map((idx) => {
            const left = (idx / Math.max(total - 1, 1)) * 100;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onGo(idx);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className={
                  `absolute -translate-x-1/2 rounded-full shadow ring-2 ring-neutral-950 transition hover:scale-125 focus:outline-none focus-visible:ring-white ${ 
                  isCurrent ? 'bg-amber-300 scale-125' : 'bg-amber-400'}`
                }
                style={{ left: `${left}%`, width: 10, height: 10 }}
                aria-label={
                  isCurrent
                    ? `Página marcada ${idx + 1} (atual)`
                    : `Ir para página marcada ${idx + 1}`
                }
                aria-current={isCurrent ? 'location' : undefined}
                title={`Marcador · página ${idx + 1}${isCurrent ? ' (atual)' : ''}`}
              />
            );
          })}

        {total > 1 && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-white shadow-lg ring-2 ring-neutral-950 transition-transform"
            style={{
              left: `${thumbLeft}%`,
              width: dragging ? 16 : 12,
              height: dragging ? 16 : 12,
              transform: `translate(-50%, 0) ${dragging ? 'scale(1.1)' : ''}`,
            }}
            aria-hidden
          />
        )}

        {dragging && scrubIdx != null && (
          <div
            className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium tabular-nums text-white shadow-lg"
            style={{ left: `${thumbLeft}%` }}
            aria-hidden
          >
            Página {scrubIdx + 1}
          </div>
        )}
      </div>

      {/* I4: hover preview memoizado + hoverIdx com useDeferredValue para descolar do mousemove */}
      {showPreview && (
        <div
          className="pointer-events-none absolute z-30 hidden -translate-x-1/2 md:block"
          style={{
            left: `calc(${previewLeft}% )`,
            bottom: 'calc(100% + 10px)',
            maxWidth: 'min(220px, 40vw)',
          }}
          aria-hidden
        >
          <div className="overflow-hidden rounded-md border border-white/20 bg-white shadow-2xl ring-1 ring-black/40">
            <div className="w-[220px]">
              <DeferredPreview idx={hoverIdx} render={renderPreview!} />
            </div>
          </div>
          <div className="mt-1 text-center text-[10px] font-medium uppercase tabular-nums tracking-widest text-white/80">
            Página {hoverIdx + 1}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DeferredPreview — isola o custo do renderPreview:
 * - useDeferredValue no idx (React prioriza o mousemove ao invés do re-render caro)
 * - React.memo garante que só re-renderiza quando idxDeferred efetivamente muda
 */
const DeferredPreview = memo(({
  idx,
  render,
}: {
  idx: number;
  render: (index: number) => ReactNode;
}) => {
  const deferred = useDeferredValue(idx);
  return <>{render(deferred)}</>;
});
