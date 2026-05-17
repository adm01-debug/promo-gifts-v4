import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Rocket } from 'lucide-react';

/**
 * StarBackground - A background component with animated stars and celestial elements.
 * Features:
 * - Parallax stars of different sizes
 * - Glowing effects
 * - Occasional "shooting stars" (astronauts/rockets)
 */
export const StarBackground = React.memo(function StarBackground() {
  // Generate static stars data to avoid hydration mismatch
  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      size: Math.random() * 2 + 1,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.7 + 0.3,
    }));
  }, []);

  // Generate some "shooting stars" or rockets
  const rockets = useMemo(() => {
    return Array.from({ length: 2 }).map((_, i) => ({
      id: i,
      delay: i * 15 + Math.random() * 10,
      duration: 10 + Math.random() * 5,
      path: Math.random() > 0.5 ? 'ltr' : 'rtl',
      top: `${20 + Math.random() * 60}%`,
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#020617]">
      {/* Background glow layers */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange/10 blur-[120px] rounded-full" />
      
      {/* Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            width: star.size,
            height: star.size,
            top: star.top,
            left: star.left,
            boxShadow: star.size > 2 ? '0 0 8px 1px rgba(255, 255, 255, 0.8)' : 'none',
          }}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [star.opacity * 0.5, star.opacity, star.opacity * 0.5],
            scale: [1, 1.2, 1]
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
      {rockets.map((rocket) => (
        <motion.div
          key={rocket.id}
          className="absolute text-primary/40"
          style={{ top: rocket.top }}
          initial={rocket.path === 'ltr' ? { x: '-10%', y: '0%', rotate: 45, opacity: 0 } : { x: '110%', y: '0%', rotate: -135, opacity: 0 }}
          animate={{ 
            x: rocket.path === 'ltr' ? '110%' : '-10%',
            y: rocket.path === 'ltr' ? '20%' : '-20%',
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: rocket.duration,
            repeat: Infinity,
            delay: rocket.delay,
            ease: "linear"
          }}
        >
          <Rocket size={24} />
          {/* Flame tail */}
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 w-12 h-1 bg-gradient-to-r from-transparent to-orange/40 blur-sm",
            rocket.path === 'ltr' ? "right-full" : "left-full rotate-180"
          )} />
        </motion.div>
      ))}

      {/* Nebula effect (CSS only for performance) */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 0%, rgba(2, 6, 23, 0.8) 100%),
                       url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  );
});
