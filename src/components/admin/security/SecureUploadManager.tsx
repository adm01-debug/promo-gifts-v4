import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload,
  CheckCircle2,
  XCircle,
  History,
  Search,
  RefreshCw,
  Clock,
  ShieldAlert,
  FileSearch,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
interface FileScanLog {
  id: string;
  created_at: string;
  path: string;
  hash: string;
  bucket: string;
  status_code: number;
  scan_result?: { malicious?: number } | null;
}

export function SecureUploadManager() {
  const [logs, setLogs] = useState<FileScanLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('file_scan_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs((data ?? []) as unknown as FileScanLog[]);
    } catch (error) {
      logger.error('Error fetching logs:', error);
      toast.error('Erro ao carregar logs de auditoria');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'dev-test');

    try {
      const { error } = await supabase.functions.invoke('secure-upload', {
        body: formData,
      });

      if (error) {
        if (error.status === 403) {
          toast.error('Upload Bloqueado: Ameaça detectada ou falha na verificação!');
        } else {
          toast.error('Erro no upload');
        }
        return;
      }

      toast.success('Upload realizado com sucesso e verificado!');
      fetchLogs();
    } catch (error) {
      logger.error('Test upload error:', error);
      toast.error('Erro ao realizar upload de teste');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.hash.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Test Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
              <Upload className="h-5 w-5" />
              Teste de Upload Seguro
            </CardTitle>
            <CardDescription>
              Simule um upload para validar a lógica de verificação VirusTotal e auditoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-background/50 p-6 transition-colors hover:bg-background/80">
              <Upload className="mb-2 h-8 w-8 text-primary/50" />
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Arraste um arquivo ou clique para selecionar
              </p>
              <Input
                type="file"
                onChange={handleTestUpload}
                disabled={isUploading}
                className="hidden"
                id="dev-test-upload"
              />
              <Button asChild disabled={isUploading}>
                <label htmlFor="dev-test-upload" className="cursor-pointer">
                  {isUploading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FileSearch className="mr-2 h-4 w-4" />
                      Selecionar Arquivo
                    </>
                  )}
                </label>
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded bg-muted p-3 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="font-medium text-foreground">Aviso de Segurança:</p>
                <p>
                  Arquivos suspeitos serão automaticamente movidos para o bucket de{' '}
                  <strong>quarantine</strong> e o acesso público será bloqueado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Estado da Infraestrutura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b p-2">
                <span className="text-sm text-muted-foreground">
                  Bucket: personalization-images
                </span>
                <Badge variant="outline">Privado</Badge>
              </div>
              <div className="flex items-center justify-between border-b p-2">
                <span className="text-sm text-muted-foreground">Bucket: quarantine</span>
                <Badge variant="destructive">Restrito (Admin Only)</Badge>
              </div>
              <div className="flex items-center justify-between border-b p-2">
                <span className="text-sm text-muted-foreground">Edge Function: secure-upload</span>
                <Badge className="border-success/30 bg-success/20 text-success">Ativa</Badge>
              </div>
              <div className="flex items-center justify-between p-2">
                <span className="text-sm text-muted-foreground">Verificação Antimalware</span>
                <Badge className="border-primary/30 bg-primary/20 text-primary">
                  VirusTotal V3
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Audit Log (Últimos 20 scans)
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real das varreduras de arquivos.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por caminho ou hash..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left font-medium">Data</th>
                  <th className="p-3 text-left font-medium">Arquivo</th>
                  <th className="p-3 text-left font-medium">Bucket</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Malicious</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Carregando auditoria...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Nenhum log encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap p-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </div>
                      </td>
                      <td
                        className="max-w-[200px] truncate p-3 font-mono text-[11px]"
                        title={log.path}
                      >
                        {log.path.split('/').pop()}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {log.bucket}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {log.status_code === 200 ? (
                          <Badge className="gap-1 border-success/20 bg-success/10 text-success hover:bg-success/20">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />{' '}
                            {log.status_code === 403 ? 'Bloqueado' : 'Erro'}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {(log.scan_result?.malicious ?? 0) > 0 ? (
                          <span className="font-bold text-destructive">
                            {log.scan_result?.malicious}!
                          </span>
                        ) : (
                          <span className="text-success">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
