/**
 * Centralized translation of backend errors for credentials.
 * All Connections components must use these helpers so the user
 * always sees the same wording, tone and structure.
 *
 * Tone guidelines:
 * - Address the admin directly, second-person ("verifique", "tente").
 * - Keep messages action-oriented (what to do next).
 * - Avoid raw stack traces, HTTP codes or English jargon.
 */
import type { SecretError } from '@/hooks/admin';

export type SecretErrorCategory =
  | 'permission'
  | 'validation'
  | 'whitelist'
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'conflict'
  | 'server'
  | 'unknown';

export interface NormalizedSecretError {
  /** Short tag rendered as a chip ("Permissão", "Validação", ...). */
  category: SecretErrorCategory;
  /** Localized chip label. */
  categoryLabel: string;
  /** Single-sentence headline ("Falha ao salvar API_KEY"). */
  title: string;
  /** Plain-language description of what happened. */
  description: string;
  /** Optional action hint ("Tente novamente em alguns segundos."). */
  hint?: string;
  /** Stable code so callers can branch (e.g., disable retry on permission). */
  code: string;
  /** True for transient errors that benefit from a manual retry. */
  retryable: boolean;
}

const CATEGORY_LABELS: Record<SecretErrorCategory, string> = {
  permission: 'Permissão',
  validation: 'Validação',
  whitelist: 'Bloqueado',
  network: 'Conexão',
  timeout: 'Tempo esgotado',
  rate_limit: 'Muitas tentativas',
  conflict: 'Conflito',
  server: 'Servidor',
  unknown: 'Erro',
};

function lower(s: string | undefined): string {
  return (s ?? '').toLowerCase();
}

/**
 * Translates a raw backend error into a fully-localized, user-friendly shape.
 * Always pass the secret name so messages can mention it ("API_KEY").
 */
export function normalizeSecretError(
  err: SecretError | null | undefined,
  secretName: string,
  context: { action?: 'save' | 'rotate' | 'delete' | 'refresh' | 'test' } = {},
): NormalizedSecretError {
  const code = err?.code ?? 'unexpected';
  const msg = lower(err?.message);
  const action = context.action ?? 'save';
  const actionVerb =
    action === 'rotate'
      ? 'rotacionar'
      : action === 'delete'
        ? 'remover'
        : action === 'refresh'
          ? 'atualizar'
          : action === 'test'
            ? 'testar'
            : 'salvar';
  const titleBase = `Falha ao ${actionVerb} ${secretName}`;

  const make = (
    category: SecretErrorCategory,
    description: string,
    opts: { hint?: string; retryable?: boolean; title?: string } = {},
  ): NormalizedSecretError => ({
    category,
    categoryLabel: CATEGORY_LABELS[category],
    title: opts.title ?? titleBase,
    description,
    hint: opts.hint,
    code,
    retryable: opts.retryable ?? false,
  });

  // 1) Branch by structured code first
  switch (code) {
    case 'forbidden':
    case 'unauthorized':
      return make('permission', 'Apenas administradores podem alterar esta credencial.', {
        hint: 'Peça acesso a um administrador antes de tentar novamente.',
      });
    case 'not_whitelisted':
      return make(
        'whitelist',
        `O nome "${secretName}" não está na lista permitida de credenciais.`,
        {
          hint: 'Confirme se o nome digitado está correto ou solicite a inclusão na whitelist.',
        },
      );
    case 'invalid_value':
    case 'validation_error':
      return make(
        'validation',
        err?.message?.trim() || 'O valor informado não atende aos requisitos mínimos.',
        {
          hint: 'Confira o formato esperado para esta credencial e tente novamente.',
        },
      );
    case 'rate_limited':
      return make('rate_limit', 'Muitas tentativas em pouco tempo.', {
        hint: 'Aguarde alguns segundos antes de tentar novamente.',
        retryable: true,
      });
    case 'timeout':
      return make('timeout', 'O servidor demorou demais para responder.', {
        hint: 'Verifique sua conexão e tente novamente em instantes.',
        retryable: true,
      });
    case 'network_error':
      return make('network', 'Não foi possível alcançar o servidor.', {
        hint: 'Verifique sua conexão e tente novamente.',
        retryable: true,
      });
    case 'conflict':
      return make('conflict', 'Outra alteração foi feita em paralelo.', {
        hint: 'Recarregue a credencial e refaça a operação.',
      });
    case 'db_error':
    case 'server_error':
      return make('server', err?.message?.trim() || 'Erro interno ao gravar no banco.', {
        hint: 'Aguarde alguns segundos e tente novamente.',
        retryable: true,
      });
  }

  // 2) Fallback: heuristics on the message text
  if (msg.includes('not allowed') || msg.includes('forbidden') || msg.includes('permission')) {
    return make('permission', 'Apenas administradores podem alterar esta credencial.', {
      hint: 'Peça acesso a um administrador antes de tentar novamente.',
    });
  }
  if (msg.includes('whitelist') || msg.includes('não permitido')) {
    return make('whitelist', `O nome "${secretName}" não está na lista permitida.`, {
      hint: 'Confirme o nome ou solicite a inclusão na whitelist.',
    });
  }
  if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('timed out')) {
    return make('timeout', 'O servidor demorou demais para responder.', {
      hint: 'Tente novamente em instantes.',
      retryable: true,
    });
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch failed')) {
    return make('network', 'Não foi possível alcançar o servidor.', {
      hint: 'Verifique sua conexão e tente novamente.',
      retryable: true,
    });
  }
  if (msg.includes('rate') || msg.includes('too many')) {
    return make('rate_limit', 'Muitas tentativas em pouco tempo.', {
      hint: 'Aguarde alguns segundos antes de tentar novamente.',
      retryable: true,
    });
  }
  if (/\b5\d\d\b/.exec(msg) || msg.includes('internal server')) {
    return make('server', 'Erro interno do servidor.', {
      hint: 'Aguarde alguns segundos e tente novamente.',
      retryable: true,
    });
  }

  // 3) Last resort
  return make('unknown', err?.message?.trim() || 'Não foi possível concluir a operação.', {
    hint: 'Se o problema persistir, contate o suporte.',
  });
}

/**
 * Backwards-compatible single-line description for places that only need a string
 * (e.g. inline `setLastError(...)` banners).
 */
export function describeSecretError(
  err: SecretError | null | undefined,
  secretName: string,
  context?: { action?: 'save' | 'rotate' | 'delete' | 'refresh' | 'test' },
): string {
  const n = normalizeSecretError(err, secretName, context);
  return n.hint ? `${n.description} ${n.hint}` : n.description;
}
