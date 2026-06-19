import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plug, Copy, Trash2, Plus, Github, ShieldAlert } from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConnectionTestHistoryPanel } from './ConnectionTestHistoryPanel';
import { SecretField } from './SecretField';
import { useSecretsManager } from '@/hooks/admin';
import { GitHubCredentialsTester } from './GitHubCredentialsTester';
import { IssueMcpKeyForm } from './IssueMcpKeyForm';
import { isFullAccess } from '@/lib/mcp/scopes';
import { useDevChallenge } from '@/contexts/DevChallengeContext';
import { sanitizeError } from '@/lib/security/sanitize-error';

interface McpKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp-server`;

function formatExpiresIn(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expirada';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return 'expira hoje';
  if (days === 1) return 'expira em 1d';
  return `expira em ${days}d`;
}

export function McpTab() {
  const { secrets, list } = useSecretsManager();
  const { challenge } = useDevChallenge();
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const getSecret = (n: string) => secrets.find((s) => s.name === n);

  useEffect(() => {
    list();
  }, [list]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mcp_api_keys')
      .select('*')
      .order('created_at', { ascending: false });
    if (error)
      toast.error('Erro ao carregar chaves', {
        description: 'Não foi possível carregar as chaves MCP.',
      });
    else setKeys(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id: string) => {
    // Step-up obrigatório: senha + OTP recentes antes de revogar.
    const token = await challenge({
      action: 'mcp_key_revoke',
      actionLabel: 'Revogar chave MCP',
      targetRef: id,
    });
    if (!token) return; // cancelado pelo usuário

    const { data, error } = await supabase.functions.invoke('mcp-keys-revoke', {
      body: { key_id: id, step_up_token: token },
    });
    if (error || (data && (data as { error?: string }).error)) {
      toast.error('Erro ao revogar', { description: sanitizeError(error ?? data) });
    } else {
      toast.success('Chave revogada');
      load();
    }
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success('Copiado!');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            <CardTitle>Servidor MCP</CardTitle>
          </div>
          <CardDescription>
            Endpoint público compatível com o Model Context Protocol (Claude Desktop, outros
            projetos Lovable).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Endpoint</Label>
            <div className="mt-1 flex gap-2">
              <Input value={MCP_URL} readOnly className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={() => copy(MCP_URL)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Autentique enviando o header <code className="rounded bg-muted px-1">X-MCP-Key</code>{' '}
              com sua chave.
            </p>
          </div>
          <ConnectionTestHistoryPanel type="mcp" label="Servidor MCP" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5 text-primary" />
            <CardTitle>GitHub — código-fonte do app</CardTitle>
          </div>
          <CardDescription>
            Credenciais usadas pelas tools de código do MCP server (
            <code className="rounded bg-muted px-1 text-xs">list_repo_files</code>,{' '}
            <code className="rounded bg-muted px-1 text-xs">read_repo_file</code>,{' '}
            <code className="rounded bg-muted px-1 text-xs">write_repo_file</code>). Necessárias
            quando uma chave com escopo <code className="rounded bg-muted px-1 text-xs">*</code>{' '}
            (full access) precisa editar o repositório.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-2xl space-y-4">
          <SecretField
            label="Personal Access Token"
            secretName="GITHUB_TOKEN"
            status={getSecret('GITHUB_TOKEN')}
            onSaved={list}
            connectionId="mcp"
            helperText="Fine-grained PAT com permissões: Contents (read & write), Metadata (read). Gere em github.com/settings/tokens?type=beta"
          />
          <SecretField
            label="Repositório (owner/repo)"
            secretName="GITHUB_REPO"
            status={getSecret('GITHUB_REPO')}
            onSaved={list}
            connectionId="mcp"
            helperText="Ex: minha-org/promo-gifts"
          />
          <SecretField
            label="Branch padrão para escrita"
            secretName="GITHUB_DEFAULT_BRANCH"
            status={getSecret('GITHUB_DEFAULT_BRANCH')}
            onSaved={list}
            connectionId="mcp"
            helperText="Recomendado: mcp-edits/main (evita commits diretos em main). Aceita qualquer branch existente."
          />
          <GitHubCredentialsTester />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Chaves emitidas</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Nova chave
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Gerar nova chave MCP</DialogTitle>
                  <DialogDescription>
                    A chave será exibida apenas uma vez. Geração e validação ocorrem 100% no
                    servidor — apenas administradores podem emitir, e escopo{' '}
                    <code className="font-mono">*</code> exige expiração + justificativa +
                    confirmação.
                  </DialogDescription>
                </DialogHeader>
                <IssueMcpKeyForm
                  onIssued={() => {
                    load();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma chave emitida.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => {
                const full = isFullAccess(k.scopes);
                const expiresLabel = formatExpiresIn(k.expires_at);
                const expired = expiresLabel === 'expirada';
                return (
                  <div
                    key={k.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{k.name}</span>
                        <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                        {full && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <ShieldAlert className="h-3 w-3" /> FULL
                          </Badge>
                        )}
                        {k.revoked_at && (
                          <Badge variant="destructive" className="text-xs">
                            Revogada
                          </Badge>
                        )}
                        {expiresLabel && !k.revoked_at && (
                          <Badge variant={expired ? 'destructive' : 'outline'} className="text-xs">
                            {expiresLabel}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge
                            key={s}
                            variant={s === '*' ? 'destructive' : 'secondary'}
                            className="font-mono text-xs"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {!k.revoked_at && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke(k.id)}
                        aria-label="Revogar chave"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
