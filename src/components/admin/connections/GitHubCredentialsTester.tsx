import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CheckResult {
  ok: boolean;
  message: string;
  detail?: string;
}

interface Report {
  ok: boolean;
  checks: {
    GITHUB_TOKEN: CheckResult;
    GITHUB_REPO: CheckResult;
    GITHUB_DEFAULT_BRANCH: CheckResult;
  };
  user?: { login: string; scopes: string[] } | null;
  repo?: { full_name: string; default_branch: string; private: boolean } | null;
  latency_ms: number;
  tested_at: string;
}

const LABELS: Record<keyof Report['checks'], string> = {
  GITHUB_TOKEN: 'Token',
  GITHUB_REPO: 'Repositório',
  GITHUB_DEFAULT_BRANCH: 'Branch',
};

/**
 * Botão + relatório que valida as três credenciais do GitHub
 * (`GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_DEFAULT_BRANCH`) chamando a
 * edge function `github-credentials-test`. Mostra um badge por chave
 * com o resultado do último teste — vazio enquanto não testar.
 */
export function GitHubCredentialsTester() {
  const [report, setReport] = useState<Report | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-credentials-test', {
        body: {},
      });
      if (error) throw error;
      const r = (data as { report?: Report }).report;
      if (!r) throw new Error('Resposta inválida do servidor');
      setReport(r);
      if (r.ok) {
        toast.success('Credenciais do GitHub OK', {
          description: `Token + repo + branch validados em ${r.latency_ms}ms.`,
        });
      } else {
        const failed = (Object.entries(r.checks) as Array<[keyof Report['checks'], CheckResult]>)
          .filter(([, c]) => !c.ok)
          .map(([k]) => LABELS[k])
          .join(', ');
        toast.error('Falha na validação', {
          description: `Problema em: ${failed}. Veja detalhes nos badges abaixo.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao testar credenciais', { description: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Validação ao vivo</p>
        </div>
        <Button size="sm" onClick={runTest} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Testando…
            </>
          ) : (
            'Testar credenciais do GitHub'
          )}
        </Button>
      </div>

      {report && (
        <div className="space-y-2">
          <TooltipProvider delayDuration={150}>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(report.checks) as Array<[keyof Report['checks'], CheckResult]>).map(
                ([key, check]) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          'cursor-help gap-1',
                          check.ok
                            ? 'border-success/40 bg-success/10 text-success'
                            : 'border-destructive/40 bg-destructive/10 text-destructive',
                        )}
                      >
                        {check.ok ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        <span className="font-mono text-[10px]">{LABELS[key]}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm space-y-1 text-xs">
                      <p className="font-semibold">{key}</p>
                      <p>{check.message}</p>
                      {check.detail && (
                        <p className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                          {check.detail}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ),
              )}
            </div>
          </TooltipProvider>

          {report.ok ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              {report.user && (
                <p>
                  Usuário: <span className="font-mono">{report.user.login}</span>
                  {report.user.scopes.length > 0 && (
                    <>
                      {' '}
                      — escopos: <span className="font-mono">{report.user.scopes.join(', ')}</span>
                    </>
                  )}
                </p>
              )}
              {report.repo && (
                <p>
                  Repo: <span className="font-mono">{report.repo.full_name}</span> (
                  {report.repo.private ? 'privado' : 'público'}, default branch{' '}
                  <span className="font-mono">{report.repo.default_branch}</span>)
                </p>
              )}
              <p>Latência: {report.latency_ms}ms</p>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <p>
                Uma ou mais credenciais falharam. Ajuste os campos acima e teste novamente. Os
                badges em vermelho mostram exatamente qual chave está com problema.
              </p>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Testado em {new Date(report.tested_at).toLocaleString('pt-BR')}
          </p>
        </div>
      )}

      {!report && (
        <p className="text-xs text-muted-foreground">
          Clique para validar token, repo e branch contra a API do GitHub. O resultado aparece em
          badges por chave (verde = OK, vermelho = falha).
        </p>
      )}
    </div>
  );
}
