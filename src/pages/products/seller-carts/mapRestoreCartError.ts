/**
 * Mapeia erros do Postgres/Supabase (RPC `restore_seller_cart`) para mensagens
 * específicas de UI, mantendo o fallback sanitizado via `sanitizeError`.
 *
 * Regra: só retornamos mensagens acionáveis (o que o usuário pode fazer);
 * detalhes técnicos ficam no console/log estruturado. Se nenhum padrão
 * conhecido bater, delega a `sanitizeError` para evitar vazamento.
 */
import { sanitizeError } from '@/lib/security/sanitize-error';

interface PgErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

const MAX_SELLER_CARTS_HINT = /já tem .* carrinhos ativos/i;

/** Título opcional para sobrescrever o padrão "Não foi possível restaurar o carrinho." */
export interface MappedRestoreError {
  /** Descrição exibida no toast (SEMPRE segura para o usuário). */
  description: string;
  /** Título opcional. Se omitido, o chamador usa "Não foi possível restaurar o carrinho." */
  title?: string;
  /** Código curto para logs/telemetria (não é exibido). */
  reason:
    'cart_limit' | 'check_constraint' | 'duplicate_item' | 'foreign_key' | 'network' | 'not_null' | 'rls_denied' | 'rpc_missing' | 'server' | 'string_too_long' | 'timeout' | 'unauthenticated' | 'unknown';
}

/**
 * Extrai um objeto tipo PostgrestError de qualquer forma comum de erro
 * (Error, {message}, string, resposta bruta da RPC).
 */
function toPgError(input: unknown): PgErrorLike {
  if (!input) return {};
  if (typeof input === 'string') return { message: input };
  if (input instanceof Error) {
    const anyErr = input as Error & Partial<PgErrorLike>;
    return {
      message: anyErr.message,
      code: anyErr.code,
      details: anyErr.details ?? null,
      hint: anyErr.hint ?? null,
      status: anyErr.status,
    };
  }
  if (typeof input === 'object') return input as PgErrorLike;
  return { message: String(input) };
}

export function mapRestoreCartError(input: unknown): MappedRestoreError {
  const err = toPgError(input);
  const code = String(err.code ?? '').trim();
  const message = String(err.message ?? '').toLowerCase();
  const details = String(err.details ?? '').toLowerCase();
  const status = err.status ?? 0;

  // ── Limite de carrinhos ativos (Error com mensagem construída em useSellerCarts)
  if (MAX_SELLER_CARTS_HINT.test(String(err.message ?? ''))) {
    return {
      reason: 'cart_limit',
      title: 'Limite de carrinhos ativos atingido.',
      description:
        'Finalize ou exclua um carrinho existente antes de restaurar este.',
    };
  }

  // ── Não autenticado (thrown como Error("Não autenticado"))
  if (/não autenticado|not authenticated/i.test(err.message ?? '')) {
    return {
      reason: 'unauthenticated',
      title: 'Sessão expirada.',
      description: 'Faça login novamente para restaurar o carrinho.',
    };
  }

  // ── RPC ausente no banco (PGRST202 / 42883) ──────────────────────────
  // Cenário: função `restore_seller_cart` não existe no schema cache do
  // Postgres (banco fora de sincronia com o app). Comunique com clareza
  // em vez de esconder atrás do fallback genérico "operação não pôde ser
  // concluída".
  if (
    code === 'PGRST202' ||
    code === '42883' ||
    (/restore_seller_cart/i.test(message) &&
      /(schema cache|could not find|does not exist|not found)/i.test(message))
  ) {
    return {
      reason: 'rpc_missing',
      title: 'Restauração indisponível no momento.',
      description:
        'O servidor está fora de sincronia com o app. Recrie o carrinho manualmente e avise o administrador.',
    };
  }

  // ── Postgres SQLSTATE ─────────────────────────────────────────────

  // 42501 = insufficient_privilege (RLS bloqueou o INSERT)
  if (code === '42501' || status === 403 || /row-level security/i.test(err.message ?? '')) {
    return {
      reason: 'rls_denied',
      title: 'Sem permissão para restaurar.',
      description:
        'Você não tem autorização para restaurar este carrinho. Faça login novamente ou solicite acesso.',
    };
  }

  // 23505 = unique_violation
  if (code === '23505') {
    if (
      message.includes('unique_cart_item_variant') ||
      details.includes('unique_cart_item_variant')
    ) {
      return {
        reason: 'duplicate_item',
        description:
          'Um dos itens já existe neste carrinho com a mesma cor. Ajuste as quantidades e tente novamente.',
      };
    }
    return {
      reason: 'duplicate_item',
      description: 'Este carrinho ou item já existe. Verifique e tente novamente.',
    };
  }

  // 23503 = foreign_key_violation
  if (code === '23503') {
    return {
      reason: 'foreign_key',
      description:
        'Um produto ou empresa referenciada no carrinho não existe mais. Não é possível restaurar.',
    };
  }

  // 23502 = not_null_violation
  if (code === '23502') {
    return {
      reason: 'not_null',
      description:
        'Faltam informações obrigatórias no carrinho salvo. Crie um novo carrinho manualmente.',
    };
  }

  // 23514 = check_violation
  if (code === '23514') {
    return {
      reason: 'check_constraint',
      description:
        'Os dados do carrinho não atendem às regras de validação (quantidade ou status inválido).',
    };
  }

  // 22001 = string_data_right_truncation
  if (code === '22001') {
    return {
      reason: 'string_too_long',
      description: 'Um campo do carrinho é longo demais para ser salvo.',
    };
  }

  // ── Rede / timeout / infra ──────────────────────────────────────────
  if (/failed to fetch|network|econnrefused|etimedout|enotfound/i.test(message)) {
    return {
      reason: 'network',
      title: 'Falha de conexão.',
      description: 'Verifique sua internet e tente desfazer novamente.',
    };
  }
  if (/timeout|statement timeout/i.test(message) || code === '57014') {
    return {
      reason: 'timeout',
      description: 'A restauração demorou demais. Tente novamente em instantes.',
    };
  }
  if (status >= 500) {
    return {
      reason: 'server',
      description: 'Erro no servidor ao restaurar. Tente novamente em instantes.',
    };
  }

  // ── Fallback: sanitizeError garante que nada sensível vaze ──────────
  return {
    reason: 'unknown',
    description: sanitizeError(input),
  };
}
