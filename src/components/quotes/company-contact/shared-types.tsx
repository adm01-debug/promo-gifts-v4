/**
 * Shared types and small components for CompanyContactSelector
 */
import { cn } from '@/lib/utils';

export interface CompanyOption {
  id: string;
  name: string;
  razao_social: string;
  nome_fantasia: string | null;
  ramo_atividade: string | null;
  cnpj: string | null;
  logo_url: string | null;
}

export interface ContactOption {
  id: string;
  name: string;
  cargo: string | null;
  email: string | null;
  phone: string | null;
}

export function CompanyAvatar({
  name,
  logoUrl,
  size = 'md',
}: {
  name: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn(
          dim,
          'flex-shrink-0 rounded-full border border-border bg-background object-cover',
        )}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        'flex flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
