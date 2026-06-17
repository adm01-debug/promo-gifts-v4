import { useState } from 'react';
import { Shield, CheckCircle, XCircle, Activity, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { cn } from '@/lib/utils';

interface AuditResult {
  name: string;
  passed: boolean;
  details: string;
  logs: string[];
}

export function AuditReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    status?: string;
    timestamp?: string;
    results?: AuditResult[];
  } | null>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-suite');
      if (error) throw error;
      setReport(data);
      toast.success('Auditoria concluída com sucesso');
    } catch (err: unknown) {
      toast.error('Falha ao executar auditoria', { description: sanitizeError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="rounded-xl bg-primary p-3 text-primary-foreground shadow-lg">
            <Shield className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl font-black">Auditoria Técnica Automática</CardTitle>
            <CardDescription>Validação de Concorrência, RLS e Limites de Negócio</CardDescription>
          </div>
          <Button
            onClick={runAudit}
            disabled={loading}
            className="rounded-full px-8 font-bold shadow-md transition-all hover:shadow-lg"
          >
            {loading ? (
              <>
                <Activity className="mr-2 h-4 w-4 animate-spin" />
                Auditando...
              </>
            ) : (
              'Iniciar Simulações'
            )}
          </Button>
        </CardHeader>
      </Card>

      {report && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription>Status Geral</CardDescription>
              <CardTitle className={report.status === 'PASSED' ? 'text-green-500' : 'text-red-500'}>
                {report.status}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription>Data do Teste</CardDescription>
              <CardTitle className="text-sm">
                {report.timestamp ? new Date(report.timestamp).toLocaleString('pt-BR') : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardDescription>Ambiente</CardDescription>
              <CardTitle className="text-sm">Produção / Edge</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {report?.results?.map((test: AuditResult, idx: number) => (
        <Card
          key={idx}
          className="overflow-hidden border-border/40 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className={cn('h-1.5 w-full', test.passed ? 'bg-green-500' : 'bg-red-500')} />
          <CardHeader className="flex flex-row items-center gap-3 py-4">
            {test.passed ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-500" />
            )}
            <div className="flex-1">
              <CardTitle className="text-lg">{test.name}</CardTitle>
              <CardDescription>{test.details}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] rounded-md border bg-muted/30 p-4">
              <div className="space-y-1 font-mono text-[11px] leading-relaxed">
                {test.logs.map((log, lIdx) => (
                  <div key={lIdx} className="border-b border-border/50 pb-1 opacity-70">
                    <span className="mr-2 text-primary">[{lIdx + 1}]</span>
                    {log}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <Database className="mb-4 h-20 w-20" />
          <p className="font-medium">Nenhum relatório gerado ainda.</p>
        </div>
      )}
    </div>
  );
}
