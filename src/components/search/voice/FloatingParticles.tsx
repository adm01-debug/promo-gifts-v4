import React, { useRef, useEffect, useCallback } from 'react';
import type { VoiceAgentPhase } from '@/hooks/intelligence';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
  life: number;
  maxLife: number;
}

interface FloatingParticlesProps {
  phase: VoiceAgentPhase;
  isBooting: boolean;
}

const PHASE_CONFIG: Record<
  string,
  { count: number; speed: number; hueRange: [number, number]; sizeRange: [number, number] }
> = {
  idle: { count: 20, speed: 0.3, hueRange: [220, 260], sizeRange: [1, 2.5] },
  listening: { count: 40, speed: 0.6, hueRange: [250, 290], sizeRange: [1.5, 3.5] },
  processing: { count: 35, speed: 0.8, hueRange: [270, 310], sizeRange: [1, 3] },
  speaking: { count: 50, speed: 0.5, hueRange: [200, 270], sizeRange: [1.5, 4] },
  error: { count: 25, speed: 0.4, hueRange: [0, 30], sizeRange: [1, 2.5] },
  booting: { count: 15, speed: 0.2, hueRange: [220, 260], sizeRange: [1, 2] },
};

const CONNECTION_DIST = 120;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const FloatingParticles = React.memo(({ phase, isBooting }: FloatingParticlesProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const configKey = isBooting ? 'booting' : phase;

  const createParticle = useCallback(
    (w: number, h: number, cfg: (typeof PHASE_CONFIG)['idle']): Particle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.5 + 0.5) * cfg.speed;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: lerp(cfg.sizeRange[0], cfg.sizeRange[1], Math.random()),
        opacity: Math.random() * 0.4 + 0.1,
        hue: lerp(cfg.hueRange[0], cfg.hueRange[1], Math.random()),
        life: 0,
        maxLife: 200 + Math.random() * 300,
      };
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();

    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const cfg = PHASE_CONFIG[configKey] || PHASE_CONFIG.idle;

      ctx.clearRect(0, 0, w, h);

      // Ensure particle count matches config
      while (particlesRef.current.length < cfg.count) {
        particlesRef.current.push(createParticle(w, h, cfg));
      }
      if (particlesRef.current.length > cfg.count + 10) {
        particlesRef.current.splice(cfg.count);
      }

      // First pass: update positions and compute alphas
      const alphas: number[] = [];
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;

        const lifeRatio = p.life / p.maxLife;
        let alpha = p.opacity;
        if (lifeRatio < 0.1) alpha *= lifeRatio / 0.1;
        else if (lifeRatio > 0.8) alpha *= (1 - lifeRatio) / 0.2;
        alphas[i] = alpha;

        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // Draw constellation lines
      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const lineAlpha = (1 - dist / CONNECTION_DIST) * Math.min(alphas[i], alphas[j]) * 0.6;
            const hue = (a.hue + b.hue) / 2;
            ctx.strokeStyle = `hsla(${hue}, 60%, 60%, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const alpha = alphas[i];

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${alpha})`);
        gradient.addColorStop(0.5, `hsla(${p.hue}, 60%, 50%, ${alpha * 0.3})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 40%, 30%, 0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 80%, ${alpha * 0.8})`;
        ctx.fill();

        if (p.life >= p.maxLife) {
          particles[i] = createParticle(w, h, cfg);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [configKey, createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ opacity: 0.7 }}
      aria-hidden="true"
    />
  );
});

FloatingParticles.displayName = 'FloatingParticles';
