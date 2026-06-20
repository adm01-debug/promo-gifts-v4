/**
 * withRetry — Retries an async operation with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const { maxRetries = 2, baseDelay = 500, shouldRetry = isRetryableError } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && shouldRetry(err)) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('fetch') ||
      msg.includes('500') ||
      msg.includes('503') ||
      msg.includes('429')
    );
  }
  return false;
}

/**
 * Translates technical error messages to user-friendly Portuguese messages.
 */
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof Event) {
    return 'Não foi possível conectar ao serviço de voz. Tente novamente.';
  }

  if (!(error instanceof Error)) return 'Erro desconhecido. Tente novamente.';

  const rawMessage = error.message?.trim();
  if (!rawMessage) {
    return 'Não foi possível conectar ao serviço de voz. Tente novamente.';
  }

  const msg = rawMessage.toLowerCase();

  if (msg.includes('microphone') || msg.includes('microfone') || msg.includes('permission'))
    return 'Permissão do microfone negada. Habilite o microfone nas configurações do navegador.';
  if (msg.includes('token')) return 'Não foi possível iniciar a transcrição. Tente novamente.';
  if (msg.includes('timeout'))
    return 'A conexão de voz demorou demais para responder. Tente novamente.';
  if (msg.includes('429') || msg.includes('rate limit'))
    return 'Muitas requisições. Aguarde alguns segundos e tente novamente.';
  if (msg.includes('402') || msg.includes('credits'))
    return 'Créditos de IA esgotados. Contate o administrador.';
  if (
    msg.includes('websocket') ||
    msg.includes('scribe') ||
    msg.includes('closed unexpectedly') ||
    msg.includes('no reason provided')
  )
    return 'Não foi possível conectar ao serviço de voz. Tente novamente.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  if (msg.includes('tts') || msg.includes('audio'))
    return 'Não foi possível reproduzir o áudio. O comando foi executado silenciosamente.';

  return rawMessage || 'Erro inesperado. Tente novamente.';
}
