/**
 * ScopeBadge — indica visualmente o escopo de dados que o usuário enxerga
 * em listas de vendas (propostas, pedidos, descontos).
 */
import { Badge } from '@/components/ui/badge';
import { Eye, Users, Globe } from 'lucide-react';
import { useSalesScope, type SalesScope } from '@/lib/auth/visibility-scope';

const LABELS: Record<
  SalesScope,
  { text: string; icon: typeof Eye; variant: 'outline' | 'secondary' }
> = {
  self: { text: 'Apenas seus dados', icon: Eye, variant: 'secondary' },
  team: { text: 'Dados do time', icon: Users, variant: 'outline' },
  all: { text: 'Todos os dados', icon: Globe, variant: 'outline' },
};

export function ScopeBadge({ className }: { className?: string }) {
  const scope = useSalesScope();
  const cfg = LABELS[scope];
  const Icon = cfg.icon;
  return (
    <Badge
      variant={cfg.variant}
      className={className}
      aria-label={`Escopo de visibilidade: ${cfg.text}`}
    >
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {cfg.text}
    </Badge>
  );
}
