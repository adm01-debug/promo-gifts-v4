/**
 * Left-side branding panel for Auth page — extracted for modularity
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Gift, Package, Factory, SlidersHorizontal, Brain, Rocket } from "lucide-react";
import { AppLogo } from "@/components/layout/AppLogo";

interface RocketData { id: number; left: number; size: number; duration: number; rotation: number; scale: number; }

export const ContinuousRockets = React.memo(() => {
  const [rockets, setRockets] = useState<RocketData[]>([]);
  const nextIdRef = useRef(0);

  const spawnRocket = useCallback((isInitial = false) => {
    const id = nextIdRef.current++;
    
    const left = 5 + Math.random() * 90;
    const size = 20 + Math.random() * 35;
    const duration = isInitial 
      ? (1.5 + Math.random() * 1.5) 
      : (2.2 + Math.random() * 2.8);
    
    const rotationOffset = -6 + Math.random() * 12;
    const scale = 0.8 + Math.random() * 0.4;

    const rocket: RocketData = { 
      id, left, size, duration, rotation: rotationOffset, scale 
    };
    
    setRockets((prev) => [...prev, rocket]);
    
    const timer = setTimeout(() => {
      setRockets((prev) => prev.filter((r) => r.id !== id));
    }, (duration + 0.5) * 1000);

    return timer;
  }, []);

  useEffect(() => {
    // Initial burst
    const delays = [0, 200, 500, 900, 1400, 2000, 2800];
    const spawnTimers: NodeJS.Timeout[] = [];
    const cleanupTimers: NodeJS.Timeout[] = [];

    delays.forEach(d => {
      const t = setTimeout(() => {
        const cleanupTimer = spawnRocket(true);
        cleanupTimers.push(cleanupTimer);
      }, d);
      spawnTimers.push(t);
    });

    // Sustained cycle
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const cleanupTimer = spawnRocket();
        cleanupTimers.push(cleanupTimer);
      }
    }, 2800);

    return () => {
      spawnTimers.forEach(clearTimeout);
      cleanupTimers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, [spawnRocket]);

  return (
    <div 
      className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" 
      aria-hidden="true"
      data-testid="rocket-container"
    >
      {rockets.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-0"
          data-testid="rocket-item"
          style={{
            left: `${r.left}%`,
            animation: `rocketLaunch ${r.duration}s ease-out forwards`,
            willChange: "transform, opacity",
          }}
        >
          <div style={{ transform: `scale(${r.scale}) rotate(${r.rotation}deg)` }}>
            <div 
              className="relative animate-rocket-shake"
              style={{ 
                animation: "rocketShake 0.15s ease-in-out infinite",
              }}
            >
              <Rocket
                className="-rotate-45 text-orange"
                data-testid={`rocket-icon-${r.id}`}
                style={{
                  width: r.size,
                  height: r.size,
                  filter: "drop-shadow(0 0 12px rgba(251, 146, 60, 0.6))",
                }}
              />
            </div>
            {/* Rastro de chamas */}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full opacity-70"
              style={{
                top: `${r.size * 0.7}px`,
                width: `${r.size * 0.3}px`,
                height: `${r.size * 1.2}px`,
                animation: "flameTrail 0.3s ease-in-out infinite alternate",
                background: "linear-gradient(to bottom, #FB923C, #FBBF24, transparent)",
                zIndex: -1,
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full opacity-40"
              style={{
                top: `${r.size * 0.8}px`,
                width: `${r.size * 0.15}px`,
                height: `${r.size * 1.8}px`,
                animation: "flameTrail 0.2s ease-in-out infinite alternate-reverse",
                background: "linear-gradient(to bottom, #FB923C, transparent)",
                zIndex: -1,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
});

export const Starfield = React.memo(() => {
  return (
    <>
      {[...Array(32)].map((_, i) => {
        const size = 1 + (i % 3);
        const top = (i * 37 + 11) % 100;
        const left = (i * 53 + 7) % 100;
        const dur = 2 + (i % 5);
        const delay = (i * 0.4) % 3;
        return (
          <div
            key={`star-${i}`}
            className="absolute rounded-full bg-white/30 shadow-[0_0_8px_rgba(255,255,255,0.3)]"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              top: `${top}%`,
              left: `${left}%`,
              animation: `twinkle ${dur}s ease-in-out ${delay}s infinite`
            }}
          />
        );
      })}
    </>
  );
});

function FeatureCard({ item, index }: { item: typeof FEATURE_ITEMS[0]; index: number }) {
  const IconComponent = item.icon;
  return (
    <div
      className="flex h-[99px] items-center justify-between gap-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:bg-white/10 hover:border-orange/30 hover:scale-[1.02] transition-all duration-500 group opacity-0 px-5"
      style={{ animation: `scale-fade-in 0.5s ease-out ${300 + index * 150}ms forwards` }}
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="text-2xl font-bold text-white leading-tight truncate">{item.label}</p>
        <p className="text-sm font-medium text-white/50 leading-tight truncate">{item.desc}</p>
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
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden h-screen items-center bg-[#0A0D14]">
      {/* Background decoration (sem bg sólido — fundo unificado vem do <main>) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-orange/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-orange/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-orange/5 rounded-full blur-[100px]" />
        <ContinuousRockets />
      </div>

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

          <div className="grid grid-cols-2 gap-4 pt-6 w-[108%] -mx-[4%]">
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

