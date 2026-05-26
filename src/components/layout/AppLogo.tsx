import { Gift, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  variant?: 'light' | 'dark' | 'brand' | 'sidebar';
}

export function AppLogo({
  className,
  iconClassName,
  textClassName,
  showText = true,
  variant = 'brand',
  onClick,
}: AppLogoProps & { onClick?: () => void }) {
  const isBrandOrSidebar = variant === 'brand' || variant === 'sidebar';
  const usesBrandIcon = isBrandOrSidebar || variant === 'light';
  const iconBg = usesBrandIcon ? 'bg-primary' : 'bg-foreground';
  const iconColor = usesBrandIcon ? 'text-primary-foreground' : 'text-background';

  return (
    <div
      className={cn(
        'group flex select-none items-center gap-3',
        className,
        onClick && 'cursor-pointer transition-transform duration-200 active:scale-95',
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-white/5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-500',
          !iconClassName?.includes('h-') && (variant === 'sidebar' ? 'h-10 w-10' : 'h-11 w-11'),
          iconBg,
          iconClassName,
        )}
      >
        <Gift
          className={cn(
            'shrink-0 transition-transform duration-500',
            iconClassName?.includes('h-20')
              ? 'h-10 w-10'
              : iconClassName?.includes('h-14')
                ? 'h-7 w-7'
                : variant === 'sidebar'
                  ? 'h-5 w-5'
                  : 'h-6 w-6',
            iconColor,
          )}
        />
        <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
        <Sparkles className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse text-white/50" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              'font-display text-lg font-black leading-none tracking-tight text-foreground drop-shadow-sm',
              textClassName,
            )}
          >
            Promo Gifts
          </span>
          <span
            className={cn(
              'mt-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-primary/80',
            )}
          >
            Plataforma
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
          </span>
        </div>
      )}
    </div>
  );
}
