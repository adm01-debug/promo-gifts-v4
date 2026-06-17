import { Database, AlertTriangle, Bug, ShieldAlert, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveSource } from './CredentialsSourceFilterContext';
import { useExplainMode } from './ExplainModeContext';
import type { SecretStatus, SecretError } from '@/hooks/admin';
import { cn } from '@/lib/utils';

/**
 * CardSourceDiagnostic — modo debug por card.
 *
 * Mostra de onde cada credencial do card está vindo:
 *   - DB        → integration_credentials (SSOT, gravado via /admin/conexoes)
 *   - ENV       → Deno.env.get fallback (legado / bootstrap)
 *   - AUSENTE   → nem DB nem ENV — card aparecerá como "Sem credenciais"
 *
 * Estado de erro de carga (loadError):
 *   - Quando `secrets-manager` falha (401/403/rede), exibe alerta dedicado
 *     com mensagem clara — em vez de mostrar tudo como "AUSENTE" (false positive).
 *
 * Visibilidade:
 *   - Sempre visível quando há credencial AUSENTE ou erro de carga
 *   - Visível quando o "Explain Mode" estiver ligado (toggle no header)
 *   - Oculto em estado normal (não polui o card)
 */

type Field = { label: string; status: SecretStatus | undefined };

interface Props {
  /** Lista de credenciais do card (URL, Anon, Service). */
  fields: Field[];
  /** readOnly (gerenciado) — se true, não mostra nada. */
  readOnly?: boolean;
  /** Erro do hook ao listar segredos (sem permissão / sessão expirada / rede). */
  loadError?: SecretError | null;
  className?: string;
}

const SOURCE_META = {
  db: {
    label: 'DB',
    cls: 'border-success/40 bg-success/10 text-success',
    description: 'integration_credentials',
    tooltip: {
      title: 'Origem: banco (SSOT)',
      body: 'Valor lido de integration_credentials via secrets-manager. Auditável e rotacionável.',
      action: 'Nada a fazer — basta usar.',
    },
  },
  env: {
    label: 'ENV',
    cls: 'border-warning/40 bg-warning/10 text-warning',
    description: 'Deno.env (fallback legado)',
    tooltip: {
      title: 'Origem: variável de ambiente (legado)',
      body: 'Resolvido por Deno.env.get() porque ainda não há registro em integration_credentials.',
      action: 'Edite o campo e clique em Salvar para migrar para o banco.',
    },
  },
  none: {
    label: 'AUSENTE',
    cls: 'border-destructive/40 bg-destructive/10 text-destructive',
    description: 'não configurado',
    tooltip: {
      title: 'Sem valor em DB nem em ENV',
      body: 'secrets-manager não encontrou esta credencial em nenhuma fonte. A integração ficará inativa.',
      action: 'Preencha o campo e salve para gravar em integration_credentials.',
    },
  },
} as const;

function describeLoadError(err: SecretError): { title: string; hint: string } {
  switch (err.code) {
    case 'unauthenticated':
      return {
        title: 'Sessão expirada — não foi possível ler as credenciais',
        hint: 'Faça login novamente para que o secrets-manager possa retornar o status real.',
      };
    case 'forbidden':
    case 'permission_denied':
      return {
        title: 'Sem permissão para ler credenciais',
        hint: 'Apenas administradores podem visualizar/editar credenciais. Solicite acesso ou peça a alguém com papel de admin para configurar este card.',
      };
    default:
      return {
        title: 'Falha ao carregar credenciais do secrets-manager',
        hint:
          err.message ||
          'Tente novamente em instantes. Se persistir, verifique os logs da função secrets-manager.',
      };
  }
}

export function CardSourceDiagnostic({ fields, readOnly, loadError, className }: Props) {
  const { enabled: explainOn } = useExplainMode();

  if (readOnly) return null;

  // Estado de erro de carga vence todos os outros — não dá para inferir origem
  // sem resposta do secrets-manager. Sem isso, todos os campos apareceriam como
  // "AUSENTE" e o usuário receberia um diagnóstico enganoso.
  if (loadError) {
    const { title, hint } = describeLoadError(loadError);
    return (
      <Alert variant="destructive" className={className} role="alert" aria-live="polite">
        <Lock className="h-4 w-4" />
        <AlertTitle className="text-sm">{title}</AlertTitle>
        <AlertDescription>
          <p className="text-xs">{hint}</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            código: {loadError.code}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const rows = fields.map((f) => ({
    label: f.label,
    source: resolveSource(f.status),
    suffix: f.status?.masked_suffix ?? null,
  }));

  const hasMissing = rows.some((r) => r.source === 'none');
  const usesEnvFallback = rows.some((r) => r.source === 'env');

  // Só renderiza se houver problema OU explain mode ligado
  if (!hasMissing && !usesEnvFallback && !explainOn) return null;

  const tone = hasMissing ? 'destructive' : usesEnvFallback ? 'warning' : 'info';
  const Icon = hasMissing ? ShieldAlert : usesEnvFallback ? AlertTriangle : Bug;
  const title = hasMissing
    ? 'Credencial faltando — diagnóstico de origem'
    : usesEnvFallback
      ? 'Usando fallback ENV — recomenda-se migrar para o banco'
      : 'Diagnóstico de origem (modo debug)';

  return (
    <Alert
      variant={tone === 'destructive' ? 'destructive' : 'default'}
      className={cn(
        tone === 'warning' && 'border-warning/40 bg-warning/5',
        tone === 'info' && 'border-primary/30 bg-primary/5',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      <AlertTitle className="text-sm">{title}</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1.5 text-xs">
          <TooltipProvider>
            {rows.map((r) => {
              const meta = SOURCE_META[r.source];
              return (
                <li key={r.label} className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        tabIndex={0}
                        className={cn(
                          'cursor-help font-mono text-[10px] uppercase focus:outline-none focus:ring-2 focus:ring-ring',
                          meta.cls,
                        )}
                        aria-label={`${r.label}: origem ${meta.label}`}
                      >
                        {meta.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="space-y-1">
                      <p className="font-semibold">{meta.tooltip.title}</p>
                      <p>{meta.tooltip.body}</p>
                      <p className="text-muted-foreground">{meta.tooltip.action}</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">→ {meta.description}</span>
                  {r.suffix && (
                    <span className="ml-auto font-mono text-muted-foreground">••••{r.suffix}</span>
                  )}
                </li>
              );
            })}
          </TooltipProvider>
        </ul>
        {hasMissing && (
          <p className="mt-2 text-xs text-muted-foreground">
            <Database className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Adicione o valor abaixo no campo correspondente — ele será gravado em{' '}
            <code className="text-[10px]">integration_credentials</code> e usado tanto pela UI
            quanto pelo catálogo.
          </p>
        )}
        {!hasMissing && usesEnvFallback && (
          <p className="mt-2 text-xs text-muted-foreground">
            Salve novamente para migrar do ENV para o banco e habilitar rotação/auditoria.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
