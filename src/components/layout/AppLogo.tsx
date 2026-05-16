
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";

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
  variant = 'brand'
}: AppLogoProps) {
  const isBrandOrSidebar = variant === 'brand' || variant === 'sidebar';
  const usesBrandIcon = isBrandOrSidebar || variant === 'light';
  const iconBg = usesBrandIcon ? 'bg-primary' : 'bg-foreground';
  const iconColor = usesBrandIcon ? 'text-primary-foreground' : 'text-background';
  const textColor = variant === 'light' ? 'text-white' : 'text-foreground';

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "inline-flex items-center justify-center rounded-xl shadow-md transition-all duration-200 shrink-0",
        !iconClassName?.includes('h-') && (variant === 'sidebar' ? "h-9 w-9" : "h-10 w-10"),
        iconBg,
        iconClassName
      )}>
        <Gift className={cn(
          "shrink-0 transition-transform duration-200",
          iconClassName?.includes('h-20') ? "h-12 w-12" : 
          iconClassName?.includes('h-14') ? "h-8 w-8" : 
          variant === 'sidebar' ? "h-5 w-5" : "h-6 w-6",
          iconColor
        )} />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-display text-xl font-bold leading-none tracking-tight", textColor, textClassName)}>
            Promo Gifts
          </span>
          <span className={cn("text-[10px] font-semibold uppercase tracking-widest opacity-70", variant === 'light' ? 'text-white/80' : 'text-muted-foreground')}>
            Plataforma de Produtos
          </span>
        </div>
      )}
    </div>
  );
}
