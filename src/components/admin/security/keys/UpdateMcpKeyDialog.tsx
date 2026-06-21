/**
 * UpdateMcpKeyDialog
 *
 * Edita campos sensíveis de uma chave MCP existente (nome, descrição, escopos,
 * expiração) chamando a edge function `mcp-keys-update`.
 *
 * Step-up de autenticação:
 *  - Quando o usuário **escala** uma chave limitada para FULL (`*`), o backend
 *    exige `step_up_token` válido para a action `mcp_full_escalate`.
 *  - O fluxo aqui é: validar localmente (justificativa, frase, expiração) →
 *    abrir `StepUpAuthDialog` (senha + OTP) → enviar `step_up_token` ao backend.
 *  - Para edições que NÃO promovem a FULL, o step-up não é necessário e a
 *    chamada vai direta.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Pencil, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  KNOWN_SCOPES,
  FULL_SCOPE,
  FULL_SCOPE_CONFIRMATION,
  FULL_SCOPE_MIN_JUSTIFICATION,
  FULL_SCOPE_DEFAULT_TTL_DAYS,
  FULL_SCOPE_MAX_TTL_DAYS,
  isFullAccess,
  type McpScope,
} from '@/lib/mcp/scopes';
import { useCanGrantMcpFull } from './useCanGrantMcpFull';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { useDevChallenge } from '@/contexts/DevChallengeContext';
import { invokeFullScopeFunction } from '@/lib/auth/invoke-full-scope';
import { supabase } from '@/integrations/supabase/client';
import { handleStepUpError } from '@/lib/auth/step-up-error';
import type { McpKeyRow } from './useMcpKeys';

interface Props {
  source: McpKeyRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function UpdateMcpKeyDialog({ source, open, onOpenChange, onUpdated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scopes, setScopes] = useState<McpScope[]>([]);
  const [expiresLocal, setExpiresLocal] = useState('');
  const [justification, setJustification] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { canGrant: canGrantFull, loading: grantorLoading } = useCanGrantMcpFull();
  const { challenge } = useDevChallenge();

  // Hidrata estado quando o diálogo abre com nova fonte
  useEffect(() => {
    if (!open || !source) return;
    setName(source.name);
    setDescription(source.description ?? '');
    setScopes((source.scopes ?? []) as McpScope[]);
    setExpiresLocal(isoToLocalInput(source.expires_at));
    setJustification('');
    setConfirmation('');
    setSubmitting(false);
  }, [open, source]);

  const wasFull = useMemo(() => (source ? source.is_full : false), [source]);
  const willBeFull = isFullAccess(scopes);
  const escalating = !wasFull && willBeFull;

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
    if (!source) return null;
    if (name.trim().length < 3) return 'Nome precisa ter ao menos 3 caracteres.';
    if (scopes.length === 0) return 'Selecione ao menos um escopo.';
    if (escalating) {
      if (!expiresLocal) return 'Chaves FULL exigem data de expiração.';
      const exp = new Date(expiresLocal).getTime();
      if (Number.isNaN(exp) || exp <= Date.now()) return 'Expiração precisa ser no futuro.';
      const maxMs = FULL_SCOPE_MAX_TTL_DAYS * 24 * 60 * 60 * 1000;
      if (exp - Date.now() > maxMs) return `Janela máxima é ${FULL_SCOPE_MAX_TTL_DAYS} dias.`;
      if (justification.trim().length < FULL_SCOPE_MIN_JUSTIFICATION) {
        return `Justificativa precisa de ao menos ${FULL_SCOPE_MIN_JUSTIFICATION} caracteres.`;
      }
      if (confirmation !== FULL_SCOPE_CONFIRMATION) {
        return `Digite "${FULL_SCOPE_CONFIRMATION}" para confirmar a escalada.`;
      }
    }
    return null;
  }, [source, name, scopes, escalating, expiresLocal, justification, confirmation]);

  /** Body comum enviado para mcp-keys-update. */
  const buildBody = (): Record<string, unknown> | null => {
    if (!source) return null;
    return {
      key_id: source.id,
      name: name.trim() !== source.name ? name.trim() : undefined,
      description:
        description.trim() !== (source.description ?? '') ? description.trim() || null : undefined,
      scopes,
      expires_at: expiresLocal ? new Date(expiresLocal).toISOString() : null,
      justification: escalating ? justification.trim() : null,
      confirmation_phrase: escalating ? confirmation : null,
    };
  };

  const handleSuccess = (data: { ok?: boolean; escalated_to_full?: boolean }) => {
    toast.success(
      data?.escalated_to_full ? 'Chave atualizada e escalada para FULL' : 'Chave atualizada',
    );
    onUpdated();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (validation) {
      toast.error(validation);
      return;
    }
    if (!source) return;
    const body = buildBody();
    if (!body) return;
    setSubmitting(true);
    try {
      if (escalating) {
        // Escalada → step-up obrigatório (mcp_full_escalate).
        const result = await invokeFullScopeFunction<
          Record<string, unknown>,
          { ok: boolean; escalated_to_full?: boolean }
        >({
          challenge,
          functionName: 'mcp-keys-update',
          action: 'mcp_full_escalate',
          actionLabel: `Escalar chave MCP "${source.name}" para FULL`,
          targetRef: source.id,
          body,
        });
        if (result.status === 'cancelled' || result.status === 'step_up_error') return;
        if (result.status === 'error') {
          toast.error('Falha ao atualizar chave', {
            description: sanitizeError(result.error ?? result.data),
          });
          return;
        }
        handleSuccess(result.data);
      } else {
        // Edição comum: chamada direta (sem step-up).
        const { data, error } = await supabase.functions.invoke('mcp-keys-update', {
          body: { ...body, step_up_token: null },
        });
        if (
          handleStepUpError(data, error, () => {
            void handleSubmit();
          })
        )
          return;
        if (error) {
          toast.error('Falha ao atualizar chave', { description: sanitizeError(error) });
          return;
        }
        if (!data?.ok) {
          toast.error('Não foi possível atualizar a chave', { description: sanitizeError(data) });
          return;
        }
        handleSuccess(data);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!source) return null;

  const fullLockedForUser = !grantorLoading && !canGrantFull && escalating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Editar chave MCP
          </DialogTitle>
          <DialogDescription>
            <code className="font-mono text-xs">{source.key_prefix}…</code> · alterações ficam
            registradas no audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="upd-mcp-name">Nome</Label>
            <Input
              id="upd-mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="upd-mcp-desc">Descrição</Label>
            <Textarea
              id="upd-mcp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Opcional — contexto interno da chave."
            />
          </div>

          <div>
            <Label className="mb-2 block">Escopos</Label>
            <div className="flex flex-wrap gap-2">
              {KNOWN_SCOPES.map((s) => {
                const active = scopes.includes(s);
                const isFull = s === FULL_SCOPE;
                const lock = isFull && !canGrantFull && !grantorLoading && !active;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleScopeToggle(s)}
                    disabled={lock}
                    className={[
                      'rounded border px-2 py-1 font-mono text-xs transition',
                      lock
                        ? 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60'
                        : active
                          ? isFull
                            ? 'border-destructive bg-destructive text-destructive-foreground'
                            : 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:border-primary/40',
                    ].join(' ')}
                  >
                    {s}
                    {lock && ' 🔒'}
                  </button>
                );
              })}
            </div>
            {fullLockedForUser && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                🔒 Você não pode escalar esta chave para <code className="font-mono">*</code>{' '}
                (FULL).
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="upd-mcp-expires">
              Expira em {willBeFull && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="upd-mcp-expires"
              type="datetime-local"
              value={expiresLocal}
              onChange={(e) => setExpiresLocal(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {willBeFull
                ? `Obrigatório para chave FULL. Máx ${FULL_SCOPE_MAX_TTL_DAYS} dias.`
                : 'Em branco = sem expiração.'}
            </p>
          </div>

          {escalating && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                Escalando para acesso total <Badge variant="destructive">*</Badge>
              </AlertTitle>
              <AlertDescription>
                Esta alteração concede <strong>acesso total</strong> ao MCP. Exige justificativa,
                confirmação e <strong>verificação dupla</strong> (senha + código por e-mail) antes
                de ser aplicada.
              </AlertDescription>
            </Alert>
          )}

          {escalating && (
            <>
              <div>
                <Label htmlFor="upd-mcp-just">
                  Justificativa <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="upd-mcp-just"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Por que esta chave precisa virar FULL agora?"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {justification.length}/{FULL_SCOPE_MIN_JUSTIFICATION} mínimo — registrada no audit
                  log.
                </p>
              </div>
              <div>
                <Label htmlFor="upd-mcp-confirm">
                  Confirmação <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="upd-mcp-confirm"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={`Digite "${FULL_SCOPE_CONFIRMATION}"`}
                  className="font-mono"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !!validation || fullLockedForUser}>
            {submitting
              ? 'Salvando…'
              : escalating
                ? 'Verificar e escalar para FULL'
                : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
