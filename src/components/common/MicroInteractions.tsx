import { m as motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Hover lift effect for cards
interface HoverCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  liftAmount?: number;
}

export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(
  ({ children, className, liftAmount = 4, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn('cursor-pointer', className)}
      whileHover={{
        y: -liftAmount,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {children}
    </motion.div>
  ),
);
HoverCard.displayName = 'HoverCard';

// Scale on tap effect for buttons
export const TapScale = forwardRef<HTMLDivElement, HoverCardProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.1 }}
      {...props}
    >
      {children}
    </motion.div>
  ),
);
TapScale.displayName = 'TapScale';

// Staggered list animation
interface StaggerListProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function StaggerList({ children, className, staggerDelay = 0.05 }: StaggerListProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: index * staggerDelay,
            duration: 0.3,
            ease: 'easeOut',
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

// Fade in on scroll
interface FadeInViewProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function FadeInView({ children, className, delay = 0 }: FadeInViewProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Number counter animation
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  formatFn?: (value: number) => string;
}

export function AnimatedCounter({
  value,
  duration: _duration = 1,
  className,
  formatFn = (v) => v.toLocaleString('pt-BR'),
}: AnimatedCounterProps) {
  return (
    <motion.span className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={value}>
        {formatFn(value)}
      </motion.span>
    </motion.span>
  );
}

// Pulse dot (for notifications, status indicators)
interface PulseDotProps {
  color?: 'error' | 'primary' | 'success' | 'warning';
  size?: 'lg' | 'md' | 'sm';
  className?: string;
}

const dotColors = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
};

const dotSizes = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
};

export function PulseDot({ color = 'primary', size = 'md', className }: PulseDotProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
          dotColors[color],
        )}
      />
      <span className={cn('relative inline-flex rounded-full', dotColors[color], dotSizes[size])} />
    </span>
  );
}

// Shimmer effect for loading states
export function ShimmerEffect({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

// Success checkmark animation
export function SuccessCheck({ size = 48 }: { size?: number }) {
  return (
    <motion.svg width={size} height={size} viewBox="0 0 50 50" className="text-success">
      <motion.circle
        cx="25"
        cy="25"
        r="23"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      <motion.path
        d="M14 26l8 8 14-16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.5, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}

// Bounce entrance animation
export function BounceIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 15,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

// Slide in from direction
interface SlideInProps {
  children: ReactNode;
  direction?: 'down' | 'left' | 'right' | 'up';
  delay?: number;
  className?: string;
}

export function SlideIn({ children, direction = 'up', delay = 0, className }: SlideInProps) {
  const variants = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    up: { x: 0, y: 50 },
    down: { x: 0, y: -50 },
  };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...variants[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
