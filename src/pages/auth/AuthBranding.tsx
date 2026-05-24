/**
 * Left-side branding panel for Auth page — extracted for modularity
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Package, Factory, SlidersHorizontal, Brain, Rocket } from "lucide-react";
import { AppLogo } from "@/components/layout/AppLogo";
import astronautSvg from "@/assets/astronaut.svg";

interface RocketData { id: number; left: number; size: number; duration: number; rotation: number; scale: number; }
interface PlanetData { id: number; left: number; top: number; size: number; duration: number; type: number; delay: number; }
interface AstronautData { id: number; left: number; top: number; size: number; rotation: number; zIndex: number; depth: number; initialAngle: number; individualScale?: number; individualOpacity?: number; }
interface StarData { id: number; size: number; top: number; left: number; breathingDur: number; breathingDelay: number; driftDur: number; }
interface MeteorData { id: number; top: number; left: number; duration: number; delay: number; }

export const SpaceScene = React.memo(({ isFull = true }: { isFull?: boolean }) => {
  const [rockets, setRockets] = useState<RocketData[]>([]);
  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [astronauts, setAstronauts] = useState<AstronautData[]>([]);
  const [meteors, setMeteors] = useState<MeteorData[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  
  // Parâmetros controláveis expandidos
  const [config, setConfig] = useState({
    astroCount: 4,
    speed: 0.2, 
    spacing: 1.0,
    parallaxIntensity: 1.0,
    depthProfile: 1.0, 
    showControls: false,
    reducedMotion: false,
    individualAstronauts: [] as { id: number; scale: number; opacity: number }[]
  });

  const nextIdRef = useRef(0);
  const starsRef = useRef<StarData[]>([]);

  // Detecta prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setConfig(prev => ({ ...prev, reducedMotion: mediaQuery.matches }));
    mediaQuery.addEventListener("change", handleChange);
    if (mediaQuery.matches) setConfig(prev => ({ ...prev, reducedMotion: true }));
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Mouse e Scroll parallax tracker com clamp e suavização
  useEffect(() => {
    if (config.reducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20 * config.parallaxIntensity,
        y: (e.clientY / window.innerHeight - 0.5) * 20 * config.parallaxIntensity
      });
    };
    const handleScroll = () => {
      const rawScroll = window.scrollY;
      const clampedScroll = Math.min(Math.max(rawScroll, 0), 1000); 
      setScrollY(clampedScroll * 0.05 * config.parallaxIntensity);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [config.parallaxIntensity, config.reducedMotion]);
  
  if (starsRef.current.length === 0) {
    starsRef.current = [...Array(150)].map((_, i) => ({
      id: i,
      size: 0.8 + (i % 3) * 0.4,
      top: ((i * 137.7) % 100),
      left: ((i * 149.3) % 100),
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
      duration: 5 + Math.random() * 3,
      rotation: Math.random() * 10 - 5,
      scale: 0.8 + Math.random() * 0.4,
    };
    setRockets(prev => [...prev, newRocket]);
    setTimeout(() => {
      setRockets(prev => prev.filter(r => r.id !== id));
    }, newRocket.duration * 1000);
  }, []);

  useEffect(() => {
    const rocketInterval = setInterval(() => spawnRocket(), 2000);
    
    // Meteor shower interval
    const meteorInterval = setInterval(() => {
      const id = Date.now();
      const newMeteor: MeteorData = {
        id,
        top: Math.random() * 60,
        left: Math.random() * 60,
        duration: 1.5 + Math.random() * 1,
        delay: 0
      };
      setMeteors(prev => [...prev, newMeteor]);
      setTimeout(() => {
        setMeteors(prev => prev.filter(m => m.id !== id));
      }, 3000);
    }, 8000);

    setPlanets([...Array(5)].map((_, i) => ({
      id: i,
      left: 10 + (i * 18),
      top: 15 + (i * 15),
      size: 60 + Math.random() * 100,
      duration: 25 + Math.random() * 15,
      type: i % 3,
      delay: Math.random() * 5,
    })));
    
    // Layout base para astronautas com ângulos iniciais diferentes para órbita
    const baseLayout = [
      { left: 15, top: 20, depth: 0.3, rotation: -8, zIndex: 5, initialAngle: 0 },
      { left: 75, top: 30, depth: 0.5, rotation: 12, zIndex: 10, initialAngle: 90 },
      { left: 25, top: 65, depth: 0.8, rotation: -15, zIndex: 15, initialAngle: 180 },
      { left: 65, top: 70, depth: 1.2, rotation: 20, zIndex: 20, initialAngle: 270 },
      { left: 45, top: 45, depth: 0.6, rotation: 45, zIndex: 12, initialAngle: 45 },
      { left: 10, top: 85, depth: 0.4, rotation: -30, zIndex: 8, initialAngle: 135 },
    ];

    setAstronauts(baseLayout.slice(0, config.astroCount).map((a, i) => {
      const individual = config.individualAstronauts.find(idx => idx.id === i);
      return {
        id: i,
        ...a,
        left: 50 + (a.left - 50) * config.spacing,
        top: 50 + (a.top - 50) * config.spacing,
        individualScale: individual?.scale ?? 1.0,
        individualOpacity: individual?.opacity ?? 1.0,
      };
    }));

    return () => {
      clearInterval(rocketInterval);
      clearInterval(meteorInterval);
    };
  }, [spawnRocket, config.astroCount, config.spacing, config.individualAstronauts]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true" data-testid="space-scene">
      {/* Background Deep Space Glow & Nebula */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0)_0%,rgba(2,6,23,0.6)_100%)]" />
      
      {/* Atmospheric Nebula Layers (10/10 Depth) */}
      <div 
        className="absolute inset-0 opacity-10 blur-[80px]"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, #1e40af 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #1e3a8a 0%, transparent 50%)',
          animation: 'nebulaDrift 30s ease-in-out infinite alternate'
        }}
      />
      
      <div 
        className="absolute inset-0 opacity-[0.03] blur-[120px]"
        style={{
          background: 'radial-gradient(circle at 60% 40%, #1e40af 0%, transparent 40%)',
          animation: 'nebulaDrift 45s ease-in-out infinite alternate-reverse'
        }}
      />

      {/* Space Dust Layer - Profundidade Extra */}
      <div className="absolute inset-0 opacity-30">
        {[...Array(20)].map((_, i) => (
          <div
            key={`dust-${i}`}
            className="absolute rounded-full bg-white/40"
            style={{
              width: '1px',
              height: '1px',
              top: `${(i * 17) % 100}%`,
              left: `${(i * 23) % 100}%`,
              animation: `starDrift ${60 + (i % 20)}s linear infinite alternate`,
              backgroundColor: i % 5 === 0 ? '#3b82f6' : i % 7 === 0 ? '#60A5FA' : 'rgba(255,255,255,0.4)',
              boxShadow: i % 5 === 0 ? '0 0 4px #3b82f6' : i % 7 === 0 ? '0 0 4px #60A5FA' : 'none',
              opacity: i % 3 === 0 ? 0.4 : 0.2,
            }}
          />
        ))}
      </div>

      {/* Dynamic Stars - Otimizado com camadas de animação separadas */}
      {activeStars.map((star) => (
        <div
          key={`star-container-${star.id}`}
          className="absolute transition-[top,left] duration-1000 ease-in-out"
          style={{
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            // Drift (Movimento) na camada externa com translate3d para estabilidade
            animation: `starDrift ${star.driftDur}s linear infinite alternate`,
            willChange: "transform, top, left",
          }}
        >
          <div
            className="w-full h-full rounded-full bg-white"
            data-testid={`star-breathing-${star.id}`}
            style={{
              // Brilho intenso triplo (30x) + escala (8x) via animação breathingStar em index.css
              animation: `breathingStar ${star.breathingDur}s ease-in-out ${star.breathingDelay}s infinite`,
              willChange: "opacity, transform, filter",
              mixBlendMode: 'screen',
            }}
          />
        </div>
      ))}


      {/* Planets with zigzag trajectory */}
      {planets.map(p => (
        <div
          key={`planet-${p.id}`}
          className="absolute opacity-25 blur-[0.5px]"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animation: `zigzagMovement ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            willChange: "transform",
            background: p.type === 0
              ? 'radial-gradient(circle at 30% 30%, #0B1E47, #000000)'
              : p.type === 1
                ? 'radial-gradient(circle at 30% 30%, #0A1F4D, #000000)'
                : 'radial-gradient(circle at 30% 30%, #0C2456, #000000)',
            borderRadius: '50%',
            boxShadow: 'inset -12px -12px 24px rgba(0,0,0,0.75), 0 0 24px rgba(15, 23, 60, 0.15)'
          }}
        />
      ))}

      {/* Floating Astronauts — Sincronizados, Menores e com Parallax Mouse + Scroll */}
      {!config.reducedMotion && astronauts.map((a, _idx) => {
        // Tamanhos reduzidos e escala baseada na profundidade, perfil global e ajuste individual
        const baseSize = 35; 
        const size = baseSize * a.depth * config.depthProfile * (a.individualScale ?? 1.0);
        
        // Opacidade baseada no perfil global, profundidade e ajuste individual
        const opacity = (0.12 + (a.depth * 0.2)) * config.depthProfile * (a.individualOpacity ?? 1.0);
        
        // Parallax Mouse + Scroll baseado na profundidade (com suavização adicional)
        const translateX = mousePos.x * a.depth;
        const translateY = (mousePos.y + scrollY) * a.depth;

        // Órbita circular suave (circularOrbit) — Sincronizada via delay negativo
        const orbitDuration = 18 / config.speed;
        
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
              willChange: "transform, opacity",
            }}
          >
            <div
              className="relative"
              style={{
                // circularOrbit rotaciona e move
                animation: `circularOrbit ${orbitDuration}s linear infinite`,
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
                  animationDuration: `${orbitDuration / 2}s`,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Shooting Stars (Meteors) 10/10 */}
      {meteors.map(m => (
        <div
          key={`meteor-${m.id}`}
          className="absolute w-[150px] h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
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
            willChange: "transform, opacity",
          }}
        >
          <div 
            style={{ 
              transform: `scale(${r.scale}) rotate(${r.rotation}deg)`,
              filter: `drop-shadow(0 0 ${r.size / 2}px rgba(59, 130, 246, 0.4))`
            }}
          >
            <Rocket
              className="-rotate-45 text-blue-400"
              style={{
                width: r.size,
                height: r.size,
                filter: "drop-shadow(0 0 15px rgba(59, 130, 246, 0.7))",
              }}
            />
            {/* Dynamic Flame Trail (Refined for 10/10) */}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full opacity-80 animate-pulse"
              style={{
                top: `${r.size * 0.8}px`,
                width: `${r.size * 0.4}px`,
                height: `${r.size * 2}px`,
                background: "linear-gradient(to bottom, #3b82f6, #60a5fa, #2563eb, transparent)",
                filter: "blur(6px)",
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



function FeatureCard({ item, index }: { item: typeof FEATURE_ITEMS[0]; index: number }) {
  const IconComponent = item.icon;
  return (
    <div
      className="flex h-[88px] items-center justify-between gap-3 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.5)] hover:bg-black/60 hover:border-blue-500/50 hover:scale-[1.05] transition-all duration-500 group opacity-0 px-5 relative overflow-hidden"
      style={{ animation: `scale-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${300 + index * 150}ms forwards` }}
    >
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent group-hover:animate-[shimmerTranslate_2s_infinite]" />
      </div>

      <div className="min-w-0 flex-1 text-left relative z-10">
        <p className="text-xl font-display font-bold text-white leading-tight tracking-tight">{item.label}</p>
        <p className="text-[10px] font-bold text-white/50 leading-tight uppercase tracking-[0.18em] mt-1">{item.desc}</p>
      </div>
      <div className="w-11 h-11 shrink-0 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-all duration-500 group-hover:rotate-[8deg] relative z-10 border border-white/10 shadow-inner">
        <IconComponent className="h-[1.4rem] w-[1.4rem] text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
      </div>
    </div>
  );
}

const FEATURE_ITEMS = [
  { label: "+20.000", desc: "PRODUTOS", icon: Package },
  { label: "+100", desc: "FORNECEDORES", icon: Factory },
  { label: "Filtros", desc: "AVANÇADOS", icon: SlidersHorizontal },
  { label: "IA", desc: "ASSISTENTE PESSOAL", icon: Brain },
];

export function AuthBrandingPanel({ onLogoClick }: { onLogoClick?: () => void }) {
  return (
    <div className="flex w-full lg:w-1/2 relative min-h-screen items-center">
      {/* Content */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full min-h-screen lg:translate-x-[5%] xl:translate-x-[10%]"
      >
        <div className="space-y-6 w-full max-w-xl flex flex-col items-center text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4"
          >
            <AppLogo variant="light" iconClassName="h-[3.25rem] w-[3.25rem] rounded-xl shadow-blue-500/40" textClassName="text-4xl" onClick={onLogoClick} />
          </motion.div>

          <div className="space-y-5 max-w-lg flex flex-col items-center">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl xl:text-5xl font-display font-bold text-white leading-[1.05] tracking-tight relative group text-center"
            >
              Um Universo de Brindes, para o{" "}
              <span className="text-blue-400">
                Melhor Time das{" "}
                <span className="relative inline-block">
                  Galáxias!
                  <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-blue-400/0 via-blue-400/60 to-blue-400/0 scale-x-0 group-hover:scale-x-100 transition-transform duration-700 shadow-[0_0_18px_rgba(59,130,246,0.6)]" />
                </span>
              </span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-[0.95rem] text-white/60 leading-relaxed font-light text-center max-w-md"
            >
              Tenha acesso ao maior mix de produtos personalizados, consulte estoque em tempo real, visualize locais e técnicas de personalização. Feito especialmente para você decolar!!!
            </motion.p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 pt-6 w-full">
            {FEATURE_ITEMS.map((item, i) => (
              <FeatureCard key={i} item={item} index={i} />
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-12 opacity-0" style={{ animation: 'scale-fade-in 0.6s ease-out 1000ms forwards' }}>
            {[
              { label: "Conexão segura", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { label: "Dados criptografados", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
              { label: "Infraestrutura SOC 2", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <span className="text-xs font-medium text-white/40 group-hover:text-white/60 transition-colors">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
