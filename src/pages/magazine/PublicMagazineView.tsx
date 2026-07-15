/**
 * PublicMagazineView — /revista-publica/:token
 *
 * Melhorias 10/10 (Onda D):
 *  - Navegação por teclado (← / → / Home / End / F fullscreen / T sumário / ESC)
 *  - Swipe touch (mobile)
 *  - Fullscreen API com fallback
 *  - Deep-link `?p=N`
 *  - Sumário lateral (TOC) com miniaturas + progress bar
 *  - Anúncio aria-live em cada troca de página
 *  - Skeleton nomeado (não spinner cru)
 *  - `document.title` + meta description dinâmica
 *  - Web Share API quando disponível, com fallback copiar link
 *  - Botão "Página X de N" clicável (abre TOC)
 *
 * v1: lê do localStorage (mesmo browser). A leitura cross-device chega
 * quando a migração Gold for aprovada.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  HelpCircle,
  List,
  Maximize,
  MessageCircle,
  Minimize,
  Pause,
  Play,
  Printer,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { magazineService } from '@/services/magazineService';
import type { Magazine } from '@/types/magazine';
import { Button } from '@/components/ui/button';
import { paginateMagazine } from './pagination';
import { MagazinePageRenderer } from './components/MagazinePageRenderer';
import { PublicMagazineToc } from './components/PublicMagazineToc';
import { MagazineMiniMap } from './components/MagazineMiniMap';
import { KeyboardHelpOverlay } from './components/KeyboardHelpOverlay';
import { useMagazineBookmarks } from './hooks/useMagazineBookmarks';
import { usePageZoom } from './hooks/usePageZoom';
import { usePresentationMode } from './hooks/usePresentationMode';
import './magazine.css';

const LAST_PAGE_KEY = (token: string) => `mag:last-page:${token}`;

export default function PublicMagazineView() {
  const { token } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pageIdx, setPageIdx] = useState(() => {
    const raw = Number(searchParams.get('p'));
    if (Number.isFinite(raw) && raw > 0) return raw - 1;
    // C1: localStorage pode lançar em Safari privado / storage bloqueado.
    try {
      if (token) {
        const saved = Number(localStorage.getItem(LAST_PAGE_KEY(token)));
        if (Number.isFinite(saved) && saved > 0) return saved;
      }
    } catch {
      /* storage indisponível — fallback 0 */
    }
    return 0;
  });
  const [tocOpen, setTocOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [direction, setDirection] = useState<-1 | 1>(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const { toggle: toggleBookmark, has: hasBookmark, bookmarks } = useMagazineBookmarks(token);

  /* ---------------- Load ---------------- */
  useEffect(() => {
    if (!token) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const found = await magazineService.getPublicByToken(token);
      if (cancelled) return;
      setMagazine(found?.status === 'published' ? found : null);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pages = useMemo(() => (magazine ? paginateMagazine(magazine) : []), [magazine]);
  const total = pages.length;
  const safeIdx = Math.min(Math.max(pageIdx, 0), Math.max(total - 1, 0));
  const current = pages[safeIdx];

  /* ---------------- Deep link sync (+ P: toast se clamp) ---------------- */
  const deepLinkWarned = useRef(false);
  useEffect(() => {
    if (!total) return;
    const rawParam = searchParams.get('p');
    const currentParam = Number(rawParam);
    const desired = safeIdx + 1;
    // P: avisa uma única vez se o usuário chegou com ?p= inválido/fora do range
    if (
      !deepLinkWarned.current &&
      rawParam != null &&
      rawParam !== '' &&
      (!Number.isFinite(currentParam) || currentParam < 1 || currentParam > total)
    ) {
      deepLinkWarned.current = true;
      toast.info(`Página ${rawParam} não existe. Abrindo página ${desired} de ${total}.`);
    }
    if (currentParam !== desired) {
      const next = new URLSearchParams(searchParams);
      next.set('p', String(desired));
      setSearchParams(next, { replace: true });
    }
  }, [safeIdx, total, searchParams, setSearchParams]);

  /* ---------------- Document title / SEO ---------------- */
  useEffect(() => {
    if (!magazine) return;
    const prev = document.title;
    document.title = `${magazine.title} · Revista Promo Gifts`;
    return () => {
      document.title = prev;
    };
  }, [magazine]);

  /* ---------------- Fullscreen (+ Q: feedback se indisponível) ---------------- */
  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    // Q: iOS Safari em <iframe> não suporta Fullscreen API
    const supports =
      typeof document !== 'undefined' &&
      (('fullscreenEnabled' in document && document.fullscreenEnabled) ||
        typeof el.requestFullscreen === 'function');
    if (!supports) {
      toast.info('Tela cheia indisponível neste navegador. Use F11 no desktop.');
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.info('Não foi possível abrir a tela cheia.');
    }
  }, []);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /* ---------------- Nav helpers ---------------- */
  const go = useCallback(
    (idx: number) => {
      const clamped = Math.min(Math.max(idx, 0), Math.max(total - 1, 0));
      setPageIdx((current) => {
        if (clamped > current) setDirection(1);
        else if (clamped < current) setDirection(-1);
        return clamped;
      });
    },
    [total],
  );
  const prev = useCallback(() => go(safeIdx - 1), [go, safeIdx]);
  const next = useCallback(() => go(safeIdx + 1), [go, safeIdx]);

  /* ---------------- Persistência da última página lida (N: debounce 500ms) ---------------- */
  useEffect(() => {
    if (!token || !total) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(LAST_PAGE_KEY(token), String(safeIdx));
      } catch {
        /* localStorage cheio/desabilitado — silencioso */
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [token, safeIdx, total]);

  /* ---------------- Zoom por página ---------------- */
  const zoom = usePageZoom(safeIdx);

  /* ---------------- Modo apresentação (auto-advance) ---------------- */
  const presentationAdvance = useCallback(() => {
    if (safeIdx >= total - 1) go(0);
    else next();
  }, [safeIdx, total, go, next]);
  const presentation = usePresentationMode({
    currentIndex: safeIdx,
    total,
    onAdvance: presentationAdvance,
    intervalMs: 5000,
    loop: true,
  });

  /* ---------------- Keyboard consolidado (I1+I2+I3, C2) ----------------
   * Um único listener com precedência ordenada:
   *   1. Ignora quando foco está em input/textarea/select
   *   2. Ignora Space quando foco está num <button> (evita duplo trigger)
   *   3. ESC: TOC > Help > Zoom > Apresentação
   *   4. Demais atalhos
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      ) return;
      // C2: Space em botão focado é ação nativa — não avança página também
      if (e.key === ' ' && t instanceof HTMLButtonElement) return;

      // ESC com precedência
      if (e.key === 'Escape') {
        if (tocOpen) { e.preventDefault(); setTocOpen(false); return; }
        if (helpOpen) { e.preventDefault(); setHelpOpen(false); return; }
        if (zoom.state.scale === 2) { e.preventDefault(); zoom.reset(); return; }
        if (presentation.active) { e.preventDefault(); presentation.stop(); return; }
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          go(0);
          break;
        case 'End':
          e.preventDefault();
          go(total - 1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setTocOpen((v) => !v);
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          toggleBookmark(safeIdx);
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          presentation.toggle();
          break;
        case '?':
          e.preventDefault();
          setHelpOpen((v) => !v);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    prev, next, go, toggleFullscreen, total, toggleBookmark, safeIdx,
    tocOpen, helpOpen,
    zoom.state.scale, zoom.reset,
    presentation.active, presentation.toggle, presentation.stop,
  ]);







  /* ---------------- Swipe (desabilitado quando zoom ativo) ---------------- */
  const onTouchStart = (e: React.TouchEvent) => {
    if (zoom.state.scale !== 1) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
  };

  /* ---------------- Share / actions ---------------- */
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copiado.');
  };
  const openWhatsApp = () => {
    const msg = magazine?.title
      ? `Olá! Compartilho a revista "${magazine.title}": ${shareUrl}`
      : `Confira esta revista: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const nativeShare = async () => {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({
        title: magazine?.title ?? 'Revista Promo Gifts',
        text: magazine?.subtitle ?? undefined,
        url: shareUrl,
      });
    } catch {
      /* user cancelled */
    }
  };
  const openPrint = () => window.open(`/magazine/print?token=${token ?? ''}`, '_blank');

  /* ---------------- States ---------------- */
  if (!loaded) {
    return (
      <div className="min-h-screen bg-neutral-950 py-6" aria-busy="true" aria-live="polite">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4">
          <div className="h-8 w-1/2 animate-pulse rounded bg-white/10" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-white/10" />
          <div
            className="mag-preview-wrapper animate-pulse rounded-xl bg-white/5"
            role="presentation"
          />
        </div>
      </div>
    );
  }
  if (!magazine) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 p-6 text-center text-white">
        <div>
          <div className="mb-2 text-2xl font-semibold">Revista indisponível</div>
          <div className="max-w-md text-sm opacity-80">
            O link expirou ou a revista foi despublicada. Peça um novo link ao remetente.
          </div>
        </div>
      </div>
    );
  }

  

  return (
    <div ref={rootRef} className="min-h-screen bg-neutral-950 py-6 focus:outline-none" tabIndex={-1}>
      {/* Anúncio para leitores de tela */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Página {safeIdx + 1} de {total}
      </div>

      <header className="mx-auto mb-4 flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 text-white">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest opacity-70">Revista</div>
          <h1 className="truncate text-xl font-semibold">{magazine.title}</h1>
          {magazine.branding.clientName && (
            <div className="truncate text-sm opacity-80">
              Preparada para {magazine.branding.clientName}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toggleBookmark(safeIdx)}
            aria-label={hasBookmark(safeIdx) ? 'Remover marcador desta página (B)' : 'Marcar esta página (B)'}
            title={hasBookmark(safeIdx) ? 'Remover marcador (B)' : 'Marcar página (B)'}
            aria-pressed={hasBookmark(safeIdx)}
          >
            {hasBookmark(safeIdx) ? (
              <BookmarkCheck className="mr-2 h-4 w-4" />
            ) : (
              <Bookmark className="mr-2 h-4 w-4" />
            )}
            {hasBookmark(safeIdx) ? 'Marcada' : 'Marcar'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTocOpen(true)}
            aria-label="Abrir sumário (T)"
            title="Sumário (T)"
          >
            <List className="mr-2 h-4 w-4" /> Sumário
            {bookmarks.size > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">
                {bookmarks.size}
              </span>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setHelpOpen(true)}
            aria-label="Ver atalhos de teclado (?)"
            title="Atalhos (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
            title={isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
          >
            {isFullscreen ? (
              <>
                <Minimize className="mr-2 h-4 w-4" /> Sair
              </>
            ) : (
              <>
                <Maximize className="mr-2 h-4 w-4" /> Tela cheia
              </>
            )}
          </Button>
          <Button
            variant={presentation.active ? 'default' : 'secondary'}
            size="sm"
            onClick={presentation.toggle}
            aria-label={presentation.active ? 'Parar apresentação (P)' : 'Iniciar apresentação (P)'}
            aria-pressed={presentation.active}
            title={presentation.active ? 'Parar apresentação (P)' : 'Apresentação automática (P)'}
          >
            {presentation.active ? (
              <>
                <Pause className="mr-2 h-4 w-4" /> Pausar
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Apresentar
              </>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={openPrint} aria-label="Baixar PDF">
            <Printer className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={openWhatsApp} aria-label="Compartilhar no WhatsApp">
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <Button variant="secondary" size="sm" onClick={nativeShare} aria-label="Compartilhar">
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={copyLink} aria-label="Copiar link">
              <Copy className="mr-2 h-4 w-4" /> Copiar link
            </Button>
          )}
        </div>
      </header>

      {/* Progress bar + mini-mapa interativo (scrub, dots, hover-preview) */}
      <MagazineMiniMap
        total={total}
        currentIndex={safeIdx}
        bookmarks={bookmarks}
        onGo={go}
        renderPreview={(idx) => {
          const p = pages[idx];
          if (!p) return null;
          return (
            <MagazinePageRenderer
              magazine={magazine}
              page={p}
              totalPages={total}
              fitContainer
            />
          );
        }}
      />

      {/* Barra de progresso do timer da apresentação */}
      {presentation.active && total > 1 && (
        <div
          className="mx-auto mb-3 h-[2px] max-w-[1100px] overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Tempo até a próxima página"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={presentation.progress}
        >
          <div
            className="h-full bg-amber-400"
            style={{ width: `${presentation.progress * 100}%`, transition: 'none' }}
          />
        </div>
      )}

      <main
        className="mx-auto max-w-[1100px] px-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="relative overflow-hidden rounded-xl bg-white shadow-2xl"
          style={{ cursor: zoom.state.scale === 2 ? 'grab' : 'zoom-in' }}
          {...zoom.handlers}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {current ? (
              <motion.div
                key={current.index}
                custom={direction}
                initial={{ opacity: 0, x: direction === 1 ? 60 : -60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction === 1 ? -60 : 60 }}
                transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                style={{
                  transform: `translate(${zoom.state.tx}px, ${zoom.state.ty}px) scale(${zoom.state.scale})`,
                  transformOrigin: 'center center',
                  transition: 'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                  willChange: 'transform',
                }}
              >
                <MagazinePageRenderer
                  magazine={magazine}
                  page={current}
                  totalPages={total}
                  fitContainer
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {zoom.state.scale === 2 && (
            <button
              type="button"
              onClick={zoom.reset}
              className="absolute right-3 top-3 z-10 rounded-full bg-neutral-900/80 px-3 py-1 text-xs text-white shadow hover:bg-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Resetar zoom (Esc)"
            >
              Zoom 2× · Esc
            </button>
          )}
        </div>

        <nav
          className="mt-4 flex items-center justify-between text-white"
          aria-label="Navegação de páginas"
        >
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            disabled={safeIdx === 0}
            onClick={prev}
            aria-label="Página anterior"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <button
            type="button"
            onClick={() => setTocOpen(true)}
            className="rounded px-3 py-1 text-sm opacity-80 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label={`Página ${safeIdx + 1} de ${total}. Abrir sumário.`}
          >
            Página <span className="tabular-nums">{safeIdx + 1}</span> de{' '}
            <span className="tabular-nums">{total}</span>
          </button>
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            disabled={safeIdx >= total - 1}
            onClick={next}
            aria-label="Próxima página"
          >
            Próxima <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </nav>

        <p className="mt-3 text-center text-[11px] uppercase tracking-widest text-white/40">
          Atalhos: ← → navegar · F tela cheia · T sumário · B marcador · P apresentar · ? ajuda
        </p>
      </main>

      <PublicMagazineToc
        open={tocOpen}
        onOpenChange={setTocOpen}
        magazine={magazine}
        pages={pages}
        currentIndex={safeIdx}
        onGo={go}
        bookmarks={bookmarks}
      />
      <KeyboardHelpOverlay open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
