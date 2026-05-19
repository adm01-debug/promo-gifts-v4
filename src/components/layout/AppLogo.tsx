import { Gift, Sparkles } from "lucide-react";
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
  variant = 'brand',
  onClick
}: AppLogoProps & { onClick?: () => void }) {
  const isBrandOrSidebar = variant === 'brand' || variant === 'sidebar';
  const usesBrandIcon = isBrandOrSidebar || variant === 'light';
  const iconBg = usesBrandIcon ? 'bg-primary' : 'bg-foreground';
  const iconColor = usesBrandIcon ? 'text-primary-foreground' : 'text-background';

  return (
    <div className={cn("flex items-center gap-3", className, onClick && "cursor-pointer")} onClick={onClick}>
      <div className={cn(
        "relative inline-flex items-center justify-center rounded-xl shadow-[0_0_15px_rgba(var(--primary),0.3)] transition-all duration-300 shrink-0 overflow-hidden",
        !iconClassName?.includes('h-') && (variant === 'sidebar' ? "h-9 w-9" : "h-10 w-10"),
        iconBg,
        iconClassName
      )}>
        <Gift className={cn(
          "shrink-0 transition-transform duration-500 hover:scale-110",
          iconClassName?.includes('h-20') ? "h-12 w-12" : 
          iconClassName?.includes('h-14') ? "h-8 w-8" : 
          variant === 'sidebar' ? "h-5 w-5" : "h-6 w-6",
          iconColor
        )} />
        <Sparkles className="absolute top-0 right-0 h-3 w-3 text-white/40 animate-pulse" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            "font-display text-xl font-bold leading-none tracking-tight text-white",
            textClassName
          )}>
            Promo Gifts
          </span>
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-widest text-primary/80 flex items-center gap-1",
          )}>
            Plataforma de Produtos
            <span className="inline-block w-1 h-1 rounded-full bg-primary animate-ping" />
          </span>
        </div>
      )}
    </div>
  );
}
