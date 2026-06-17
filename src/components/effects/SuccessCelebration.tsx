import { useEffect, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, PartyPopper } from 'lucide-react';
import { MiniConfetti } from './MiniConfetti';
import { cn } from '@/lib/utils';

type CelebrationType = 'success' | 'achievement' | 'level-up' | 'milestone';

interface SuccessCelebrationProps {
  show: boolean;
  type?: CelebrationType;
  title?: string;
  subtitle?: string;
  duration?: number;
  onComplete?: () => void;
}

const celebrationConfig: Record<
  CelebrationType,
  {
    icon: typeof Check;
    gradient: string;
    iconColor: string;
  }
> = {
  success: {
    icon: Check,
    gradient: 'from-success to-success/80',
    iconColor: 'text-success-foreground',
  },
  achievement: {
    icon: Sparkles,
    gradient: 'from-brand-primary to-brand-primary/80',
    iconColor: 'text-brand-primary-foreground',
  },
  'level-up': {
    icon: Sparkles,
    gradient: 'from-primary to-primary/80',
    iconColor: 'text-primary-foreground',
  },
  milestone: {
    icon: PartyPopper,
    gradient: 'from-primary to-brand-primary',
    iconColor: 'text-primary-foreground',
  },
};

export function SuccessCelebration({
  show,
  type = 'success',
  title = 'Sucesso!',
  subtitle,
  duration = 2500,
  onComplete,
}: SuccessCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const config = celebrationConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setShowConfetti(true);

      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  return (
    <>
      <MiniConfetti
        trigger={showConfetti}
        count={30}
        duration={duration}
        onComplete={() => setShowConfetti(false)}
      />

      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop blur */}
            <motion.div
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Main content */}
            <motion.div
              className="relative flex flex-col items-center gap-4"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
              }}
            >
              {/* Glow ring */}
              <motion.div
                className={`absolute -inset-8 rounded-full bg-gradient-to-r ${config.gradient} opacity-20 blur-2xl`}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Icon container */}
              <motion.div
                className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${config.gradient} shadow-xl`}
                animate={{
                  boxShadow: [
                    '0 0 20px hsl(var(--primary) / 0.3)',
                    '0 0 40px hsl(var(--primary) / 0.5)',
                    '0 0 20px hsl(var(--primary) / 0.3)',
                  ],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 15,
                    delay: 0.2,
                  }}
                >
                  <Icon className={cn('h-10 w-10', config.iconColor)} />
                </motion.div>

                {/* Pulse rings */}
                {Array.from({ length: 3 }, (_, i) => (
                  <motion.div
                    key={i}
                    className={`absolute inset-0 rounded-full border-2 border-current ${config.iconColor} opacity-30`}
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{
                      scale: [1, 2],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.3,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </motion.div>

              {/* Text content */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.h2
                  className="font-display text-2xl font-bold text-foreground"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {title}
                </motion.h2>
                {subtitle && (
                  <motion.p
                    className="mt-1 text-muted-foreground"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {subtitle}
                  </motion.p>
                )}
              </motion.div>

              {/* Sparkle particles */}
              {Array.from({ length: 8 }, (_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    top: '50%',
                    left: '50%',
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    x: Math.cos((i / 8) * Math.PI * 2) * 80,
                    y: Math.sin((i / 8) * Math.PI * 2) * 80,
                  }}
                  transition={{
                    duration: 1,
                    delay: 0.5 + i * 0.05,
                    ease: 'easeOut',
                  }}
                >
                  <Sparkles className="h-4 w-4 text-brand-primary" />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
