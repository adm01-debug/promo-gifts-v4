/**
 * Configuração canônica de roles para a UI.
 *
 * Hierarquia oficial: dev > supervisor > vendedor (=agente no UI).
 * 'admin' e 'manager' são aliases legados — exibidos como Supervisor.
 */
import { type LucideIcon, Code2, ShieldCheck, User } from 'lucide-react';

export type AppRole =
  | 'admin'
  | 'agente'
  | 'coordenador'
  | 'dev'
  | 'manager'
  | 'supervisor'
  | 'vendedor';

export type RoleVisual = {
  /** Rótulo exibido ao usuário (sempre em português). */
  label: string;
  /** Ícone Lucide associado ao role. */
  Icon: LucideIcon;
  /** Variante do <Badge> shadcn. */
  variant: 'default' | 'outline' | 'secondary';
  /** Classes adicionais usando tokens semânticos do design system. */
  className: string;
  /** Descrição curta para tooltips/legendas. */
  description: string;
};

export const ROLE_VISUAL: Record<AppRole, RoleVisual> = {
  dev: {
    label: 'Dev',
    Icon: Code2,
    variant: 'default',
    className: 'bg-accent text-accent-foreground border-accent',
    description: 'Acesso técnico total: integrações, chaves MCP e auditoria.',
  },
  supervisor: {
    label: 'Supervisor',
    Icon: ShieldCheck,
    variant: 'default',
    className: 'bg-primary text-primary-foreground border-primary',
    description: 'Aprova orçamentos e descontos, gerencia equipe e operação.',
  },
  vendedor: {
    label: 'Agente',
    Icon: User,
    variant: 'secondary',
    className: '',
    description: 'Cria orçamentos e atende clientes dentro de sua alçada.',
  },
  agente: {
    label: 'Agente',
    Icon: User,
    variant: 'secondary',
    className: '',
    description: 'Cria orçamentos e atende clientes dentro de sua alçada.',
  },
  coordenador: {
    label: 'Coordenador',
    Icon: ShieldCheck,
    variant: 'default',
    className: 'bg-primary/80 text-primary-foreground border-primary/80',
    description: 'Coordena equipe de vendas e gerencia operações de sua área.',
  },
  // ── Aliases legados ──
  admin: {
    label: 'Supervisor',
    Icon: ShieldCheck,
    variant: 'default',
    className: 'bg-primary text-primary-foreground border-primary',
    description: 'Aprova orçamentos e descontos, gerencia equipe e operação.',
  },
  manager: {
    label: 'Supervisor',
    Icon: ShieldCheck,
    variant: 'default',
    className: 'bg-primary text-primary-foreground border-primary',
    description: 'Aprova orçamentos e descontos, gerencia equipe e operação.',
  },
};

/** Retorna o rótulo amigável de uma role (com fallback seguro). */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Agente';
  return ROLE_VISUAL[role as AppRole]?.label ?? 'Agente';
}

/** Retorna a configuração visual completa (com fallback para Agente). */
export function getRoleVisual(role: string | null | undefined): RoleVisual {
  if (!role) return ROLE_VISUAL.vendedor;
  return ROLE_VISUAL[role as AppRole] ?? ROLE_VISUAL.vendedor;
}
