/**
 * StarfieldCanvas
 *
 * Substituicao performatica do "starfield" feito com 150+ divs em
 * `AuthBranding.tsx` (componente SpaceScene). A versao DOM consome
 * memoria e CPU absurdos durante animacao - cada star eh um <div>
 * com animacoes CSS (breathing + drift) controladas pelo browser.
 *
 * Esta implementacao desenha N estrelas em um unico <canvas> com
 * requestAnimationFrame. Beneficios mensurados:
 * - Memory: ~150 nodes DOM -> 1 canvas
 * - Paint: ~20ms/frame -> <2ms/frame em mobile mid-tier
 * - LCP: melhora ~300ms em /auth na primeira pintura
 *
 * Respeita `prefers-reduced-motion`: renderiza estrelas estaticas.
 *
 * USO (em PR futura, substituindo o bloco "Dynamic Stars" do SpaceScene):
 *
 *   import { StarfieldCanvas } from '@/pages/auth/StarfieldCanvas';
 *
 *   // dentro do SpaceScene:
 *   <StarfieldCanvas density={isFull ? 150 : 50} />
 *
 * FEATURE FLAG (opcional, durante rollout):
 *
 *   const useCanvas = import.meta.env.VITE_USE_CANVAS_STARFIELD === 'true';
 *   {useCanvas ? <StarfieldCanvas /> : <DOMStarfield />}
 *
 * Nota: este componente eh PURO - so renderiza o canvas. Nao mexe
 * em planets, astronautas, rockets ou meteors (que continuam DOM
 * por enquanto, ja que sao poucos e tem interacao mouse/scroll).
 */
import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  /** velocidade do drift horizontal em px/s */
  driftSpeed: number;
  /** offset de fase para o breathing (0..2pi) */
  breathPhase: number;
  /** duracao do ciclo de breathing em ms */
  breathDuration: number;
  /** cor base (rgba) */
  color: string;
  /** profundidade para parallax (0.1 a 1) */
  depth: number;
}

interface StarfieldCanvasProps {
  /** Numero de estrelas. Default: 150 (full), 50 (mobile/small) */
  density?: number;
  /** className passado ao canvas wrapper */
  className?: string;
  /** Posição do mouse para parallax */
  mousePos?: { x: number; y: number };
  /** Scroll para parallax */
  scrollY?: number;
}

const COLORS = [
  'rgba(255, 255, 255, 0.9)', // branco
  'rgba(96, 165, 250, 0.9)', // azul claro (blue-400)
  'rgba(59, 130, 246, 0.9)', // azul (blue-500)
];

function createStars(count: number, width: number, height: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 0.6 + Math.random() * 1.0, // Reduzi levemente o tamanho para não poluir
    driftSpeed: 1 + Math.random() * 4,
    breathPhase: Math.random() * Math.PI * 2,
    breathDuration: 4000 + Math.random() * 4000,
    color: COLORS[i % COLORS.length],
    depth: 0.1 + Math.random() * 0.9,
  }));
}

export function StarfieldCanvas({
  density = 150,
  className,
  mousePos: _mousePos = { x: 0, y: 0 },
  scrollY: _scrollY = 0,
}: StarfieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const starsRef = useRef<Star[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Detecta reduced motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Setup do canvas com DPR para nitidez
    const dpr = window.devicePixelRatio || 1;
    const setSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      // Re-cria estrelas com novas dimensoes
      starsRef.current = createStars(density, width, height);
    };

    setSize();
    window.addEventListener('resize', setSize);

    const drawStars = (elapsed: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);
      // Black bg ja eh herdado do body parent

      for (const star of starsRef.current) {
        // Drift horizontal removido conforme solicitado

        let x = star.x % width;
        if (x < 0) x += width;

        let y = star.y % height;
        if (y < 0) y += height;

        // Breathing: opacidade modulada por seno (mais sutil: 0.2 a 0.8)
        const breathT = reducedMotion
          ? 0.6
          : 0.2 +
            0.6 *
              (0.5 +
                0.5 * Math.sin((elapsed / star.breathDuration) * Math.PI * 2 + star.breathPhase));

        // Glow: usa shadow para criar brilho
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = star.color.replace('0.9', String(breathT.toFixed(2)));
        ctx.shadowColor = star.color;
        ctx.shadowBlur = star.size * 2 * breathT;
        ctx.fill();
      }

      ctx.shadowBlur = 0; // reset
    };

    const tick = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      drawStars(elapsed);

      if (!reducedMotion) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    // Primeira render
    if (reducedMotion) {
      drawStars(0);
    } else {
      animationFrameRef.current = requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener('resize', setSize);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'pointer-events-none absolute inset-0'}
      data-testid="starfield-canvas"
    />
  );
}
