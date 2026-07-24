import React, { type ReactNode } from 'react';
import {
  Package,
  FileText,
  Users,
  Search,
  FolderOpen,
  Heart,
  ShoppingCart,
  Bell,
  TrendingUp,
  Inbox,
  Plus,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateVariant =
  | 'analytics'
  | 'cart'
  | 'clients'
  | 'collections'
  | 'error'
  | 'favorites'
  | 'generic'
  | 'notifications'
  | 'orders'
  | 'products'
  | 'quotes'
  | 'search'
  | 'security';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

const variants: Record<
  EmptyStateVariant,
  {
    icon: typeof Package;
    title: string;
    description: string;
    color: string;
  }
> = {
  products: {
    icon: Package,
    title: 'Nenhum produto encontrado',
    description: 'Não encontramos produtos com os filtros selecionados. Tente ajustar sua busca.',
    color: 'text-primary',
  },
  quotes: {
    icon: FileText,
    title: 'Nenhum orçamento ainda',
    description: 'Comece criando seu primeiro orçamento para um cliente.',
    color: 'text-primary',
  },
  orders: {
    icon: ShoppingCart,
    title: 'Nenhum pedido encontrado',
    description: 'Os pedidos aparecerão aqui quando os orçamentos forem aprovados.',
    color: 'text-brand-primary',
  },
  clients: {
    icon: Users,
    title: 'Nenhum cliente cadastrado',
    description: 'Adicione clientes para começar a criar orçamentos personalizados.',
    color: 'text-primary',
  },
  search: {
    icon: Search,
    title: 'Sem resultados',
    description: 'Não encontramos nada para sua busca. Tente termos diferentes.',
    color: 'text-muted-foreground',
  },
  collections: {
    icon: FolderOpen,
    title: 'Nenhuma coleção criada',
    description: 'Organize seus produtos favoritos em coleções personalizadas.',
    color: 'text-warning',
  },
  favorites: {
    icon: Heart,
    title: 'Nenhum favorito ainda',
    description: 'Marque produtos como favoritos para acessá-los rapidamente.',
    color: 'text-destructive',
  },
  cart: {
    icon: ShoppingCart,
    title: 'Carrinho vazio',
    description: 'Adicione produtos ao carrinho para criar um orçamento.',
    color: 'text-primary',
  },
  notifications: {
    icon: Bell,
    title: 'Nenhuma notificação',
    description: 'Você está em dia! Novas notificações aparecerão aqui.',
    color: 'text-primary',
  },
  analytics: {
    icon: TrendingUp,
    title: 'Sem dados disponíveis',
    description: 'Os dados analíticos aparecerão quando houver atividade.',
    color: 'text-success',
  },
  error: {
    icon: AlertCircle,
    title: 'Ocorreu um erro',
    description: 'Não foi possível carregar os dados. Tente novamente em instantes.',
    color: 'text-destructive',
  },
  security: {
    icon: ShieldAlert,
    title: 'Acesso restrito',
    description: 'Você não tem permissão para visualizar este conteúdo.',
    color: 'text-warning',
  },
  generic: {
    icon: Inbox,
    title: 'Nada por aqui',
    description: 'Não há itens para exibir no momento.',
    color: 'text-muted-foreground',
  },
};

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    { variant = 'generic', title, description, action, secondaryAction, className, children },
    ref,
  ) => {
    const config = variants[variant];
    const Icon = config.icon;

    return (
      <div
        ref={ref}
        className={cn(
          'flex animate-fade-in flex-col items-center justify-center px-6 py-12 text-center',
          className,
        )}
      >
        {/* Animated Icon Container */}
        <div className="relative mb-6 animate-scale-in">
          {/* Background circles */}
          <div className="absolute inset-0 -m-4">
            <div className="absolute inset-0 animate-pulse rounded-full bg-muted/50" />
            <div className="absolute inset-2 rounded-full bg-muted/30" />
          </div>

          {/* Icon */}
          <div
            className={cn(
              'relative z-10 rounded-2xl bg-gradient-subtle p-6',
              'border border-border shadow-sm',
            )}
          >
            <Icon className={cn('h-12 w-12', config.color)} strokeWidth={1.5} />
          </div>
        </div>

        {/* Text content */}
        <div className="max-w-md animate-fade-in space-y-2">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {title || config.title}
          </h3>
          <p className="text-muted-foreground">{description || config.description}</p>
        </div>

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className="mt-6 flex animate-fade-in flex-wrap gap-3">
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition-all duration-300 ease-out hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4" />
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 border-primary/30 bg-background px-4 py-2 text-sm font-bold text-primary transition-all duration-300 ease-out hover:border-primary hover:bg-primary/5"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}

        {/* Custom content */}
        {children && <div className="mt-6 animate-fade-in">{children}</div>}
      </div>
    );
  },
);

// Compact version for inline use
export function InlineEmptyState({
  message,
  icon: iconElement = Inbox,
  className,
}: {
  message: string;
  icon?: typeof Inbox;
  className?: string;
}) {
  const Icon = iconElement;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-4',
        'text-sm text-muted-foreground',
        className,
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
