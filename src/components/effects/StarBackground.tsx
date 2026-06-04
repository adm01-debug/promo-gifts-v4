import React, { useMemo } from 'react';

/**
 * StarBackground - CSS-only background with twinkling stars.
 * Replaced 150 framer-motion animated elements with pure CSS for dramatically
 * better performance (fewer DOM nodes, no JS animation frames).
 */
export const StarBackground = React.memo(function StarBackground() {
  const stars = useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      size: Math.random() * 2.5 + 0.5,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: `${(Math.random() * 4).toFixed(1)}s`,
      duration: `${(Math.random() * 3 + 2).toFixed(1)}s`,
      opacity: Math.random() * 0.7 + 0.2,
    }));
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="space-scene"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ opacity: 0.35, contain: 'strict' }}
    >
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            width: star.size,
            height: star.size,
            top: star.top,
            left: star.left,
            opacity: star.opacity,
            animation: `twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
            willChange: 'opacity',
          }}
        />
      ))}
    </div>
  );
});
