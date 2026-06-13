/**
 * AppLogo — Logo da aplicação com suporte à SKIN DIVERSITY.
 *
 * SKIN DIVERSITY (BUG-LOGO-01):
 * Quando o preset 'diversity' está ativo, applyThemePreset() marca
 * document.documentElement.dataset.presetId = 'diversity'.
 * O hook usePresetId() observa esse atributo via MutationObserver e
 * retorna o id atual, permitindo que o ícone exiba o gradiente arco-íris
 * (var(--gradient-primary)) em vez do bg-primary sólido.
 */
import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Hook: detecta o preset ativo via data-preset-id no <html> ──────────────
function usePresetId(): string {
  const [presetId, setPresetId] = useState<string>(
    () => document.documentElement.dataset.presetId ?? 'corporate',
  );

  useEffect(() => {
    const root = document.documentElement;

    // Leitura inicial (caso applyThemePreset já tenha rodado antes do mount)
    setPresetId(root.dataset.presetId ?? 'corporate');

    const observer = new MutationObserver(() => {
      setPresetId(root.dataset.presetId ?? 'corporate');
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-preset-id'],
    });

    return () => observer.disconnect();
  }, []);

  return presetId;
}

// ── Componente ──────────────────────────────────────────────────────────────
interface AppLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  subtextClassName?: string;
  showText?: boolean;
  variant?: 'light' | 'dark' | 'brand' | 'sidebar';
  onClick?: () => void;
}

export function AppLogo({
  className,
  iconClassName,
  textClassName,
  subtextClassName,
  showText = true,
  variant = 'brand',
  onClick,
}: AppLogoProps) {
  const presetId = usePresetId();
  const isDiversity = presetId === 'diversity';

  const usesPrimary = variant === 'brand' || variant === 'sidebar' || variant === 'light';
  const iconColor = usesPrimary ? 'text-primary-foreground' : 'text-background';
  const textColor = variant === 'light' ? 'text-white' : 'text-foreground';

  // SKIN DIVERSITY: aplica o gradient-primary (arco-íris) no fundo do ícone.
  // Para as demais skins usa bg-primary sólido (padrão V3).
  const iconBgClass = isDiversity
    ? '' // inline style cuida do fundo — classe vazia evita conflito
    : usesPrimary
      ? 'bg-primary'
      : 'bg-foreground';

  const iconStyle = isDiversity ? { background: 'var(--gradient-primary)' } : undefined;

  return (
    <div
      className={cn('flex items-center gap-3', className, onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      {/* Icon box — V3 exact: h-10 w-10, rounded-xl, shadow-lg */}
      <div
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-lg',
          iconBgClass,
          iconClassName,
        )}
        style={iconStyle}
      >
        {/* Gift icon — V3 exact: h-6 w-6 */}
        <Gift className={cn('h-6 w-6', isDiversity ? 'text-white drop-shadow-sm' : iconColor)} />
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
