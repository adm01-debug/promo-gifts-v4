/**
 * CompanyListAvatar — preset SSOT do avatar de empresa em listas
 * (Carrinhos, Orçamentos, Clientes, etc).
 *
 * Motivação: cada página estava passando `size="md" | "lg"` a mão em
 * `AvatarLogo`, gerando divergência visual. Este wrapper congela:
 *   - tamanho `lg` (40px) no desktop, `md` (32px) em telas < sm (evita overflow
 *     e mantém a altura da linha compacta em mobile);
 *   - ring padrão `ring-1 ring-border`.
 *
 * Se algum dia surgir um tamanho intermediário, adicione uma variante aqui e
 * migre todos os call-sites — não faça override inline.
 */
import { AvatarLogo } from '@/components/shared/AvatarLogo';
import { cn } from '@/lib/utils';

interface CompanyListAvatarProps {
  name?: string | null;
  logoUrl?: string | null;
  isLoading?: boolean;
  className?: string;
  /**
   * Reservado para exceções: força um tamanho fixo em vez do responsivo.
   * Default `undefined` = lg no desktop, md no mobile.
   */
  size?: 'lg' | 'md';
}

export function CompanyListAvatar({
  name,
  logoUrl,
  isLoading,
  className,
  size,
}: CompanyListAvatarProps) {
  // Quando size é fixo, delega direto ao AvatarLogo.
  if (size) {
    return (
      <AvatarLogo
        name={name}
        logoUrl={logoUrl}
        size={size}
        isLoading={isLoading}
        className={cn('ring-1 ring-border', className)}
      />
    );
  }

  // Responsivo: base `lg` (40px) + override para `md` (32px, text-xs) < sm.
  // `!` garante precedência sobre as classes internas do AvatarLogo.
  return (
    <AvatarLogo
      name={name}
      logoUrl={logoUrl}
      size="lg"
      isLoading={isLoading}
      className={cn(
        'ring-1 ring-border',
        'max-sm:!h-8 max-sm:!w-8 max-sm:!text-xs',
        className,
      )}
    />
  );
}
