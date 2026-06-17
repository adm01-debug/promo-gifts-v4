/**
 * RlsIntegrationTestsDialog — Dispara a edge function `rls-integration-tests`
 * que valida policies RLS executando SELECT/INSERT/UPDATE/DELETE como vendedor
 * (próprios e alheios) e como admin (invocador), exibindo a matriz de resultados.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, PlayCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { toErrorMessage } from '@/lib/to-error-message';

type Op = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
interface CaseResult {
  table: string;
  actor: 'seller' | 'admin';
  op: Op;
  scope: 'own' | 'other';
  expected: 'allow' | 'deny';
  observed: 'allow' | 'deny';
  pass: boolean;
  detail?: string;
}
interface TestResponse {
  ok: boolean;
  summary: { total: number; passed: number; failed: number };
  scenarios: string[];
  results: CaseResult[];
  generatedAt: string;
  error?: string;
  message?: string;
}

export function RlsIntegrationTestsDialog() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState<TestResponse | null>(null);

  async function run() {
    setRunning(true);
    setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke<TestResponse>(
        'rls-integration-tests',
        {
          body: {},
        },
      );
      if (error) throw new Error(error.message);
      if (!res) throw new Error('sem resposta');
      setData(res);
      if (res.ok) toast.success(`RLS ✓ ${res.summary.passed}/${res.summary.total} casos`);
      else toast.warning(`RLS ${res.summary.failed} falha(s) em ${res.summary.total} casos`);
    } catch (e) {
      toast.error(`Falha ao rodar testes: ${toErrorMessage(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ShieldCheck className="h-4 w-4" /> Testar RLS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Testes de integração RLS
          </DialogTitle>
          <DialogDescription>
            Cria 2 usuários temporários e executa SELECT/INSERT/UPDATE/DELETE em registros próprios
            e alheios como vendedor, e SELECT como admin. Limpeza automática ao final.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Button onClick={run} disabled={running} className="gap-2">
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {running ? 'Executando...' : 'Rodar testes'}
          </Button>
          {data && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={data.ok ? 'default' : 'destructive'}>
                {data.ok ? 'Todos passaram' : `${data.summary.failed} falha(s)`}
              </Badge>
              <span className="text-muted-foreground">
                {data.summary.passed}/{data.summary.total} casos · tabelas:{' '}
                {data.scenarios.join(', ')}
              </span>
            </div>
          )}
        </div>

        {data && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Observado</TableHead>
                  <TableHead className="w-[60px]">OK</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((r, i) => (
                  <TableRow key={i} className={r.pass ? '' : 'bg-destructive/5'}>
                    <TableCell className="font-mono text-xs">{r.table}</TableCell>
                    <TableCell>
                      <Badge variant={r.actor === 'admin' ? 'secondary' : 'outline'}>
                        {r.actor}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.op}</TableCell>
                    <TableCell>
                      <Badge variant={r.scope === 'own' ? 'default' : 'outline'}>{r.scope}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.expected}</TableCell>
                    <TableCell className="font-mono text-xs">{r.observed}</TableCell>
                    <TableCell>
                      {r.pass ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[280px] truncate text-xs text-muted-foreground"
                      title={r.detail}
                    >
                      {r.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
