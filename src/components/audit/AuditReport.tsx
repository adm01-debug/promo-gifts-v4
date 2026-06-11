import React, { useState } from 'react';
import { Shield, CheckCircle, XCircle, Activity, Lock, Users, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuditResult {
  name: string;
  passed: boolean;
  details: string;
  logs: string[];
}

export function AuditReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-suite');
      if (error) throw error;
      setReport(data);
      toast.success('Auditoria concluída com sucesso');
    } catch (err: any) {
      toast.error('Falha na auditoria: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-3 bg-primary rounded-xl text-primary-foreground shadow-lg">
            <Shield className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl font-black">Auditoria Técnica Automática</CardTitle>
            <CardDescription>Validação de Concorrência, RLS e Limites de Negócio</CardDescription>
          </div>
          <Button 
            onClick={runAudit} 
            disabled={loading}
            className="rounded-full px-8 font-bold shadow-md hover:shadow-lg transition-all"
          >
            {loading ? (
              <>
                <Activity className="mr-2 h-4 w-4 animate-spin" />
                Auditando...
              </>
            ) : 'Iniciar Simulações'}
          </Button>
        </CardHeader>
      </Card>

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                {new Date(report.timestamp).toLocaleString('pt-BR')}
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

      {report?.results.map((test: AuditResult, idx: number) => (
        <Card key={idx} className="overflow-hidden border-border/40 shadow-sm hover:shadow-md transition-shadow">
          <div className={`h-1.5 w-full ${test.passed ? 'bg-green-500' : 'bg-red-500'}`} />
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
                    <span className="text-primary mr-2">[{lIdx + 1}]</span>
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
          <Database className="h-20 w-20 mb-4" />
          <p className="font-medium">Nenhum relatório gerado ainda.</p>
        </div>
      )}
    </div>
  );
}
