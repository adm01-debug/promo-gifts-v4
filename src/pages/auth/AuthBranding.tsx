/**
 * Left-side branding panel for Auth page — extracted for modularity
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Package, Factory, SlidersHorizontal, Brain, Rocket } from 'lucide-react';
import { AppLogo } from '@/components/layout/AppLogo';
import astronautSvg from '@/assets/astronaut.svg';
import { StarfieldCanvas } from '@/pages/auth/StarfieldCanvas';

interface RocketData {
  id: number;
  left: number;
  size: number;
  duration: number;
  rotation: number;
  scale: number;
}
interface PlanetData {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  type: number;
  delay: number;
}
interface AstronautData {
  id: number;
  left: number;
  top: number;
  size?: number;
  rotation: number;
  zIndex: number;
  depth: number;
  initialAngle: number;
  individualScale?: number;
  individualOpacity?: number;
}
interface StarData {
  id: number;
  size: number;
  top: number;
  left: number;
  breathingDur: number;
  breathingDelay: number;
  driftDur: number;
}
interface MeteorData {
  id: number;
  top: number;
  left: number;
  duration: number;
  delay: number;
}

export const SpaceScene = React.memo(({ isFull = true }: { isFull?: boolean }) => {
  const [rockets, setRockets] = useState<RocketData[]>([]);
  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [astronauts, setAstronauts] = useState<AstronautData[]>([]);
  const [meteors] = useState<MeteorData[]>([]);
  const [, setMousePos] = useState({ x: 0, y: 0 });
  const [, setScrollY] = useState(0);

  // Parâmetros controláveis expandidos
  const [config, setConfig] = useState({
    astroCount: 4,
    speed: 0.2,
    spacing: 1.0,
    parallaxIntensity: 1.0,
    depthProfile: 1.0,
    showControls: false,
    reducedMotion: false,
    individualAstronauts: [] as { id: number; scale: number; opacity: number }[],
  });

  const nextIdRef = useRef(0);
  const starsRef = useRef<StarData[]>([]);

  // Etapa 12b: feature flag para rollout gradual do StarfieldCanvas.
  // Default: true (canvas ativo). Para reverter ao DOM legacy, setar
  // VITE_USE_CANVAS_STARFIELD=false no Vercel.
  const useCanvasStarfield = import.meta.env.VITE_USE_CANVAS_STARFIELD !== 'false';

  // Detecta prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () =>
      setConfig((prev) => ({ ...prev, reducedMotion: mediaQuery.matches }));
    mediaQuery.addEventListener('change', handleChange);
    if (mediaQuery.matches) setConfig((prev) => ({ ...prev, reducedMotion: true }));
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Parallax desativado conforme solicitado para evitar movimento lateral da tela
  useEffect(() => {
    setMousePos({ x: 0, y: 0 });
    setScrollY(0);
  }, []);

  if (starsRef.current.length === 0) {
    starsRef.current = [...Array(150)].map((_, i) => ({
      id: i,
      size: 0.8 + (i % 3) * 0.4,
      top: (i * 137.7) % 100,
      left: (i * 149.3) % 100,
      breathingDur: 4 + (i % 4),
      breathingDelay: (i % 4) * 0.05,
      driftDur: 120 + (i % 40),
    }));
  }

  const activeStars = isFull ? starsRef.current : starsRef.current.slice(0, 50);

  const spawnRocket = useCallback(() => {
    const id = nextIdRef.current++;
    const newRocket: RocketData = {
      id,
      left: Math.random() * 80 + 10,
      size: 30 + Math.random() * 40,
      // Aumentado o tempo de subida (duration) para os foguetes ficarem mais devagar
      duration: 12 + Math.random() * 5,
      rotation: Math.random() * 10 - 5,
      scale: 0.8 + Math.random() * 0.4,
    };
    setRockets((prev) => [...prev, newRocket]);
    setTimeout(() => {
      setRockets((prev) => prev.filter((r) => r.id !== id));
    }, newRocket.duration * 1000);
  }, []);

  useEffect(() => {
    // Aumentado o intervalo entre os lançamentos de foguetes (de 2000ms para 6000ms)
    const rocketInterval = setInterval(() => spawnRocket(), 6000);

    // Meteor shower removido para eliminar linhas rápidas atravessando a tela

    setPlanets(
      [...Array(5)].map((_, i) => ({
        id: i,
        left: 10 + i * 18,
        top: 15 + i * 15,
        size: 60 + Math.random() * 100,
        duration: 25 + Math.random() * 15,
        type: i % 3,
        delay: Math.random() * 5,
      })),
    );

    // Layout base para astronautas com ângulos iniciais diferentes para órbita
    const baseLayout = [
      { left: 15, top: 20, depth: 0.3, rotation: -8, zIndex: 5, initialAngle: 0 },
      { left: 75, top: 30, depth: 0.5, rotation: 12, zIndex: 10, initialAngle: 90 },
      { left: 25, top: 65, depth: 0.8, rotation: -15, zIndex: 15, initialAngle: 180 },
      { left: 65, top: 70, depth: 1.2, rotation: 20, zIndex: 20, initialAngle: 270 },
      { left: 45, top: 45, depth: 0.6, rotation: 45, zIndex: 12, initialAngle: 45 },
      { left: 10, top: 85, depth: 0.4, rotation: -30, zIndex: 8, initialAngle: 135 },
    ];

    setAstronauts(
      baseLayout.slice(0, config.astroCount).map((a, i) => {
        const individual = config.individualAstronauts.find((idx) => idx.id === i);
        return {
          id: i,
          ...a,
          left: 50 + (a.left - 50) * config.spacing,
          top: 50 + (a.top - 50) * config.spacing,
          individualScale: individual?.scale ?? 1.0,
          individualOpacity: individual?.opacity ?? 1.0,
        };
      }),
    );

    return () => {
      clearInterval(rocketInterval);
    };
  }, [spawnRocket, config.astroCount, config.spacing, config.individualAstronauts]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-visible"
      aria-hidden="true"
      data-testid="space-scene"
    >
      {/* Background Deep Space Glow & Nebula */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0)_0%,rgba(2,6,23,0.6)_100%)]" />

      {/* Atmospheric Nebula Layers (10/10 Depth) */}
      <div
        className="fixed inset-0 opacity-10 blur-[80px]"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, #1e40af 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #1e3a8a 0%, transparent 50%)',
          // Animação nebulaDrift removida para evitar movimento lateral
        }}
      />

      <div
        className="fixed inset-0 opacity-[0.03] blur-[120px]"
        style={{
          background: 'radial-gradient(circle at 60% 40%, #1e40af 0%, transparent 40%)',
          // Animação nebulaDrift removida para evitar movimento lateral
        }}
      />

      {/* Space Dust Layer - Profundidade Extra */}
      <div className="fixed inset-0 opacity-30">
        {[...Array(20)].map((_, i) => (
          <div
            key={`dust-${i}`}
            className="absolute rounded-full bg-white/40"
            style={{
              width: '1px',
              height: '1px',
              top: `${(i * 17) % 100}%`,
              left: `${(i * 23) % 100}%`,
              // Animação starDrift removida para evitar movimento lateral
              backgroundColor:
                i % 5 === 0 ? '#3b82f6' : i % 7 === 0 ? '#60A5FA' : 'rgba(255,255,255,0.4)',
              boxShadow: i % 5 === 0 ? '0 0 4px #3b82f6' : i % 7 === 0 ? '0 0 4px #60A5FA' : 'none',
              opacity: i % 3 === 0 ? 0.4 : 0.2,
            }}
          />
        ))}
      </div>

      {/* Dynamic Stars - Etapa 12: canvas único por padrão; DOM legacy via flag */}
      {useCanvasStarfield ? (
        <StarfieldCanvas
          density={isFull ? 300 : 100}
          className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
          mousePos={{ x: 0, y: 0 }}
          scrollY={0}
        />
      ) : (
        activeStars.map((star) => (
          <div
            key={`star-container-${star.id}`}
            className="absolute transition-[top,left] duration-1000 ease-in-out"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              // Animação starDrift removida para evitar movimento lateral
              willChange: 'opacity',
            }}
          >
            <div
              className="h-full w-full rounded-full bg-white"
              data-testid={`star-breathing-${star.id}`}
              style={{
                animation: `breathingStar ${star.breathingDur}s ease-in-out ${star.breathingDelay}s infinite`,
                willChange: 'opacity, transform, filter',
                mixBlendMode: 'screen',
              }}
            />
          </div>
        ))
      )}

      {/* Planets with zigzag trajectory — pulados em prefers-reduced-motion (P2-03) */}
      {!config.reducedMotion &&
        planets.map((p) => (
          <div
            key={`planet-${p.id}`}
            className="absolute opacity-25 blur-[0.5px]"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              top: `${p.top}%`,
              // Animação zigzagMovement removida para evitar movimento lateral
              willChange: 'opacity',
              background:
                p.type === 0
                  ? 'radial-gradient(circle at 30% 30%, #0B1E47, #000000)'
                  : p.type === 1
                    ? 'radial-gradient(circle at 30% 30%, #0A1F4D, #000000)'
                    : 'radial-gradient(circle at 30% 30%, #0C2456, #000000)',
              borderRadius: '50%',
              boxShadow: 'inset -12px -12px 24px rgba(0,0,0,0.75), 0 0 24px rgba(15, 23, 60, 0.15)',
            }}
          />
        ))}

      {/* Floating Astronauts — Sincronizados, Menores e com Parallax Mouse + Scroll */}
      {!config.reducedMotion &&
        astronauts.map((a, _idx) => {
          // Tamanhos reduzidos e escala baseada na profundidade, perfil global e ajuste individual
          const baseSize = 35;
          const size = baseSize * a.depth * config.depthProfile * (a.individualScale ?? 1.0);

          // Opacidade baseada no perfil global, profundidade e ajuste individual
          const opacity =
            (0.12 + a.depth * 0.2) * config.depthProfile * (a.individualOpacity ?? 1.0);

          // Parallax removido - valores estáticos
          const translateX = 0;
          const translateY = 0;

          // Órbita circular suave (circularOrbit) — Sincronizada via delay negativo

          return (
            <div
              key={`astro-${a.id}`}
              className="absolute transition-transform duration-1000 ease-out"
              style={{
                left: `${a.left}%`,
                top: `${a.top}%`,
                opacity,
                zIndex: a.zIndex,
                transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
                willChange: 'transform, opacity',
              }}
            >
              <div
                className="relative"
                style={{
                  // Animações de movimento removidas
                  animation: `none`,
                  animationDelay: `0s`,
                  // Rim lighting and glassmorphism effect (10/10)
                  filter: `brightness(0.65) drop-shadow(0 0 ${size / 8}px rgba(6, 135, 255, 0.2)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.3))`,
                }}
              >
                <img
                  src={astronautSvg}
                  alt=""
                  className="animate-pulse"
                  style={{
                    width: size,
                    height: size,
                    transform: `rotate(${a.rotation}deg)`,
                    animation: 'pulse 3s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          );
        })}

      {/* Shooting Stars (Meteors) 10/10 */}
      {meteors.map((m) => (
        <div
          key={`meteor-${m.id}`}
          className="absolute h-[1px] w-[150px] bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
          style={{
            top: `${m.top}%`,
            left: `${m.left}%`,
            animation: `shootingStar ${m.duration}s ease-out forwards`,
          }}
        />
      ))}

      {/* Rockets rising from bottom to top */}
      {rockets.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-[-100px]"
          style={{
            left: `${r.left}%`,
            animation: `rocketRising ${r.duration}s linear forwards`,
            willChange: 'transform, opacity',
          }}
        >
          <div
            style={{
              transform: `scale(${r.scale}) rotate(${r.rotation}deg)`,
              filter: `drop-shadow(0 0 ${r.size / 2}px rgba(59, 130, 246, 0.4))`,
            }}
          >
            <Rocket
              className="-rotate-45 text-blue-400"
              style={{
                width: r.size,
                height: r.size,
                filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.7))',
              }}
            />
            {/* Dynamic Flame Trail (Refined for 10/10) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 animate-pulse rounded-full opacity-80"
              style={{
                top: `${r.size * 0.8}px`,
                width: `${r.size * 0.4}px`,
                height: `${r.size * 2}px`,
                background: 'linear-gradient(to bottom, #3b82f6, #60a5fa, #2563eb, transparent)',
                filter: 'blur(6px)',
                zIndex: -1,
                boxShadow: `0 0 ${r.size}px rgba(59, 130, 246, 0.6)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
});

// Mantemos o Starfield por compatibilidade se necessário, mas o SpaceScene é o principal agora
export const Starfield = React.memo(() => <SpaceScene isFull={false} />);
SpaceScene.displayName = 'SpaceScene';
Starfield.displayName = 'Starfield';

function FeatureCard({ item, index }: { item: (typeof FEATURE_ITEMS)[0]; index: number }) {
  const IconComponent = item.icon;
  return (
    <div
      className="group relative flex h-[88px] items-center justify-between gap-3 overflow-hidden rounded-3xl border border-white/10 bg-black/40 px-5 opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-500 hover:scale-[1.05] hover:border-blue-500/50 hover:bg-black/60"
      style={{
        animation: `scale-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${300 + index * 150}ms forwards`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 h-full w-full">
        <div className="absolute -left-[100%] top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent group-hover:animate-[shimmerTranslate_2s_infinite]" />
      </div>

      <div className="relative z-10 min-w-0 flex-1 text-left">
        <p className="font-display text-xl font-bold leading-tight tracking-tight text-white">
          {item.label}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-[0.18em] text-white/50">
          {item.desc}
        </p>
      </div>
      <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-blue-500/10 shadow-inner transition-all duration-500 group-hover:rotate-[8deg] group-hover:bg-blue-500/20">
        <IconComponent className="h-[1.4rem] w-[1.4rem] text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
      </div>
    </div>
  );
}

const FEATURE_ITEMS = [
  { label: '+20.000', desc: 'PRODUTOS', icon: Package },
  { label: '+100', desc: 'FORNECEDORES', icon: Factory },
  { label: 'Filtros', desc: 'AVANÇADOS', icon: SlidersHorizontal },
  { label: 'IA', desc: 'ASSISTENTE PESSOAL', icon: Brain },
];

export function AuthBrandingPanel({ onLogoClick }: { onLogoClick?: () => void }) {
  return (
    <div className="relative flex min-h-screen w-full items-center lg:w-1/2">
      {/* Content */}
      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-12 lg:translate-x-[5%] xl:translate-x-[10%] xl:px-20">
        <div className="flex w-full max-w-xl flex-col items-center space-y-6 text-center">
          <div className="flex items-center gap-4">
            <AppLogo
              variant="light"
              iconClassName="h-[3.25rem] w-[3.25rem] rounded-xl shadow-blue-500/40"
              textClassName="text-4xl"
              onClick={onLogoClick}
            />
          </div>

          <div className="flex max-w-lg flex-col items-center space-y-5">
            <h2 className="group relative text-center font-display text-4xl font-bold leading-[1.05] tracking-tight text-white xl:text-5xl">
              Um Universo de Brindes, para o{' '}
              <span className="text-blue-400">
                Melhor Time das{' '}
                <span className="relative inline-block">
                  Galáxias!
                  <span className="absolute -bottom-2 left-0 right-0 h-1 scale-x-0 bg-gradient-to-r from-blue-400/0 via-blue-400/60 to-blue-400/0 shadow-[0_0_18px_rgba(59,130,246,0.6)] transition-transform duration-700 group-hover:scale-x-100" />
                </span>
              </span>
            </h2>
            <p className="max-w-md text-center text-[0.95rem] font-light leading-relaxed text-white/60">
              Tenha acesso ao maior mix de produtos personalizados, consulte estoque em tempo real,
              visualize locais e técnicas de personalização. Feito especialmente para você
              decolar!!!
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 pt-6 sm:gap-5">
            {FEATURE_ITEMS.map((item, i) => (
              <FeatureCard key={i} item={item} index={i} />
            ))}
          </div>

          {/* Trust Indicators */}
          <div
            className="flex flex-wrap items-center justify-center gap-6 pt-12 opacity-0"
            style={{ animation: 'scale-fade-in 0.6s ease-out 1000ms forwards' }}
          >
            {[
              {
                label: 'Conexão segura',
                icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
              },
              {
                label: 'Dados criptografados',
                icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
              },
            ].map((item, i) => (
              <div key={i} className="group flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                  <svg
                    className="h-4 w-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={item.icon}
                    />
                  </svg>
                </div>
                <span className="text-xs font-medium text-white/40 transition-colors group-hover:text-white/60">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
