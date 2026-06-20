import { memo, useMemo } from 'react';

export const StarBackground = memo(() => {
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
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        opacity: 0.35,
        contain: 'strict',
        willChange: 'opacity',
      }}
    >
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
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
