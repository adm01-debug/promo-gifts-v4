import {
  Clock,
  WifiOff,
  Globe,
  KeyRound,
  ServerCrash,
  Settings2,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { ErrorKind } from '@/hooks/intelligence';

export type ErrorTone = 'auth' | 'config' | 'dns' | 'http' | 'network' | 'timeout' | 'unknown';

export interface ErrorCopy {
  /** Título humano e curto. */
  title: string;
  /** Dica acionável para o usuário resolver. */
  hint: string;
  /** Ícone semântico associado. */
  icon: LucideIcon;
  /** Tom semântico (para estilos). */
  tone: ErrorTone;
}

/**
 * Mapeia `error_kind` (+ `status` HTTP opcional) numa cópia coerente
 * com título, dica acionável e ícone. SSOT para mensagens de erro
 * de conexões em toasts, linhas de status e modais.
 */
export function getErrorCopy(
  kind?: ErrorKind | null,
  status?: number | null,
  fallbackMessage?: string | null,
  timeoutMs?: number | null,
): ErrorCopy {
  switch (kind) {
    case 'timeout':
      return {
        title: 'Tempo esgotado',
        hint:
          timeoutMs && timeoutMs > 0
            ? `O endpoint não respondeu em ${timeoutMs}ms. Verifique se o serviço está ativo e acessível.`
            : 'O endpoint não respondeu em tempo. Verifique se o serviço está ativo e acessível.',
        icon: Clock,
        tone: 'timeout',
      };
    case 'network':
      return {
        title: 'Sem conexão com o serviço',
        hint: 'Falha de rede ao alcançar o destino. Verifique firewall, VPN ou se o host está no ar.',
        icon: WifiOff,
        tone: 'network',
      };
    case 'dns':
      return {
        title: 'URL não encontrada',
        hint: 'O DNS não resolveu o domínio. Confira a URL configurada na conexão.',
        icon: Globe,
        tone: 'dns',
      };
    case 'auth':
      return {
        title: 'Credenciais rejeitadas',
        hint: 'Token, chave ou senha inválido/expirado. Reabra o secret e cole o valor atualizado.',
        icon: KeyRound,
        tone: 'auth',
      };
    case 'http': {
      const s = status ?? 0;
      let hint = 'O serviço destino retornou um erro. Inspecione a resposta nos detalhes.';
      if (s >= 400 && s < 500) {
        hint = 'Requisição rejeitada pelo serviço. Verifique payload, permissões e escopos.';
      } else if (s >= 500) {
        hint = 'Instabilidade no serviço destino. Tente novamente em alguns minutos.';
      }
      return {
        title: status ? `Erro HTTP ${status}` : 'Erro HTTP',
        hint,
        icon: ServerCrash,
        tone: 'http',
      };
    }
    case 'config':
      return {
        title: 'Configuração incompleta',
        hint: 'Faltam campos obrigatórios. Edite a conexão e preencha todas as credenciais.',
        icon: Settings2,
        tone: 'config',
      };
    case 'unknown':
    case null:
    case undefined:
    default:
      return {
        title: 'Falha na conexão',
        hint:
          fallbackMessage?.trim() ||
          'Não foi possível identificar a causa. Veja os detalhes do teste.',
        icon: AlertTriangle,
        tone: 'unknown',
      };
  }
}

/**
 * Classes Tailwind (com tokens semânticos) para o badge de `error_kind`,
 * dando um sinal visual por tipo de falha. Usa apenas tokens da paleta
 * (destructive/amber/blue/etc via classes utilitárias do design system).
 */
export function getKindBadgeClass(tone: ErrorTone): string {
  switch (tone) {
    case 'timeout':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'network':
      return 'border-brand-primary-500/40 bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-400';
    case 'dns':
      return 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400';
    case 'auth':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400';
    case 'http':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    case 'config':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'unknown':
    default:
      return 'border-muted-foreground/40 bg-muted text-muted-foreground';
  }
}

/** Rótulo PT-BR curto e legível para o badge. */
export function getKindLabel(tone: ErrorTone): string {
  switch (tone) {
    case 'timeout':
      return 'Timeout';
    case 'network':
      return 'Rede';
    case 'dns':
      return 'DNS';
    case 'auth':
      return 'Auth';
    case 'http':
      return 'HTTP';
    case 'config':
      return 'Config';
    case 'unknown':
    default:
      return 'Desconhecido';
  }
}
