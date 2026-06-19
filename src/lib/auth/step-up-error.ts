/**
 * step-up-error
 *
 * Helpers para detectar e tratar erros retornados por edge functions
 * sensíveis (mcp-keys-*, step-up-verify, etc.).
 *
 * Categorias tratadas:
 *  - `step_up_required`  → não houve step-up ou token ausente.
 *  - `step_up_invalid`   → token expirou/foi invalidado entre desafio e chamada.
 *  - `dev_role_required` → o usuário perdeu o papel `dev` ENTRE a confirmação
 *    no diálogo e a execução da operação full (revogação automática de
 *    grant, remoção do papel, etc.). Toast específico orientando reenviar
 *    o step-up depois que o papel for restaurado.
 *
 * O cliente Supabase entrega o body parseado em `data` mesmo quando a
 * resposta é 4xx, mas também propaga `error` (FunctionsHttpError). Esta
 * função inspeciona ambos os caminhos sem expor `request_id` ou stacks.
 */
import { toast } from 'sonner';

export type StepUpErrorKind = 'step_up_required' | 'step_up_invalid' | 'dev_role_required';

interface BackendErrorShape {
  error?: string;
  message?: string;
  reason?: string;
}

function collectCandidates(data: unknown, error: unknown): BackendErrorShape[] {
  const candidates: BackendErrorShape[] = [];
  if (data && typeof data === 'object') candidates.push(data);
  if (error && typeof error === 'object') {
    const e = error as { context?: { body?: unknown }; message?: string };
    const body = e.context?.body;
    if (typeof body === 'string') {
      try {
        candidates.push(JSON.parse(body) as BackendErrorShape);
      } catch {
        /* noop */
      }
    } else if (body && typeof body === 'object') {
      candidates.push(body);
    }
    if (typeof e.message === 'string') candidates.push({ error: e.message });
  }
  return candidates;
}

/** Tenta extrair erro de step-up / perda de role do body devolvido pela edge function. */
export function extractStepUpError(
  data: unknown,
  error: unknown,
): { kind: StepUpErrorKind; message: string } | null {
  const candidates = collectCandidates(data, error);

  for (const c of candidates) {
    // Perda de role dev entre confirmação e execução. O backend devolve
    // `error: "forbidden"` com `reason: "not_dev" | "dev_role_required" | "not_dev_at_edge"`,
    // e o mcp-server pode devolver `MCP_KEY_AUTO_REVOKED_DEV_LOST`.
    const isDevLost =
      c.reason === 'dev_role_required' ||
      c.reason === 'not_dev' ||
      c.reason === 'not_dev_at_edge' ||
      c.error === 'MCP_KEY_AUTO_REVOKED_DEV_LOST' ||
      c.error === 'dev_role_required';
    if (isDevLost) {
      return {
        kind: 'dev_role_required',
        message:
          typeof c.message === 'string' && c.message.trim().length > 0
            ? c.message
            : 'Seu papel de desenvolvedor foi removido entre a confirmação e a execução desta operação. Peça para um administrador restaurar o acesso e refaça a verificação dupla.',
      };
    }

    if (c.error === 'step_up_required' || c.error === 'step_up_invalid') {
      return {
        kind: c.error,
        message:
          typeof c.message === 'string' && c.message.trim().length > 0
            ? c.message
            : c.error === 'step_up_required'
              ? 'Confirme sua identidade (senha + código por e-mail) para continuar.'
              : 'Verificação dupla expirou ou é inválida. Refaça a confirmação.',
      };
    }
  }
  return null;
}

/**
 * Exibe um toast padronizado. Para `step_up_*` o CTA refaz o desafio
 * imediatamente. Para `dev_role_required` o CTA também tenta refazer
 * (caso o admin já tenha restaurado o papel), mas o texto deixa claro
 * que pode ser necessário aguardar a restauração do acesso.
 */
export function showStepUpToast(kind: StepUpErrorKind, message: string, onRetry: () => void): void {
  if (kind === 'dev_role_required') {
    toast.error('Acesso de desenvolvedor revogado', {
      id: `step-up-${kind}`,
      description: message,
      duration: 12000,
      action: {
        label: 'Refazer verificação',
        onClick: onRetry,
      },
    });
    return;
  }
  const title =
    kind === 'step_up_required' ? 'Verificação dupla obrigatória' : 'Verificação dupla inválida';
  toast.error(title, {
    id: `step-up-${kind}`,
    description: message,
    duration: 8000,
    action: {
      label: 'Refazer verificação',
      onClick: onRetry,
    },
  });
}

/**
 * Atalho: detecta + dispara o toast. Retorna `true` se foi tratado
 * (caller deve abortar fluxo padrão de erro).
 */
export function handleStepUpError(data: unknown, error: unknown, onRetry: () => void): boolean {
  const detected = extractStepUpError(data, error);
  if (!detected) return false;
  showStepUpToast(detected.kind, detected.message, onRetry);
  return true;
}
