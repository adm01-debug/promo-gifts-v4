/**
 * MagazineMiniMap — barra de progresso interativa:
 *  - Clique/arraste em qualquer ponto para pular (scrub)
 *  - Dots âmbar dos marcadores clicáveis
 *  - Thumb (indicador) da página atual
 *  - Tooltip flutuante durante o arrasto
 *  - Mouse + touch, acessível (role=slider + keyboard já vem do viewer)
 */
import { useCallback, useRef, useState } from 'react';

interface Props {
  total: number;
  currentIndex: number;
  bookmarks: Set<number>;
  onGo: (index: number) => void;
}

export function MagazineMiniMap({ total, currentIndex, bookmarks, onGo }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const progressPct = total > 1 ? ((currentIndex + 1) / total) * 100 : 100;
  const previewIdx = scrubIdx ?? currentIndex;
  const previewLeft = total > 1 ? (previewIdx / Math.max(total - 1, 1)) * 100 : 0;

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

  return (
    <div className="relative mx-auto mb-3 max-w-[1100px]">
      {/* Track hitbox generoso (h-4) para facilitar arraste sem engordar visual */}
      <div
        ref={trackRef}
        className="group relative flex h-4 cursor-pointer items-center"
        role="slider"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentIndex + 1}
        aria-label={`Progresso da leitura: página ${currentIndex + 1} de ${total}. Arraste para pular.`}
        tabIndex={0}
        onMouseDown={(e) => {
          e.preventDefault();
          handleDown(e.clientX);
        }}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
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
        {/* trilha */}
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10 transition-[height] group-hover:h-[5px]">
          <div
            className="h-full bg-white/80 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* dots de marcadores */}
        {total > 1 &&
          Array.from(bookmarks).map((idx) => {
            const left = (idx / Math.max(total - 1, 1)) * 100;
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
                className="absolute -translate-x-1/2 rounded-full bg-amber-400 shadow ring-2 ring-neutral-950 transition hover:scale-125 focus:outline-none focus-visible:ring-white"
                style={{ left: `${left}%`, width: 10, height: 10 }}
                aria-label={`Ir para página marcada ${idx + 1}`}
                title={`Marcador · página ${idx + 1}`}
              />
            );
          })}

        {/* thumb da página atual */}
        {total > 1 && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-white shadow-lg ring-2 ring-neutral-950 transition-transform"
            style={{
              left: `${previewLeft}%`,
              width: dragging ? 16 : 12,
              height: dragging ? 16 : 12,
              transform: `translate(-50%, 0) ${dragging ? 'scale(1.1)' : ''}`,
            }}
            aria-hidden
          />
        )}

        {/* tooltip durante scrub */}
        {dragging && scrubIdx != null && (
          <div
            className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium tabular-nums text-white shadow-lg"
            style={{ left: `${previewLeft}%` }}
            aria-hidden
          >
            Página {scrubIdx + 1}
          </div>
        )}
      </div>
    </div>
  );
}
