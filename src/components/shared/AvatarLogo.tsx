import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';

interface AvatarLogoProps {
  name?: string | null;
  logoUrl?: string | null;
  size?: 'lg' | 'md' | 'sm' | 'xl';
  className?: string;
  fallbackClassName?: string;
}

const AVATAR_SIZE_CLASSES = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base',
} as const;

export function AvatarLogo({
  name,
  logoUrl,
  size = 'md',
  className,
  fallbackClassName,
}: AvatarLogoProps) {
  const dim = AVATAR_SIZE_CLASSES[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name || 'Company logo'}
        className={cn(
          dim,
          'flex-shrink-0 rounded-full border border-border bg-background object-cover',
          className,
        )}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        dim,
        'flex flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
        fallbackClassName || className,
      )}
    >
      {name ? name.substring(0, 2).toUpperCase() : <Building2 className="h-1/2 w-1/2" />}
    </div>
  );
}
