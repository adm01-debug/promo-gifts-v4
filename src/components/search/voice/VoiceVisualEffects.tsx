import { useMemo, useId } from 'react';
import { motion } from 'framer-motion';
import type { PhaseColors } from './usePhaseColors';

/* ------------------------------------------------------------------ */
/*  Deterministic pseudo-random — stable across re-renders             */
/* ------------------------------------------------------------------ */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ------------------------------------------------------------------ */
/*  Flowing Wave Ring — SVG animated wave loops                        */
/* ------------------------------------------------------------------ */
export function FlowingWaveRing({
  radius,
  color,
  speed,
  amplitude,
  waves,
  opacity,
  strokeWidth = 1.5,
  reverse = false,
}: {
  radius: number;
  color: string;
  speed: number;
  amplitude: number;
  waves: number;
  opacity: number;
  strokeWidth?: number;
  reverse?: boolean;
}) {
  const filterId = useId();

  const paths = useMemo(() => {
    return Array.from({ length: waves }).map((_, w) => {
      const points: string[] = [];
      const segments = 100;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const waveOffset = Math.sin(angle * (3 + w) + w * 1.5) * amplitude * (1 + w * 0.25);
        const r = radius - 8 + waveOffset;
        const x = radius + r * Math.cos(angle);
        const y = radius + r * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      return points.join(' ');
    });
  }, [radius, amplitude, waves]);

  return (
    <motion.div
      className="absolute"
      style={{
        width: radius * 2,
        height: radius * 2,
        left: `calc(50% - ${radius}px)`,
        top: `calc(50% - ${radius}px)`,
      }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
    >
      <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
        <defs>
          <filter id={filterId}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {paths.map((points, w) => (
          <motion.polyline
            key={w}
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            filter={`url(#${filterId})`}
            animate={{
              opacity: [opacity * (1 - w * 0.12), opacity * 0.3, opacity * (1 - w * 0.12)],
            }}
            transition={{ duration: 2.5 + w * 0.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </svg>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Particle Field — sparkling dots orbiting the core                  */
/* ------------------------------------------------------------------ */
export function ParticleField({
  colors,
  count,
  radius,
  isActive,
}: {
  colors: string[];
  count: number;
  radius: number;
  isActive: boolean;
}) {
  const particles = useMemo(() => {
    const rand = seededRandom(42 + count);
    return Array.from({ length: count }).map((_, i) => ({
      angle: (i / count) * 360 + rand() * 25,
      dist: radius * 0.4 + rand() * radius * 0.65,
      size: 1 + rand() * 3.5,
      color: colors[i % colors.length],
      speed: 1.8 + rand() * 3,
      delay: rand() * 2.5,
    }));
  }, [colors, count, radius]);

  return (
    <>
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const x = Math.cos(rad) * p.dist;
        const y = Math.sin(rad) * p.dist;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: p.color,
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            }}
            animate={
              isActive
                ? {
                    opacity: [0.15, 1, 0.15],
                    scale: [0.4, 2, 0.4],
                    x: [0, Math.cos(rad) * 10, 0],
                    y: [0, Math.sin(rad) * 10, 0],
                  }
                : {
                    opacity: [0.1, 0.5, 0.1],
                    scale: [0.7, 1.3, 0.7],
                  }
            }
            transition={{
              duration: p.speed,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Light Rays — radial beams shooting from the core                   */
/* ------------------------------------------------------------------ */
export function LightRays({
  color1,
  color2,
  count,
  isActive,
}: {
  color1: string;
  color2: string;
  count: number;
  isActive: boolean;
}) {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360;
        const color = i % 2 === 0 ? color1 : color2;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              width: 1.5,
              background: `linear-gradient(to top, ${color}, transparent)`,
              left: '50%',
              top: '50%',
              transformOrigin: 'bottom center',
              transform: `rotate(${angle}deg) translateY(-50px)`,
              borderRadius: 2,
            }}
            animate={{
              opacity: isActive ? [0.05, 0.6, 0.05] : [0.03, 0.25, 0.03],
              height: isActive ? [25, 55, 25] : [12, 25, 12],
            }}
            transition={{
              duration: 1.2 + (i % 4) * 0.3,
              repeat: Infinity,
              delay: i * 0.12,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spectrum Waveform — brilliant animated bars                        */
/* ------------------------------------------------------------------ */
export function SpectrumWaveform({
  colors,
  isActive,
  isSpeaking,
}: {
  colors: PhaseColors;
  isActive: boolean;
  isSpeaking?: boolean;
}) {
  const barCount = 15;

  // Pre-compute stable random offsets
  const barOffsets = useMemo(() => {
    const rand = seededRandom(777);
    return Array.from({ length: barCount }).map(() => rand() * 0.25);
  }, [barCount]);

  return (
    <div className="flex h-8 items-center justify-center gap-[3px]">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = (barCount - 1) / 2;
        const distFromCenter = Math.abs(i - center) / center;
        // Speaking: smoother, wider bars. Listening: sharper, reactive bars
        const maxH = isActive
          ? isSpeaking
            ? 22 - distFromCenter * 8 // Speaking: more uniform, flowing
            : 26 - distFromCenter * 12 // Listening: peaky
          : 10 - distFromCenter * 5;
        const minH = isSpeaking ? 5 : 3;
        const color = i % 3 === 0 ? colors.primary : i % 3 === 1 ? colors.secondary : colors.accent;

        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: isSpeaking ? 3 : 2.5,
              background: `linear-gradient(to top, ${color}, ${colors.accent})`,
              boxShadow: `0 0 ${isSpeaking ? 8 : 6}px ${color}50`,
            }}
            animate={{ height: [minH, maxH, minH] }}
            transition={{
              duration: isActive
                ? isSpeaking
                  ? 0.55 + barOffsets[i] * 0.5 // Speaking: slower, wave-like
                  : 0.35 + barOffsets[i] // Listening: fast, reactive
                : 1 + barOffsets[i] * 2,
              repeat: Infinity,
              delay: isSpeaking ? i * 0.08 : i * 0.05, // Speaking: staggered wave effect
              ease: isSpeaking ? 'easeInOut' : 'easeInOut',
            }}
          />
        );
      })}
    </div>
  );
}
