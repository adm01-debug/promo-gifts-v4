import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/ui";
import { Loader2, Upload, Download, FileText, Trash2, Database, ShieldCheck, RefreshCw, ArrowRightLeft } from "lucide-react";
import { PageSEO } from "@/components/seo/PageSEO";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function StorageTestPage() {
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const { toast } = useToast();
  
  const bucketName = "test-external-storage";

  const fetchFiles = async (isCancelled: () => boolean = () => false) => {
    if (!isCancelled()) setLoadingFiles(true);
    try {
      const { data, error } = await supabase.storage.from(bucketName).list();
      if (isCancelled()) return;
      if (error) {
        if (error.message.includes("does not exist")) {
           toast({
            title: "Bucket não encontrado",
            description: `O bucket "${bucketName}" não existe no Supabase externo. Certifique-se de criá-lo.`,
            variant: "destructive",
          });
        } else {
          throw error;
        }
      }
      setFiles(data || []);
    } catch (error: any) {
      if (isCancelled()) return;
      console.error("Error fetching files:", error);
      toast({
        title: "Erro ao buscar arquivos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      if (!isCancelled()) setLoadingFiles(false);
    }
  };

  useEffect(() => {
    // Guarda de cancelamento: evita setState após o unmount.
    let cancelled = false;
    fetchFiles(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (error) throw error;

      toast({
        title: "Upload concluído",
        description: `Arquivo ${file.name} enviado com sucesso para o Supabase externo.`,
      });
      fetchFiles();
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Erro no download",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([fileName]);

      if (error) throw error;

      toast({
        title: "Arquivo removido",
        description: "Arquivo excluído do bucket externo.",
      });
      fetchFiles();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleManualSync = async () => {
    const table = (document.getElementById('sync-table') as HTMLInputElement).value;
    if (!table) {
      toast({ title: "Aviso", description: "Informe o nome da tabela." });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-external-db', {
        body: { table, direction: 'to-external' }
      });
      if (error) throw error;
      toast({ title: "Sucesso", description: data.message });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
      <>
        <PageSEO title="Teste de Storage e Sincronização" description="Validar infraestrutura externa." path="/admin/storage-test" noIndex />
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 data-testid="page-title-storage-test" className="text-3xl font-bold tracking-tight text-white">Infraestrutura Externa</h1>
              <p className="text-muted-foreground">
                Validar autenticação, storage e sincronização com o Supabase externo.
              </p>
            </div>
            <Badge variant="outline" className="h-fit py-1 px-3 gap-2 border-blue-500/30 text-blue-400">
              <Database className="h-4 w-4" />
              Supabase Externo Conectado
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                  Sincronização de Dados
                </CardTitle>
                <CardDescription>
                  Copiar dados do Supabase padrão para o Externo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Nome da Tabela</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="sync-table" 
                      defaultValue="products" 
                      placeholder="Ex: products, profiles..." 
                      className="bg-black/20 border-white/10 text-white"
                    />
                    <Button 
                      onClick={handleManualSync}
                      disabled={syncing}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Sincronizar"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Nota: A tabela deve possuir uma Primary Key 'id' para evitar duplicatas.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Upload className="h-5 w-5 text-blue-500" />
                  Teste de Storage
                </CardTitle>
                <CardDescription>
                  Validar permissões de escrita no bucket externo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="test-file" className="text-white/70">Arquivo</Label>
                  <Input 
                    id="test-file" 
                    type="file" 
                    onChange={handleUpload} 
                    disabled={uploading}
                    className="bg-black/20 border-white/10 text-white"
                  />
                </div>
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando para o bucket...
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2 bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <FileText className="h-5 w-5 text-blue-500" />
                      Arquivos no Supabase Externo
                    </CardTitle>
                    <CardDescription>
                      Listagem do bucket <code>{bucketName}</code>.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => fetchFiles()} disabled={loadingFiles} className="text-white/60 hover:text-white">
                    Atualizar Lista
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] w-full rounded-md border border-white/10 p-4 bg-black/20">
                  {loadingFiles ? (
                    <div className="flex flex-col items-center justify-center h-48 space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      <p className="text-sm text-muted-foreground">Buscando...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center space-y-2">
                      <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-white/30" />
                      </div>
                      <p className="text-sm text-muted-foreground">Bucket vazio ou inacessível.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {files.map((file) => (
                        <div key={file.id || file.name} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />
                            <span className="text-sm font-medium truncate text-white/90">{file.name}</span>
                            <span className="text-[10px] text-white/40">
                              {(file.metadata?.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-white/60 hover:text-white"
                              onClick={() => handleDownload(file.name)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(file.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <ShieldCheck className="h-6 w-6 text-blue-500 mt-1" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-blue-500">Checklist de Transição</h3>
                  <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                    <li>O login agora valida credenciais diretamente no seu Supabase externo.</li>
                    <li>O Storage acima usa o cliente configurado com suas chaves externas.</li>
                    <li>A sincronização manual ajuda a mover dados legados para o novo banco.</li>
                    <li>Certifique-se de que as policies (RLS) no banco externo espelhem as do banco interno.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
  );
}