/**
 * Resposta de erro segura para edge functions.
 *
 * Loga o erro real no servidor (console.error) e devolve ao cliente apenas uma
 * mensagem genérica — nunca `error.message`, stack trace ou detalhes internos.
 * Evita o padrão CodeQL "Information exposure through a stack trace" (CWE-209/497).
 *
 * Para erros de VALIDAÇÃO de entrada (ex.: mensagens do zod), continue devolvendo
 * a mensagem específica diretamente — ela é controlada e destinada ao usuário.
 */
export interface SafeErrorOptions {
  /** Headers de CORS já calculados para o request. */
  corsHeaders?: Record<string, string>;
  /** Mensagem pública genérica (sem detalhes internos). */
  publicMessage?: string;
  /** Status HTTP da resposta. */
  status?: number;
  /** Correlação opcional para o cliente reportar o incidente. */
  requestId?: string;
  /** Rótulo do log no servidor. */
  logLabel?: string;
  /** Campos extras a incluir no corpo (ex.: code estável). */
  extra?: Record<string, unknown>;
}

export function safeErrorResponse(err: unknown, opts: SafeErrorOptions = {}): Response {
  const {
    corsHeaders = {},
    publicMessage = "internal_error",
    status = 500,
    requestId,
    logLabel = "[edge] unhandled error",
    extra = {},
  } = opts;

  // Log completo fica apenas no servidor.
  console.error(logLabel, err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));

  const body: Record<string, unknown> = { error: publicMessage, ...extra };
  if (requestId) body.request_id = requestId;

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
