/**
 * Left-side branding panel for Auth page — extracted for modularity
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Gift, Package, Factory, SlidersHorizontal, Brain, Rocket } from "lucide-react";
import { AppLogo } from "@/components/layout/AppLogo";
import astronautSvg from "@/assets/astronaut.svg";

interface RocketData { id: number; left: number; size: number; duration: number; rotation: number; scale: number; }
interface PlanetData { id: number; left: number; top: number; size: number; duration: number; type: number; delay: number; }
interface AstronautData { id: number; left: number; top: number; size: number; rotation: number; zIndex: number; depth: number; initialAngle: number; individualScale?: number; individualOpacity?: number; }
interface StarData { id: number; size: number; top: number; left: number; breathingDur: number; breathingDelay: number; driftDur: number; }

export const SpaceScene = React.memo(({ isFull = true }: { isFull?: boolean }) => {
  const [rockets, setRockets] = useState<RocketData[]>([]);
  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [astronauts, setAstronauts] = useState<AstronautData[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  
  // Parâmetros controláveis expandidos
  const [config, setConfig] = useState({
    astroCount: 4,
    speed: 0.2, 
    spacing: 1.0,
    parallaxIntensity: 1.0,
    depthProfile: 1.0, // Multiplicador de escala/opacidade
    showControls: false
  });

  const nextIdRef = useRef(0);
  const starsRef = useRef<StarData[]>([]);

  // Mouse e Scroll parallax tracker
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20 * config.parallaxIntensity,
        y: (e.clientY / window.innerHeight - 0.5) * 20 * config.parallaxIntensity
      });
    };
    const handleScroll = () => {
      setScrollY(window.scrollY * 0.1 * config.parallaxIntensity);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [config.parallaxIntensity]);
  
  if (starsRef.current.length === 0) {
    starsRef.current = [...Array(100)].map((_, i) => ({
      id: i,
      size: 0.8 + (i % 3) * 0.4,
      top: ((i * 137.7) % 100),
      left: ((i * 149.3) % 100),
      breathingDur: 14, 
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
    const rocketInterval = setInterval(() => spawnRocket(), 4000);
    
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

    return () => clearInterval(rocketInterval);
  }, [spawnRocket, config.astroCount, config.spacing]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
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
            className="w-full h-full rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]"
            style={{
              // Respiração (Brilho/Escala) na camada interna
              animation: `breathingStar ${star.breathingDur}s ease-in-out ${star.breathingDelay}s infinite`,
              willChange: "opacity, transform",
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
      {astronauts.map((a, i) => {
        // Tamanhos reduzidos e escala baseada na profundidade e perfil de controle
        const baseSize = 35; 
        const size = baseSize * a.depth * config.depthProfile;
        
        // Opacidade baseada no perfil e profundidade
        const opacity = (0.12 + (a.depth * 0.2)) * config.depthProfile;
        
        // Parallax Mouse + Scroll baseado na profundidade
        const translateX = mousePos.x * a.depth;
        const translateY = (mousePos.y + scrollY) * a.depth;

        // Movimento circular (órbita suave) — Duração fixa p/ sincronia
        const orbitDuration = 18 / config.speed;

        return (
          <div
            key={`astro-${a.id}`}
            className="absolute transition-transform duration-700 ease-out"
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
              style={{
                // Usamos animação CSS para órbita suave e constante
                animation: `orbitSmooth ${orbitDuration}s linear infinite`,
                filter: `brightness(0.55) drop-shadow(0 0 ${size / 12}px rgba(6, 135, 255, 0.12))`,
              }}
            >
              <img
                src={astronautSvg}
                alt=""
                style={{
                  width: size,
                  height: size,
                  transform: `rotate(${a.rotation}deg)`,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Interface de Controles em Tempo Real */}
      <div className="absolute top-4 left-4 z-50 pointer-events-auto">
        <button 
          onClick={() => setConfig(prev => ({ ...prev, showControls: !prev.showControls }))}
          className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg border border-white/20 text-white/40 hover:text-white transition-all group shadow-xl"
        >
          <SlidersHorizontal className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
        </button>

        {config.showControls && (
          <div className="mt-3 p-5 bg-black/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-80 animate-motion-pop overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange" />
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-white font-bold flex items-center gap-2">
                <Rocket className="w-4 h-4 text-orange" /> Parâmetros do Cosmos
              </h4>
              <button 
                onClick={() => setConfig(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }))}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${config.reducedMotion ? 'bg-orange/20 border-orange text-orange' : 'bg-white/5 border-white/10 text-white/40'}`}
              >
                Motion: {config.reducedMotion ? 'OFF' : 'ON'}
              </button>
            </div>
            
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-orange uppercase tracking-widest">Global</p>
                <div>
                  <div className="flex justify-between text-[10px] text-white/50 mb-1">
                    <span>Astronautas</span>
                    <span>{config.astroCount}</span>
                  </div>
                  <input 
                    type="range" min="1" max="6" step="1"
                    value={config.astroCount}
                    onChange={(e) => setConfig(prev => ({ ...prev, astroCount: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-white/50 mb-1">
                    <span>Órbita (Speed)</span>
                    <span>{config.speed.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="2.0" step="0.1"
                    value={config.speed}
                    onChange={(e) => setConfig(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-white/50 mb-1">
                    <span>Espaçamento</span>
                    <span>{config.spacing.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="1.5" step="0.1"
                    value={config.spacing}
                    onChange={(e) => setConfig(prev => ({ ...prev, spacing: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-white/50 mb-1">
                    <span>Parallax (Intensity)</span>
                    <span>{config.parallaxIntensity.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0" max="2.0" step="0.1"
                    value={config.parallaxIntensity}
                    onChange={(e) => setConfig(prev => ({ ...prev, parallaxIntensity: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-white/50 mb-1">
                    <span>Depth Profile (Global)</span>
                    <span>{config.depthProfile.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0.2" max="2.0" step="0.1"
                    value={config.depthProfile}
                    onChange={(e) => setConfig(prev => ({ ...prev, depthProfile: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <p className="text-[10px] font-bold text-orange uppercase tracking-widest">Individual Ajuste</p>
                {astronauts.map((a, idx) => (
                  <div key={idx} className="space-y-2 p-2 bg-white/5 rounded-lg border border-white/5">
                    <p className="text-[9px] text-white/30 font-bold uppercase">Astro #{idx + 1}</p>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-[8px] text-white/40 mb-1">
                          <span>Escala</span>
                          <span>{a.individualScale?.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.2" max="2.5" step="0.1"
                          value={a.individualScale ?? 1.0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setConfig(prev => {
                              const existing = prev.individualAstronauts.filter(i => i.id !== idx);
                              return {
                                ...prev,
                                individualAstronauts: [...existing, { id: idx, scale: val, opacity: a.individualOpacity ?? 1.0 }]
                              };
                            });
                          }}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white/40"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-[8px] text-white/40 mb-1">
                          <span>Opacidade</span>
                          <span>{a.individualOpacity?.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0" max="2.0" step="0.1"
                          value={a.individualOpacity ?? 1.0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setConfig(prev => {
                              const existing = prev.individualAstronauts.filter(i => i.id !== idx);
                              return {
                                ...prev,
                                individualAstronauts: [...existing, { id: idx, opacity: val, scale: a.individualScale ?? 1.0 }]
                              };
                            });
                          }}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white/40"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <p className="mt-4 text-[9px] text-white/30 italic text-center">
              Limitador de scroll ativo (clamp 1000px).
            </p>
          </div>
        )}
      </div>

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

