import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Rocket } from 'lucide-react';

/**
 * StarBackground - A background component with animated stars and celestial elements.
 */
export const StarBackground = React.memo(function StarBackground() {
  const stars = useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.8 + 0.2,
      color: Math.random() > 0.8 ? '#fcd34d' : '#ffffff', // Algumas estrelas levemente amareladas
    }));
  }, []);

  const rockets = useMemo(() => {
    return Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      delay: i * 8 + Math.random() * 5,
      duration: 6 + Math.random() * 4,
      path: Math.random() > 0.5 ? 'ltr' : 'rtl',
      top: `${10 + Math.random() * 80}%`,
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#020617]">
      {/* Background glow layers */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full opacity-60 animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 blur-[150px] rounded-full opacity-40" />
      
      {/* Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full"
          style={{
            width: star.size,
            height: star.size,
            top: star.top,
            left: star.left,
            backgroundColor: star.color,
            boxShadow: star.size > 2 ? `0 0 12px 2px ${star.color === '#ffffff' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(252, 211, 77, 0.9)'}` : 'none',
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [star.opacity * 0.3, star.opacity, star.opacity * 0.3],
            scale: [1, 1.3, 1]
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Rockets / Shooting Stars */}
      <AnimatePresence>
        {rockets.map((rocket) => (
          <motion.div
            key={rocket.id}
            className="absolute text-primary"
            style={{ top: rocket.top }}
            initial={rocket.path === 'ltr' ? { x: '-20%', y: '0%', rotate: 45, opacity: 0 } : { x: '120%', y: '0%', rotate: -135, opacity: 0 }}
            animate={{ 
              x: rocket.path === 'ltr' ? '120%' : '-20%',
              y: rocket.path === 'ltr' ? '30%' : '-30%',
              opacity: [0, 1, 1, 0]
            }}
            transition={{
              duration: rocket.duration,
              repeat: Infinity,
              delay: rocket.delay,
              ease: "linear"
            }}
          >
            <div className="relative">
              <Rocket size={32} className="drop-shadow-[0_0_15px_rgba(255,165,0,0.8)]" />
              {/* Flame tail */}
              <motion.div 
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-20 h-2 bg-gradient-to-r from-transparent via-orange-500 to-yellow-400 blur-md",
                  rocket.path === 'ltr' ? "right-full mr-2" : "left-full ml-2 rotate-180"
                )}
                animate={{ scaleY: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 0.2, repeat: Infinity }}
              />
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 w-32 h-4 bg-primary/20 blur-xl",
                rocket.path === 'ltr' ? "right-full" : "left-full"
              )} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Nebula effect */}
      <div 
        className="absolute inset-0 opacity-30 mix-blend-screen pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 0%, rgba(2, 6, 23, 0.5) 100%),
                       url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  );
});
