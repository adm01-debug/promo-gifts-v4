/**
 * PresentationMode — Fullscreen slideshow for quotes/collections.
 * Shows products one per slide with clean, client-facing visuals.
 * Hides prices, internal data, menus.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize, Minimize, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PresentationSlide {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  description?: string | null;
  details?: Array<{ label: string; value: string }>;
  badge?: string | null;
}

interface PresentationModeProps {
  slides: PresentationSlide[];
  title: string;
  subtitle?: string;
  brandName?: string;
  onClose: () => void;
}

export function PresentationMode({
  slides,
  title,
  subtitle,
  brandName,
  onClose,
}: PresentationModeProps) {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout>>();

  const totalSlides = slides.length + 1; // +1 for title slide

  const goNext = useCallback(() => {
    setCurrent((prev) => Math.min(prev + 1, totalSlides - 1));
    setShowGrid(false);
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => Math.max(prev - 1, 0));
    setShowGrid(false);
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    setShowGrid(false);
  }, []);

  const exitFullscreen = useCallback(() => {
    document.exitFullscreen?.();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }, [exitFullscreen, containerRef]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'Escape':
          e.preventDefault();
          if (showGrid) setShowGrid(false);
          else if (isFullscreen) exitFullscreen();
          else onClose();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setShowGrid((prev) => !prev);
          break;
        case 'Home':
          e.preventDefault();
          goTo(0);
          break;
        case 'End':
          e.preventDefault();
          goTo(totalSlides - 1);
          break;
        // no default
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    goNext,
    goPrev,
    goTo,
    totalSlides,
    onClose,
    showGrid,
    isFullscreen,
    exitFullscreen,
    toggleFullscreen,
  ]);

  // Hide cursor after inactivity
  useEffect(() => {
    function handleMouseMove() {
      setCursorHidden(false);
      clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => setCursorHidden(true), 3000);
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(cursorTimer.current);
    };
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const slide = current === 0 ? null : slides[current - 1];

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-[9999] flex select-none flex-col bg-black',
        cursorHidden && 'cursor-none',
      )}
    >
      {/* Top bar — fades */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 transition-opacity duration-500',
          'bg-gradient-to-b from-black/60 to-transparent',
          cursorHidden ? 'opacity-0' : 'opacity-100',
        )}
      >
        <div className="text-sm font-medium text-white/80">{brandName || title}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid((prev) => !prev)}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Grade de slides (G)"
          >
            <Grid3X3 className="h-5 w-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Tela cheia (F)"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Fechar (Esc)"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {showGrid ? (
        <div className="flex-1 overflow-auto p-8 pt-20">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {/* Title slide thumbnail */}
            <button
              onClick={() => goTo(0)}
              className={cn(
                'aspect-video overflow-hidden rounded-lg border-2 transition-all hover:scale-105',
                current === 0 ? 'border-primary ring-2 ring-primary/50' : 'border-white/20',
              )}
            >
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
                <span className="line-clamp-2 text-center text-xs font-bold text-white">
                  {title}
                </span>
                {subtitle && (
                  <span className="mt-1 line-clamp-1 text-center text-[10px] text-white/60">
                    {subtitle}
                  </span>
                )}
              </div>
            </button>
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i + 1)}
                className={cn(
                  'relative aspect-video overflow-hidden rounded-lg border-2 transition-all hover:scale-105',
                  current === i + 1 ? 'border-primary ring-2 ring-primary/50' : 'border-white/20',
                )}
              >
                {s.imageUrl ? (
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700">
                    <span className="text-xs text-white/40">Sem imagem</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <span className="line-clamp-1 text-[10px] font-medium text-white">{s.title}</span>
                </div>
                <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                  {i + 2}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Slide content */
        <div className="relative flex flex-1 items-center justify-center">
          {/* Navigation arrows */}
          {current > 0 && (
            <button
              onClick={goPrev}
              className={cn(
                'absolute left-4 z-40 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20',
                cursorHidden ? 'opacity-0' : 'opacity-100',
              )}
              aria-label="Voltar"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {current < totalSlides - 1 && (
            <button
              onClick={goNext}
              className={cn(
                'absolute right-4 z-40 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20',
                cursorHidden ? 'opacity-0' : 'opacity-100',
              )}
              aria-label="Avançar"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Title Slide */}
          {current === 0 && (
            <div className="max-w-3xl animate-fade-in px-8 text-center">
              <h1 className="font-display text-5xl font-bold tracking-tight text-white md:text-7xl">
                {title}
              </h1>
              {subtitle && <p className="mt-6 text-xl text-white/60 md:text-2xl">{subtitle}</p>}
              <div className="mt-12 flex items-center justify-center gap-3 text-white/40">
                <span className="text-sm">
                  {slides.length} {slides.length === 1 ? 'produto' : 'produtos'}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span className="text-sm">Use ← → para navegar</span>
              </div>
              {brandName && <p className="mt-8 text-sm text-white/30">{brandName}</p>}
            </div>
          )}

          {/* Product Slide */}
          {slide && (
            <div className="flex h-full w-full animate-fade-in items-center justify-center px-8 md:px-16">
              <div className="flex w-full max-w-6xl flex-col items-center gap-8 md:flex-row md:gap-16">
                {/* Image */}
                <div className="flex max-h-[70vh] w-full flex-shrink-0 items-center justify-center md:w-1/2">
                  {slide.imageUrl ? (
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="max-h-[65vh] max-w-full rounded-2xl object-contain shadow-2xl"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-80 w-80 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <span className="text-lg text-white/20">Sem imagem</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="max-w-lg flex-1 space-y-4 text-left">
                  {slide.badge && (
                    <span className="inline-block rounded-full border border-primary/30 bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
                      {slide.badge}
                    </span>
                  )}
                  <h2 className="font-display text-3xl font-bold leading-tight text-white md:text-4xl">
                    {slide.title}
                  </h2>
                  {slide.subtitle && <p className="text-lg text-white/50">{slide.subtitle}</p>}
                  {slide.description && (
                    <p className="line-clamp-4 text-base leading-relaxed text-white/60">
                      {slide.description}
                    </p>
                  )}
                  {slide.details && slide.details.length > 0 && (
                    <div className="space-y-2 border-t border-white/10 pt-4">
                      {slide.details.map((d, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-sm text-white/40">{d.label}</span>
                          <span className="text-sm font-medium text-white/80">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom progress bar */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-50 transition-opacity duration-500',
          cursorHidden && !showGrid ? 'opacity-0' : 'opacity-100',
        )}
      >
        <div className="flex items-center justify-center gap-4 bg-gradient-to-t from-black/60 to-transparent px-6 py-4">
          <span className="text-sm tabular-nums text-white/50">
            {current + 1} / {totalSlides}
          </span>
          <div className="flex gap-1.5">
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === current ? 'w-8 bg-primary' : 'w-1.5 bg-white/30 hover:bg-white/50',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
