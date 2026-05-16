/**
 * Left-side branding panel for Auth page — extracted for modularity
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Gift, Package, Factory, SlidersHorizontal, Brain, Rocket } from "lucide-react";
import { AppLogo } from "@/components/layout/AppLogo";

interface RocketData { id: number; left: number; size: number; duration: number; rotation: number; scale: number; }
interface PlanetData { id: number; left: number; top: number; size: number; duration: number; type: number; delay: number; }
interface AstronautData { id: number; left: number; top: number; size: number; duration: number; delay: number; rotation: number; }
interface StarData { id: number; size: number; top: number; left: number; breathingDur: number; breathingDelay: number; driftDur: number; }

export const SpaceScene = React.memo(({ isFull = true }: { isFull?: boolean }) => {
  const [rockets, setRockets] = useState<RocketData[]>([]);
  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [astronauts, setAstronauts] = useState<AstronautData[]>([]);
  const nextIdRef = useRef(0);

  // Estabilizamos os dados das estrelas para evitar o "salto" em re-renders
  const stars = React.useMemo(() => {
    const count = isFull ? 70 : 35;
    return [...Array(count)].map((_, i) => ({
      id: i,
      size: 1 + (i % 3),
      top: Math.random() * 100,
      left: Math.random() * 100,
      // Respiração humana: ~12–16s por ciclo
      breathingDur: 12 + Math.random() * 4,
      breathingDelay: Math.random() * 10,
      // Deriva estelar: extremamente lenta (80-120s)
      driftDur: 80 + Math.random() * 40,
    }));
  }, [isFull]);

  const spawnRocket = useCallback((isInitial = false) => {
// ... keep existing code
    return () => clearInterval(rocketInterval);
  }, [spawnRocket]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
      {/* Dynamic Stars with breathing and slow drift effects */}
      {stars.map((star) => (
        <div
          key={`star-${star.id}`}
          className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          style={{
            width: `${star.size}px`,
            height: `${star.size}px`,
            top: `${star.top}%`,
            left: `${star.left}%`,
            // Combinando respiração (opacidade/escala) com deriva (posição)
            animation: `
              breathingStar ${star.breathingDur}s ease-in-out ${star.breathingDelay}s infinite,
              starDrift ${star.driftDur}s linear infinite alternate
            `
          }}
        />
      ))}

      {/* Planets with zigzag trajectory */}
      {planets.map(p => (
        <div
          key={`planet-${p.id}`}
          className="absolute opacity-35 blur-[0.5px]"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animation: `zigzagMovement ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            background: p.type === 0 
              ? 'radial-gradient(circle at 30% 30%, #1E3A8A, #030712)' 
              : p.type === 1 
                ? 'radial-gradient(circle at 30% 30%, #1E40AF, #111827)'
                : 'radial-gradient(circle at 30% 30%, #1D4ED8, #0F172A)',
            borderRadius: '50%',
            boxShadow: 'inset -10px -10px 20px rgba(0,0,0,0.5), 0 0 30px rgba(79, 70, 229, 0.1)'
          }}
        />
      ))}

      {/* Floating Astronauts */}
      {astronauts.map(a => (
        <div
          key={`astro-${a.id}`}
          className="absolute opacity-40"
          style={{
            left: `${a.left}%`,
            top: `${a.top}%`,
            animation: `floatMovement ${a.duration}s ease-in-out ${a.delay}s infinite alternate`,
          }}
        >
          <svg 
            viewBox="0 0 24 24" 
            style={{ width: a.size, height: a.size, transform: `rotate(${a.rotation}deg)` }}
            fill="none" 
            stroke="currentColor" 
            className="text-white/40"
            strokeWidth="1"
          >
            <path d="M12 2a5 5 0 0 1 5 5v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7a5 5 0 0 1 5-5zM7 10h10v6a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-6zM9 19v3M15 19v3M6 13h2M16 13h2" strokeLinecap="round" />
          </svg>
        </div>
      ))}

      {/* Rockets rising from bottom to top */}
      {rockets.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-[-100px]"
          style={{
            left: `${r.left}%`,
            animation: `rocketRising ${r.duration}s linear forwards`,
            willChange: "transform, opacity",
          }}
        >
          <div style={{ transform: `scale(${r.scale}) rotate(${r.rotation}deg)` }}>
            <Rocket
              className="-rotate-45 text-orange"
              style={{
                width: r.size,
                height: r.size,
                filter: "drop-shadow(0 0 15px rgba(251, 146, 60, 0.7))",
              }}
            />
            {/* Flame Trail */}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full opacity-80"
              style={{
                top: `${r.size * 0.8}px`,
                width: `${r.size * 0.4}px`,
                height: `${r.size * 1.5}px`,
                background: "linear-gradient(to bottom, #FB923C, #FBBF24, transparent)",
                filter: "blur(4px)",
                zIndex: -1,
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


function FeatureCard({ item, index }: { item: typeof FEATURE_ITEMS[0]; index: number }) {
  const IconComponent = item.icon;
  return (
    <div
      className="flex h-[99px] items-center justify-between gap-2 sm:gap-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 hover:border-orange/30 hover:scale-[1.02] transition-all duration-500 group opacity-0 px-4 sm:px-6"
      style={{ animation: `scale-fade-in 0.5s ease-out ${300 + index * 150}ms forwards` }}
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[14px] sm:text-2xl font-bold text-white leading-tight truncate">{item.label}</p>
        <p className="text-[9px] sm:text-sm font-medium text-white/50 leading-tight truncate">{item.desc}</p>
      </div>
      <div className="w-11 h-11 shrink-0 rounded-xl bg-orange/15 flex items-center justify-center group-hover:bg-orange/25 transition-colors">
        <IconComponent className="h-5 w-5 text-orange" />
      </div>
    </div>
  );
}

const FEATURE_ITEMS = [
  { label: "+20.000", desc: "Produtos", icon: Package },
  { label: "+100", desc: "Fornecedores", icon: Factory },
  { label: "Filtros", desc: "Avançados", icon: SlidersHorizontal },
  { label: "IA", desc: "Assistente Pessoal", icon: Brain },
];

export function AuthBrandingPanel() {
  return (
    <div className="flex w-full lg:w-1/2 relative min-h-[500px] lg:h-screen items-center">
      {/* Sem decoração lateral — fundo 100% unificado vem do <main> em Auth.tsx */}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full min-h-screen">
        <div className="space-y-6 w-full max-w-xl flex flex-col items-center text-center">
          <div className="flex items-center gap-4">
            <AppLogo variant="light" iconClassName="h-14 w-14 rounded-xl shadow-orange/30" textClassName="text-4xl" />
          </div>

          <div className="space-y-4 max-w-md flex flex-col items-center">
            <h2 className="text-4xl xl:text-5xl font-display font-bold text-white leading-[1.1] tracking-tight relative group text-center">
              Um Universo de Produtos, para o{" "}
              <span className="text-orange relative">
                Melhor Time das Galáxias!
                <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-orange/0 via-orange/60 to-orange/0 scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
              </span>
            </h2>
            <p className="text-base text-white/70 leading-relaxed font-light text-center">
              Tenha acesso ao maior mix de produtos personalizados, consulte estoque em tempo real, visualize locais e técnicas de personalização. Feito especialmente para você decolar!!!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 pt-6 w-full lg:w-[94.5%] xl:w-[99%] lg:mx-[2.75%] xl:mx-[0.5%] px-2 sm:px-0">
            {FEATURE_ITEMS.map((item, i) => (
              <FeatureCard key={i} item={item} index={i} />
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center gap-4 pt-6 opacity-0" style={{ animation: 'scale-fade-in 0.5s ease-out 900ms forwards' }}>
            {[
              { label: "Conexão segura", path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { label: "Dados criptografados", path: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
              { label: "Infraestrutura SOC 2", path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
            ].map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="w-px h-4 bg-border" />}
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.path} />
                  </svg>
                  <span>{item.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

