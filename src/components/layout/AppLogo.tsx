/**
 * AppLogo — Logo da aplicação com suporte à SKIN DIVERSITY.
 *
 * SKIN DIVERSITY:
 * Quando o preset 'diversity' está ativo, applyThemePreset() marca
 * document.documentElement.dataset.presetId = 'diversity'.
 * O hook usePresetId() observa esse atributo via MutationObserver e
 * aplica gradiente arco-íris (var(--gradient-primary)) em:
 *   1. Fundo do ícone   → background via inline style
 *   2. Texto "Promo Gifts"  → background-clip: text trick
 *   3. Subtítulo "Store System" → idem (com opacity-70 herdada)
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
  variant?: 'brand' | 'dark' | 'light' | 'sidebar';
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

  // SKIN DIVERSITY: fundo do ícone como gradiente arco-íris.
  const iconBgClass = isDiversity
    ? '' // inline style cuida do fundo — classe vazia evita conflito
    : usesPrimary
      ? 'bg-primary'
      : 'bg-foreground';

  const iconStyle = isDiversity ? { background: 'var(--gradient-primary)' } : undefined;

  // SKIN DIVERSITY: gradient text trick — background-clip:text revela o
  // gradiente arco-íris através do shape do texto. Não afeta elementos SVG.
  const gradientTextStyle: React.CSSProperties | undefined = isDiversity
    ? {
        background: 'var(--gradient-primary)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }
    : undefined;

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
          {/* Name — DIVERSITY: gradient text | Outros: text-foreground/text-white */}
          <span
            className={cn(
              'font-display text-xl font-bold leading-none tracking-tight',
              isDiversity ? '' : textColor,
              textClassName,
            )}
            style={gradientTextStyle}
          >
            Promo Gifts
          </span>

          {/* Subtitle — DIVERSITY: gradient text (opacity-70 herdado) | Outros: muted/primary */}
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-widest opacity-70',
              isDiversity ? '' : variant === 'light' ? 'text-primary' : 'text-muted-foreground',
              subtextClassName,
            )}
            style={gradientTextStyle}
          >
            Store System
          </span>
        </div>
      )}
    </div>
  );
}
