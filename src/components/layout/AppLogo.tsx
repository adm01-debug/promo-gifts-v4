import { Gift, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  subtextClassName?: string;
  showText?: boolean;
  variant?: 'light' | 'dark' | 'brand' | 'sidebar';
}

export function AppLogo({
  className,
  iconClassName,
  textClassName,
  subtextClassName,
  showText = true,
  variant = 'brand',
  onClick,
}: AppLogoProps & { onClick?: () => void }) {
  const isSidebar = variant === 'sidebar';
  const isBrandOrSidebar = variant === 'brand' || isSidebar;
  const usesBrandIcon = isBrandOrSidebar || variant === 'light';
  const iconBg = usesBrandIcon ? 'bg-primary' : 'bg-foreground';
  const iconColor = usesBrandIcon ? 'text-primary-foreground' : 'text-background';

  return (
    <div
      className={cn(
        'group flex select-none items-center gap-2 sm:gap-3',
        className,
        onClick && 'cursor-pointer transition-transform duration-200 active:scale-95',
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] sm:rounded-[12px] border border-white/5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-500',
          !iconClassName?.includes('h-') && (isSidebar ? 'h-8 w-8' : 'h-10 w-10 sm:h-11 sm:w-11'),
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
                : isSidebar
                  ? 'h-4 w-4'
                  : 'h-5 w-5 sm:h-6 sm:w-6',
            iconColor,
          )}
        />
        <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
        <Sparkles className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 animate-pulse text-white/50" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              'font-display font-black uppercase leading-tight tracking-tight text-foreground drop-shadow-sm',
              isSidebar ? 'text-base sm:text-lg' : 'text-[22px] sm:text-[34.8px] tracking-[0.08em]',
              textClassName,
            )}
          >
            PROMO BRINDES
          </span>
          <span
            className={cn(
              'flex items-center gap-1 font-bold leading-none text-muted-foreground drop-shadow-sm',
              isSidebar ? 'mt-0.5 text-[9px] uppercase tracking-wider' : 'mt-1.5 text-[9px] sm:text-[13.2px] tracking-[0.3em] sm:tracking-[0.35em] text-primary/90',
              subtextClassName,
            )}
          >
            Plataforma de produtos
            {!isSidebar && <span className="inline-block h-1 w-1 rounded-full bg-primary" />}
          </span>
        </div>
      )}
    </div>
  );
}
