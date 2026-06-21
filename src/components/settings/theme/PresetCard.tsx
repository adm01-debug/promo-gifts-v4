import { Check, Eye } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { ThemePreset } from '@/lib/theme-presets';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PresetCardProps {
  preset: ThemePreset;
  isActive: boolean;
  onSelect: (id: string) => void;
}

export function PresetCard({ preset, isActive, onSelect }: PresetCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-4 transition-all duration-300',
            isActive
              ? 'border-primary shadow-md ring-2 ring-primary/60'
              : 'border-border hover:border-primary/40 hover:shadow-lg',
          )}
          onClick={() => onSelect(preset.id)}
          role="radio"
          aria-checked={isActive}
          aria-label={`Skin ${preset.name}: ${preset.description}`}
          tabIndex={isActive ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(preset.id);
            }
          }}
        >
          {/* Active glow background effect */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-xl"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${preset.swatches[0]}15 0%, transparent 70%)`,
                }}
              />
            )}
          </AnimatePresence>

          {/* Swatches bar with rounded edges */}
          <div className="relative mb-3 flex h-8 overflow-hidden rounded-lg shadow-sm">
            {preset.swatches.map((color, i) => (
              <motion.div
                key={i}
                className="relative flex-1"
                style={{ backgroundColor: color }}
                initial={false}
                animate={{
                  opacity: isHovered ? 1 : 0.9,
                  height: isHovered ? 36 : 32,
                }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              />
            ))}
            {/* Shimmer on hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: isHovered ? '100%' : '-100%' }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          </div>

          {/* Info + Active check */}
          <div className="relative flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-sm">{preset.emoji}</span>
              <h3 className="truncate font-display text-xs font-bold text-foreground">
                {preset.name}
              </h3>
            </div>

            <AnimatePresence mode="wait">
              {isActive ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary"
                >
                  <Check className="h-3 w-3 text-primary-foreground" />
                </motion.div>
              ) : isHovered ? (
                <motion.div
                  key="eye"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.6 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center"
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <p className="relative mt-0.5 truncate text-[11px] italic text-muted-foreground">
            {preset.description}
          </p>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className=" ">
        <p className="font-semibold">
          {preset.emoji} {preset.name}
        </p>
        <p className="text-muted-foreground">{preset.description}</p>
        {isActive && <p className="mt-1 font-medium text-primary">✓ Skin ativa</p>}
      </TooltipContent>
    </Tooltip>
  );
}
