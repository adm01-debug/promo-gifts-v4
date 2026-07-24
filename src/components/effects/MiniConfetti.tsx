import { useEffect, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/ui';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  size: number;
}

interface MiniConfettiProps {
  trigger: boolean;
  count?: number;
  duration?: number;
  colors?: string[];
  onComplete?: () => void;
}

const defaultColors = [
  'hsl(252 87% 64%)', // primary
  'hsl(142 71% 45%)', // success
  'hsl(45 93% 47%)', // gold/accent
  'hsl(25 95% 53%)', // orange
];

export function MiniConfetti({
  trigger,
  count = 20,
  duration = 1500,
  colors = defaultColors,
  onComplete,
}: MiniConfettiProps) {
  const reducedMotion = useReducedMotion();
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      onComplete?.();
      return;
    }
    if (trigger && !isActive) {
      setIsActive(true);
      const newPieces: ConfettiPiece[] = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100 - 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.2,
        rotation: Math.random() * 360,
        size: Math.random() * 6 + 4,
      }));
      setPieces(newPieces);

      const timer = setTimeout(() => {
        setIsActive(false);
        setPieces([]);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [trigger, count, duration, colors, onComplete, isActive, reducedMotion]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {pieces.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{
              opacity: 1,
              y: '50vh',
              x: '50vw',
              rotate: 0,
              scale: 0,
            }}
            animate={{
              opacity: [1, 1, 0],
              y: ['50vh', `${20 + Math.random() * 30}vh`, `${80 + Math.random() * 20}vh`],
              x: [`50vw`, `${50 + piece.x}vw`, `${50 + piece.x * 1.5}vw`],
              rotate: [0, piece.rotation, piece.rotation * 2],
              scale: [0, 1, 0.5],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: duration / 1000,
              delay: piece.delay,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            style={{
              position: 'absolute',
              width: piece.size,
              height: piece.size,
              backgroundColor: piece.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
