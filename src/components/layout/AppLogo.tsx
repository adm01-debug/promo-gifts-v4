import { Gift } from 'lucide-react';
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
  const usesPrimary = variant === 'brand' || variant === 'sidebar' || variant === 'light';
  const iconBg = usesPrimary ? 'bg-primary' : 'bg-foreground';
  const iconColor = usesPrimary ? 'text-primary-foreground' : 'text-background';
  const textColor = variant === 'light' ? 'text-white' : 'text-foreground';

  return (
    <div
      className={cn('flex items-center gap-3', className, onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      {/* Icon box — V3 exact: h-10 w-10, rounded-xl, shadow-lg */}
      <div
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-lg',
          iconBg,
          iconClassName,
        )}
      >
        {/* Gift icon — V3 exact: h-6 w-6 */}
        <Gift className={cn('h-6 w-6', iconColor)} />
      </div>

      {showText && (
        <div className="flex flex-col">
          {/* Name — V3 exact: text-xl font-bold leading-none tracking-tight */}
          <span
            className={cn(
              'font-display text-xl font-bold leading-none tracking-tight',
              textColor,
              textClassName,
            )}
          >
            Promo Gifts
          </span>

          {/* Subtitle — V3 exact: text-[10px] font-semibold uppercase tracking-widest opacity-70 */}
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-widest opacity-70',
              variant === 'light' ? 'text-primary' : 'text-muted-foreground',
              subtextClassName,
            )}
          >
            Store System
          </span>
        </div>
      )}
    </div>
  );
}
