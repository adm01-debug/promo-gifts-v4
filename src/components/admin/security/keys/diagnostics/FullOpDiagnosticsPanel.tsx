/**
 * FullOpDiagnosticsPanel
 *
 * Tela de diagnóstico que dispara a edge function `full-op-diagnostics` e
 * exibe, para cada uma das 4 verificações server-side que governam
 * operações full sobre chaves MCP, se ela está PASSANDO, FALHANDO,
 * com erro ou foi pulada (quando o input opcional não foi fornecido).
 *
 * Verificações:
 *   1. is_dev(uid)                — papel `dev` ativo
 *   2. can_grant_mcp_full(uid)    — autorizado a emitir/atualizar grant `*`
 *   3. validate_mcp_key(plain)    — opcional: dada uma chave em claro,
 *      `block_reason` server-side (revogação, expiração, perda de dev do
 *      emissor, etc.)
 *   4. consume_step_up_token(...) — opcional: dado um token recém-emitido,
 *      ele seria aceito para a ação X / target Y? (introspecção que NÃO
 *      consome o token — preserva uso real subsequente)
 *
 * Importante: o endpoint é read-only. Não escreve auditoria, não consome
 * tokens, não revoga nada — feito justamente para diagnóstico sem efeito
 * colateral em produção.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  Stethoscope,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type CheckStatus = 'error' | 'fail' | 'pass' | 'skipped';

interface CheckResult {
  id: 'can_grant_mcp_full' | 'consume_step_up_token' | 'is_dev' | 'validate_mcp_key';
  label: string;
  status: CheckStatus;
  detail: string;
  data?: Record<string, unknown> | null;
  duration_ms: number;
}

interface DiagnosticsResponse {
  ok: boolean;
  user_id: string;
  checked_at: string;
  summary: { pass: number; fail: number; skipped: number; error: number };
  checks: CheckResult[];
}

const STATUS_META: Record<
  CheckStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
    badgeVariant: 'default' | 'destructive' | 'outline' | 'secondary';
  }
> = {
  pass: {
    label: 'PASSA',
    icon: CheckCircle2,
    className: 'text-emerald-600',
    badgeVariant: 'default',
  },
  fail: {
    label: 'FALHA',
    icon: XCircle,
    className: 'text-destructive',
    badgeVariant: 'destructive',
  },
  skipped: {
    label: 'PULADO',
    icon: MinusCircle,
    className: 'text-muted-foreground',
    badgeVariant: 'outline',
  },
  error: {
    label: 'ERRO',
    icon: AlertTriangle,
    className: 'text-amber-600',
    badgeVariant: 'secondary',
  },
};

export function FullOpDiagnosticsPanel() {
  const [keyPlain, setKeyPlain] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [token, setToken] = useState('');
  const [action, setAction] = useState('mcp_full_issue');
  const [targetRef, setTargetRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticsResponse | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = {};
      if (keyPlain.trim()) body.mcp_key_plain = keyPlain.trim();
      if (token.trim()) {
        body.step_up_token = token.trim();
        body.step_up_action = action.trim() || 'mcp_full_issue';
        if (targetRef.trim()) body.step_up_target_ref = targetRef.trim();
      }
      const { data, error } = await supabase.functions.invoke('full-op-diagnostics', { body });
      if (error) {
        toast.error('Falha ao executar diagnóstico', {
          description: 'Não foi possível conectar ao serviço.',
        });
        return;
      }
      setResult(data as DiagnosticsResponse);
    } catch {
      toast.error('Erro inesperado', { description: 'Não foi possível executar o diagnóstico.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Diagnóstico de operações full</CardTitle>
            <CardDescription>
              Executa as 4 verificações server-side que governam emissão, rotação, atualização e uso
              de chaves MCP escopo total. Este endpoint é <strong>read-only</strong>: não consome
              tokens, não revoga chaves e não registra auditoria.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="diag-key">Chave MCP em claro (opcional)</Label>
            <div className="relative">
              <Input
                id="diag-key"
                type={showKey ? 'text' : 'password'}
                placeholder="mcp_..."
                value={keyPlain}
                onChange={(e) => setKeyPlain(e.target.value)}
                autoComplete="off"
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Permite testar <code>validate_mcp_key</code> (block_reason, scopes, created_by).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diag-token">Token step-up (opcional)</Label>
            <Input
              id="diag-token"
              type="password"
              placeholder="step_up_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Inspeção via hash — <strong>não consome o token</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diag-action">Action esperada</Label>
            <Input
              id="diag-action"
              placeholder="mcp_full_issue"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="diag-target">Target ref (opcional)</Label>
            <Input
              id="diag-target"
              placeholder="key_id ou null"
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            <code>is_dev</code> e <code>can_grant_mcp_full</code> sempre rodam para o usuário
            autenticado atual.
          </p>
          <Button onClick={run} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Stethoscope className="mr-2 h-4 w-4" />
            )}
            Executar diagnóstico
          </Button>
        </div>

        {result && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                    {result.summary.pass} passa
                  </Badge>
                  <Badge variant="destructive">{result.summary.fail} falha</Badge>
                  <Badge variant="secondary">{result.summary.error} erro</Badge>
                  <Badge variant="outline">{result.summary.skipped} pulado</Badge>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  uid: {result.user_id} · {new Date(result.checked_at).toLocaleString('pt-BR')}
                </span>
              </div>

              {result.summary.fail > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Bloqueios server-side detectados</AlertTitle>
                  <AlertDescription>
                    Ao menos uma verificação falharia agora — qualquer tentativa de operação full
                    correspondente seria negada antes da execução.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                {result.checks.map((c) => {
                  const meta = STATUS_META[c.status];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 rounded-lg border bg-card p-3"
                    >
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.className}`} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-sm font-semibold">{c.label}</code>
                          <Badge variant={meta.badgeVariant} className="text-[10px]">
                            {meta.label}
                          </Badge>
                          {c.duration_ms > 0 && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {c.duration_ms}ms
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{c.detail}</p>
                        {c.data && Object.keys(c.data).length > 0 && (
                          <pre className="overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[11px]">
                            {JSON.stringify(c.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
