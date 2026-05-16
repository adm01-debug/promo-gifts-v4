
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  variant?: 'light' | 'dark' | 'orange';
}

export function AppLogo({ 
  className, 
  iconClassName, 
  textClassName, 
  showText = true,
  variant = 'orange'
}: AppLogoProps) {
  const iconBg = variant === 'orange' ? 'bg-orange' : variant === 'light' ? 'bg-white' : 'bg-foreground';
  const iconColor = variant === 'orange' ? 'text-orange-foreground' : variant === 'light' ? 'text-foreground' : 'text-background';
  const textColor = variant === 'light' ? 'text-white' : 'text-foreground';

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-lg",
        iconBg,
        iconClassName
      )}>
        <Gift className={cn("h-6 w-6", iconColor)} />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-display text-xl font-bold leading-none tracking-tight", textColor, textClassName)}>
            Promo Gifts
          </span>
          <span className={cn("text-[10px] font-semibold uppercase tracking-widest opacity-70", variant === 'light' ? 'text-orange' : 'text-muted-foreground')}>
            Plataforma de Vendas
          </span>
        </div>
      )}
    </div>
  );
}
