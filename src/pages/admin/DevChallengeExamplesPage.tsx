/**
 * DevChallengeExamplesPage — Documentação interativa do challenge reutilizável.
 *
 * Demonstra os 3 padrões de uso do `useDevChallenge` + `invokeFullScopeFunction`
 * para liberar operações sensíveis (full scope) sobre chaves MCP:
 *
 *   1. Issue   → emite chave nova (sem targetRef)
 *   2. Rotate  → rotaciona chave existente (targetRef = key.id)
 *   3. Update  → escala escopo de chave existente (targetRef = key.id)
 *
 * Cada card mostra:
 *   - Snippet de código copiável
 *   - Botão "Executar exemplo" que dispara o challenge real (modal MFA)
 *   - Resultado da chamada (status do helper)
 *
 * NOTA: os botões usam payloads de exemplo (ex.: targetRef inválido). A edge
 * function vai rejeitar a chamada — o foco aqui é demonstrar o fluxo de UI
 * (modal de step-up, supersede, retry on invalid, toast com CTA).
 */
import { useState } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Copy, Check, Play, KeyRound, RefreshCw, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useDevChallenge } from '@/contexts/DevChallengeContext';
import { invokeFullScopeFunction, type InvokeFullScopeResult } from '@/lib/auth/invoke-full-scope';
import type { StepUpAction } from '@/hooks/auth';

type ExampleId = 'issue' | 'rotate' | 'update';

interface ExampleConfig {
  id: ExampleId;
  title: string;
  description: string;
  icon: typeof KeyRound;
  badge: string;
  functionName: string;
  action: StepUpAction;
  actionLabel: string;
  targetRef: string | null;
  body: Record<string, unknown>;
  snippet: string;
}

const EXAMPLES: ExampleConfig[] = [
  {
    id: 'issue',
    title: 'Emitir chave FULL',
    description:
      'Emissão de chave MCP nova com escopo total. Sem targetRef — o token de step-up cobre apenas a ação.',
    icon: KeyRound,
    badge: 'mcp_full_issue',
    functionName: 'mcp-keys-issue',
    action: 'mcp_full_issue',
    actionLabel: 'Emitir chave MCP com escopo total',
    targetRef: null,
    body: {
      name: 'exemplo-demo-key',
      scope: 'full',
      justification: 'Demonstração interativa do challenge reutilizável',
      confirmation_phrase: 'EU CONFIRMO',
    },
    snippet: `import { useDevChallenge } from "@/contexts/DevChallengeContext";
import { invokeFullScopeFunction } from "@/lib/auth/invoke-full-scope";

const { challenge } = useDevChallenge();

const result = await invokeFullScopeFunction({
  challenge,
  functionName: "mcp-keys-issue",
  action: "mcp_full_issue",
  actionLabel: "Emitir chave MCP com escopo total",
  // targetRef omitido: chave ainda não existe
  body: {
    name,
    scope: "full",
    justification,
    confirmation_phrase,
  },
});

if (result.status === "ok") {
  toast.success(\`Chave criada: \${result.data.key_id}\`);
} else if (result.status === "cancelled") {
  return; // usuário fechou o modal ou foi superado
}`,
  },
  {
    id: 'rotate',
    title: 'Rotacionar chave',
    description:
      'Rotação de chave existente. targetRef = id da chave de origem; binding server-side garante que o token só vale para essa chave.',
    icon: RefreshCw,
    badge: 'mcp_key_rotate',
    functionName: 'mcp-keys-rotate',
    action: 'mcp_key_rotate',
    actionLabel: 'Rotacionar chave MCP "exemplo"',
    targetRef: '00000000-0000-0000-0000-000000000000',
    body: {
      source_key_id: '00000000-0000-0000-0000-000000000000',
      justification: 'Demonstração interativa do challenge reutilizável',
      confirmation_phrase: 'EU CONFIRMO',
    },
    snippet: `const result = await invokeFullScopeFunction({
  challenge,
  functionName: "mcp-keys-rotate",
  // Para chaves FULL use "mcp_full_issue"; para limited, "mcp_key_rotate".
  action: source.is_full ? "mcp_full_issue" : "mcp_key_rotate",
  actionLabel: \`Rotacionar chave MCP "\${source.name}"\`,
  targetRef: source.id, // BIND ao recurso
  body: {
    source_key_id: source.id,
    justification,
    confirmation_phrase,
  },
});`,
  },
  {
    id: 'update',
    title: 'Atualizar / escalar escopo',
    description:
      'Apenas a escalada para FULL exige step-up. Updates de metadados (nome, expires_at) podem usar fluxo normal.',
    icon: ShieldCheck,
    badge: 'mcp_full_escalate',
    functionName: 'mcp-keys-update',
    action: 'mcp_full_escalate',
    actionLabel: 'Escalar escopo de chave para FULL',
    targetRef: '00000000-0000-0000-0000-000000000000',
    body: {
      key_id: '00000000-0000-0000-0000-000000000000',
      scope: 'full',
      justification: 'Demonstração interativa do challenge reutilizável',
    },
    snippet: `// Só escala para FULL passa pelo challenge.
if (changes.scope === "full" && current.scope !== "full") {
  const result = await invokeFullScopeFunction({
    challenge,
    functionName: "mcp-keys-update",
    action: "mcp_full_escalate",
    actionLabel: "Escalar escopo de chave para FULL",
    targetRef: key.id,
    body: { key_id: key.id, ...changes },
  });
  if (result.status !== "ok") return;
}

// Updates triviais usam invoke direto, sem step-up.
await supabase.functions.invoke("mcp-keys-update", {
  body: { key_id: key.id, name: newName },
});`,
  },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Snippet copiado');
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleCopy}
        aria-label="Copiar snippet"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

const EXAMPLE_CARD_STATUS_COLORS = {
  ok: 'text-success',
  cancelled: 'text-muted-foreground',
  step_up_error: 'text-warning',
  error: 'text-destructive',
} as const;

interface ResultState {
  status: InvokeFullScopeResult<unknown>['status'];
  detail?: string;
}

function ExampleCard({ config }: { config: ExampleConfig }) {
  const { challenge } = useDevChallenge();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const Icon = config.icon;

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await invokeFullScopeFunction({
        challenge,
        functionName: config.functionName,
        action: config.action,
        actionLabel: config.actionLabel,
        targetRef: config.targetRef,
        body: config.body,
      });

      let detail: string | undefined;
      if (res.status === 'ok') {
        detail = 'Chamada bem-sucedida (improvável neste demo).';
      } else if (res.status === 'cancelled') {
        detail = 'Modal fechado ou solicitação superada.';
      } else if (res.status === 'step_up_error') {
        detail = `Backend rejeitou step-up: ${res.kind}`;
      } else {
        const errMsg = (res.data as { error?: string } | null)?.error ?? 'erro de execução';
        detail = `Edge respondeu: ${errMsg} (esperado: targetRef fictício)`;
      }
      setResult({ status: res.status, detail });
    } catch (err) {
      setResult({
        status: 'error',
        detail: err instanceof Error ? err.message : 'erro inesperado',
      });
    } finally {
      setRunning(false);
    }
  };

  const statusColor = EXAMPLE_CARD_STATUS_COLORS;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{config.title}</CardTitle>
              <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                {config.badge}
              </Badge>
            </div>
          </div>
        </div>
        <CardDescription className="pt-2">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <CodeBlock code={config.snippet} />

        <div className="mt-auto flex items-center gap-2">
          <Button onClick={handleRun} disabled={running} size="sm" className="gap-2">
            <Play className="h-3.5 w-3.5" />
            {running ? 'Executando...' : 'Executar exemplo'}
          </Button>
          {result && (
            <span className={`text-xs font-medium ${statusColor[result.status]}`}>
              {result.status} — {result.detail}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DevChallengeExamplesPage() {
  return (
    <>
      <PageSEO
        title="Exemplos — Challenge Reutilizável"
        description="Documentação interativa do challenge reutilizável de dev para liberar operações full scope."
        path="/admin/seguranca/exemplos-challenge"
        noIndex
      />

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Challenge reutilizável — Exemplos</h1>
          </div>
          <p className="max-w-3xl text-muted-foreground">
            Demonstra o uso do hook{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">useDevChallenge</code>{' '}
            combinado ao helper{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">invokeFullScopeFunction</code>{' '}
            para liberar as 3 operações sensíveis sobre chaves MCP. Todo o fluxo MFA (senha + OTP +
            role <code>dev</code>) é validado server-side; o token é de uso único e vinculado a{' '}
            <em>action</em> + <em>targetRef</em>.
          </p>
        </header>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Demo seguro</AlertTitle>
          <AlertDescription>
            Os botões "Executar exemplo" disparam o challenge real (você verá o modal MFA), mas usam{' '}
            <code className="text-xs">targetRef</code> fictício. As edge functions vão rejeitar a
            chamada — isso é esperado. Use esta página para validar o fluxo de UI: modal, supersede,
            retry on <code className="text-xs">step_up_invalid</code>, toast com "Refazer
            verificação".
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="examples" className="w-full">
          <TabsList>
            <TabsTrigger value="examples">Exemplos interativos</TabsTrigger>
            <TabsTrigger value="anatomy">Anatomia do fluxo</TabsTrigger>
            <TabsTrigger value="patterns">Padrões e edge cases</TabsTrigger>
          </TabsList>

          <TabsContent value="examples" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {EXAMPLES.map((cfg) => (
                <ExampleCard key={cfg.id} config={cfg} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="anatomy" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Como funciona o ciclo</CardTitle>
                <CardDescription>
                  Sequência completa de uma operação full scope, do clique do usuário até o consumo
                  do token.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <ol className="list-inside list-decimal space-y-3 text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Caller chama</span>{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      invokeFullScopeFunction(...)
                    </code>{' '}
                    com <code className="text-xs">action</code>,{' '}
                    <code className="text-xs">actionLabel</code> e{' '}
                    <code className="text-xs">targetRef</code> opcional.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Helper invoca</span>{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">challenge(...)</code>:
                    abre <code className="text-xs">StepUpAuthDialog</code> via{' '}
                    <code className="text-xs">DevChallengeContext</code>.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Usuário autentica</span> com senha
                    + OTP. A edge <code className="text-xs">step-up-verify</code> valida tudo
                    server-side e re-checa role <code>dev</code>.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Token emitido</span> (uso único,
                    TTL curto, bound a <code className="text-xs">action</code> +{' '}
                    <code className="text-xs">targetRef</code> + <code>user_id</code>).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Helper injeta</span>{' '}
                    <code className="text-xs">step_up_token</code> no body e chama a edge function
                    de destino.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Edge final consome</span> o token
                    via RPC <code className="text-xs">consume_step_up_token</code> e executa a
                    operação.
                  </li>
                </ol>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Discriminated union de retorno</h4>
                  <CodeBlock
                    code={`type InvokeFullScopeResult<TData> =
    | { status: "ok"; data: TData }
    | { status: "cancelled" }                                  // modal fechado OU superado
    | { status: "step_up_error"; kind: "step_up_required" | "step_up_invalid" }
    | { status: "error"; error: unknown; data: unknown };`}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Concorrência: solicitações simultâneas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Apenas <strong className="text-foreground">um</strong> modal de challenge fica
                  aberto por vez. Se o usuário dispara duas operações em paralelo, a primeira é
                  resolvida com{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">cancelled</code>{' '}
                  (superseded) e somente a segunda pode produzir um token válido. Callers tratam{' '}
                  <code className="text-xs">cancelled</code> como abort silencioso.
                </p>
                <CodeBlock
                  code={`// Em DevChallengeContext: cada challenge() recebe requestId monotônico.
  // Se chega novo enquanto outro está pendente:
  //   1. Pendente anterior → resolve(null) → caller original aborta
  //   2. Modal remonta com key={requestId} (limpa senha/OTP digitados)
  //   3. Token verificado só é entregue se requestId bater com o atual`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Auto-retry em step_up_invalid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Token pode expirar entre o desafio e a chamada (TTL curto + latência de rede).
                  Quando o backend responde <code className="text-xs">step_up_invalid</code>, o
                  helper refaz o challenge automaticamente{' '}
                  <strong className="text-foreground">uma vez</strong> antes de desistir. Para
                  desabilitar, passe <code className="text-xs">autoRetryOnInvalid: false</code>.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quando NÃO usar o helper</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ul className="list-inside list-disc space-y-1.5">
                  <li>
                    Operações que não exigem role <code>dev</code> ou full scope (use invoke
                    direto).
                  </li>
                  <li>
                    Updates triviais de metadados (nome, descrição) — só escalada de escopo passa
                    pelo challenge.
                  </li>
                  <li>
                    Fluxos batch onde múltiplas operações compartilham um único desafio: prefira
                    chamar <code className="text-xs">challenge()</code> uma vez e reutilizar o token
                    (atenção ao TTL).
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
