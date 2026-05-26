/**
 * IssueMcpKeyForm
 *
 * Formulário de emissão de chave MCP. Toda a geração ocorre server-side
 * via edge function `mcp-keys-issue` — este componente apenas coleta
 * input, valida no cliente para feedback imediato, e exibe a chave
 * retornada UMA única vez.
 *
 * Regras especiais quando o escopo "*" (FULL) está marcado:
 *  - Campo de expiração obrigatório (default 90 dias, máx 180 dias).
 *  - Justificativa obrigatória (mín. 20 caracteres).
 *  - Frase de confirmação "CONCEDER FULL" obrigatória.
 *  - Banner vermelho de aviso.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Copy, Key, ShieldAlert, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { invokeFullScopeFunction } from '@/lib/auth/invoke-full-scope';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  KNOWN_SCOPES,
  FULL_SCOPE,
  FULL_SCOPE_CONFIRMATION,
  FULL_SCOPE_MIN_JUSTIFICATION,
  FULL_SCOPE_DEFAULT_TTL_DAYS,
  FULL_SCOPE_MAX_TTL_DAYS,
  SCOPE_DESCRIPTIONS,
  isFullAccess,
  type McpScope,
} from '@/lib/mcp/scopes';
import { useCanGrantMcpFull } from '@/components/admin/security/keys/useCanGrantMcpFull';
import { useDevChallenge } from '@/contexts/DevChallengeContext';
import { sanitizeError } from '@/lib/security/sanitize-error';

interface Props {
  onIssued: () => void;
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // datetime-local input format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function IssueMcpKeyForm({ onIssued }: Props) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<McpScope[]>(['quotes:read']);
  const [expiresLocal, setExpiresLocal] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [targetRepo, setTargetRepo] = useState('');
  const [targetTool, setTargetTool] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [confirmRootOpen, setConfirmRootOpen] = useState(false);
  const [rootNameEcho, setRootNameEcho] = useState('');

  const full = isFullAccess(scopes);
  const { canGrant: canGrantFull, loading: grantorLoading } = useCanGrantMcpFull();
  const { challenge } = useDevChallenge();

  // Auto-popula expires com default de 90 dias quando FULL é marcado.
  const handleScopeToggle = (s: McpScope) => {
    setScopes((cur) => {
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      const becameFull = !isFullAccess(cur) && next.includes(FULL_SCOPE);
      if (becameFull && !expiresLocal) {
        setExpiresLocal(isoDaysFromNow(FULL_SCOPE_DEFAULT_TTL_DAYS));
      }
      return next;
    });
  };

  const validation = useMemo(() => {
    if (name.trim().length < 3) return 'Informe um nome (mín. 3 caracteres).';
    if (scopes.length === 0) return 'Selecione ao menos um escopo.';
    if (full) {
      if (!expiresLocal) return 'Defina uma data de expiração.';
      const exp = new Date(expiresLocal).getTime();
      if (Number.isNaN(exp) || exp <= Date.now()) return 'Expiração precisa ser no futuro.';
      const maxMs = FULL_SCOPE_MAX_TTL_DAYS * 24 * 60 * 60 * 1000;
      if (exp - Date.now() > maxMs) return `Janela máxima é ${FULL_SCOPE_MAX_TTL_DAYS} dias.`;
      if (justification.trim().length < FULL_SCOPE_MIN_JUSTIFICATION)
        return `Justificativa precisa de ao menos ${FULL_SCOPE_MIN_JUSTIFICATION} caracteres.`;
      if (confirmation !== FULL_SCOPE_CONFIRMATION)
        return `Digite "${FULL_SCOPE_CONFIRMATION}" para confirmar.`;
    }
    return null;
  }, [name, scopes, full, expiresLocal, justification, confirmation]);

  const submitWithChallenge = async (action: 'mcp_full_issue' | 'mcp_key_rotate') => {
    setSubmitting(true);
    try {
      const result = await invokeFullScopeFunction<
        Record<string, unknown>,
        { ok: boolean; key?: string }
      >({
        challenge,
        functionName: 'mcp-keys-issue',
        action,
        actionLabel: full ? `Emitir chave MCP FULL "${name}"` : `Emitir chave MCP "${name}"`,
        targetRef: null, // chave ainda não existe
        body: {
          name: name.trim(),
          scopes,
          expires_at: expiresLocal ? new Date(expiresLocal).toISOString() : null,
          justification: justification.trim() || null,
          confirmation_phrase: full ? confirmation : null,
          target_repo: targetRepo.trim() || null,
          target_tool: targetTool.trim() || null,
        },
      });

      if (result.status === 'cancelled' || result.status === 'step_up_error') return;
      if (result.status === 'error') {
        toast.error('Falha ao emitir chave', {
          description: sanitizeError(result.error ?? result.data),
        });
        return;
      }
      if (!result.data.key) {
        toast.error('Não foi possível emitir a chave', {
          description: sanitizeError(result.data),
        });
        return;
      }
      setGenerated(result.data.key);
      setConfirmRootOpen(false);
      toast.success('Chave emitida com sucesso');
      onIssued();
    } finally {
      setSubmitting(false);
    }
  };

  const requestSubmit = async () => {
    if (validation) {
      toast.error(validation);
      return;
    }
    if (full) {
      // Gate extra para acesso root: confirmação por nome → modal step-up dedicado.
      setRootNameEcho('');
      setConfirmRootOpen(true);
      return;
    }
    // Chaves limitadas: step-up server-side com action: mcp_key_rotate.
    await submitWithChallenge('mcp_key_rotate');
  };

  const handleRootConfirmed = async () => {
    // Após confirmar nome (gate visual), dispara verificação dupla via helper.
    setConfirmRootOpen(false);
    await submitWithChallenge('mcp_full_issue');
  };

  const rootNameMatches = rootNameEcho.trim() === name.trim() && name.trim().length >= 3;

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success('Copiado!');
  };

  if (generated) {
    return (
      <div className="space-y-3">
        <Alert>
          <Key className="h-4 w-4" />
          <AlertTitle>Chave emitida</AlertTitle>
          <AlertDescription>
            Copie agora — esta é a única vez que ela será exibida em texto puro. Apenas o hash fica
            armazenado no banco.
          </AlertDescription>
        </Alert>
        <div className="break-all rounded-md bg-muted p-3 font-mono text-xs">{generated}</div>
        <Button onClick={() => copy(generated)} className="w-full">
          <Copy className="mr-1 h-4 w-4" /> Copiar chave
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="mcp-key-name">Nome</Label>
        <Input
          id="mcp-key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Claude Desktop — Pedro"
          maxLength={100}
        />
      </div>

      <div>
        <Label className="mb-2 block">Escopos</Label>
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-2">
            {KNOWN_SCOPES.map((s) => {
              const active = scopes.includes(s);
              const desc = SCOPE_DESCRIPTIONS[s];
              const isFull = s === FULL_SCOPE;
              return (
                <Tooltip key={s}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleScopeToggle(s)}
                      disabled={isFull && !canGrantFull && !grantorLoading}
                      className={[
                        'rounded border px-2 py-1 font-mono text-xs transition',
                        isFull && !canGrantFull && !grantorLoading
                          ? 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60'
                          : active
                            ? isFull
                              ? 'border-destructive bg-destructive text-destructive-foreground'
                              : 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:border-primary/40',
                      ].join(' ')}
                    >
                      {s}
                      {isFull && !canGrantFull && !grantorLoading && ' 🔒'}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold">{desc.label}</p>
                      <p className="text-muted-foreground">Tools habilitadas:</p>
                      <ul className="space-y-0.5">
                        {desc.tools.map((t) => (
                          <li key={t} className="font-mono">
                            • {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
        {!grantorLoading && !canGrantFull && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            🔒 Você não está autorizado a conceder o escopo <code className="font-mono">*</code>{' '}
            (FULL). Solicite a um admin já listado em{' '}
            <code className="font-mono">mcp_full_grantors</code> para te incluir.
          </p>
        )}
      </div>

      {full && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Acesso total (FULL) <Badge variant="destructive">*</Badge>
          </AlertTitle>
          <AlertDescription>
            Esta chave poderá <strong>ler e escrever</strong> em código-fonte, CRM, orçamentos e
            catálogo. Exige expiração, justificativa e confirmação explícita.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="mcp-key-expires">
          Expira em {full && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id="mcp-key-expires"
          type="datetime-local"
          value={expiresLocal}
          onChange={(e) => setExpiresLocal(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {full
            ? `Obrigatório para chave FULL. Default: ${FULL_SCOPE_DEFAULT_TTL_DAYS} dias. Máximo: ${FULL_SCOPE_MAX_TTL_DAYS} dias.`
            : 'Opcional para chaves restritas — em branco = sem expiração.'}
        </p>
      </div>

      {full && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="mcp-key-target-repo">Repo / sistema alvo</Label>
              <Input
                id="mcp-key-target-repo"
                value={targetRepo}
                onChange={(e) => setTargetRepo(e.target.value)}
                placeholder="ex: org/promo-gifts ou n8n-prod"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="mcp-key-target-tool">Ferramenta consumidora</Label>
              <Input
                id="mcp-key-target-tool"
                value={targetTool}
                onChange={(e) => setTargetTool(e.target.value)}
                placeholder="ex: Claude Desktop, Cursor, n8n"
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="mcp-key-just">
              Justificativa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="mcp-key-just"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Acesso temporário para refatoração do módulo de orçamentos pelo agente IA."
              rows={3}
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {justification.length}/{FULL_SCOPE_MIN_JUSTIFICATION} mínimo — registrado no audit
              log.
            </p>
          </div>

          <div>
            <Label htmlFor="mcp-key-confirm">
              Confirmação <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mcp-key-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={`Digite "${FULL_SCOPE_CONFIRMATION}"`}
              className="font-mono"
            />
          </div>
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={requestSubmit} disabled={submitting || !!validation}>
          <Key className="mr-1 h-4 w-4" />
          {submitting ? 'Emitindo…' : full ? 'Revisar e emitir FULL' : 'Gerar chave'}
        </Button>
      </div>

      <AlertDialog open={confirmRootOpen} onOpenChange={setConfirmRootOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Você está prestes a emitir uma chave de acesso ROOT
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  O escopo <code className="rounded bg-muted px-1 font-mono">*</code> concede acesso{' '}
                  <strong>total</strong> a este sistema, equivalente ao papel de{' '}
                  <strong>superusuário</strong>:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Ler e escrever em qualquer tabela (CRM, orçamentos, catálogo, usuários)</li>
                  <li>Disparar funções administrativas e jobs internos</li>
                  <li>Modificar configurações de segurança e integrações</li>
                  <li>Agir em nome de qualquer usuário autenticado</li>
                </ul>
                <p className="text-foreground">
                  Esta chave aparecerá em <strong>todos os logs de auditoria</strong> com seu nome
                  como emissor. Você é <strong>responsável</strong> por seu uso e armazenamento
                  seguro.
                </p>
                <div className="pt-2">
                  <Label htmlFor="mcp-key-root-echo" className="text-foreground">
                    Para confirmar, digite o nome exato da chave:{' '}
                    <code className="rounded bg-muted px-1 font-mono">{name.trim()}</code>
                  </Label>
                  <Input
                    id="mcp-key-root-echo"
                    value={rootNameEcho}
                    onChange={(e) => setRootNameEcho(e.target.value)}
                    placeholder={name.trim()}
                    className="mt-2 font-mono"
                    autoComplete="off"
                    autoFocus
                    maxLength={100}
                  />
                  {rootNameEcho.length > 0 && !rootNameMatches && (
                    <p className="mt-1 text-xs text-destructive">O nome digitado não confere.</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!rootNameMatches || submitting}
              onClick={(e) => {
                e.preventDefault();
                if (rootNameMatches) handleRootConfirmed();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Avançar para verificação dupla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
