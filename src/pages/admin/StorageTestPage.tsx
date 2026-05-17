import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, FileText, Trash2, Database, ShieldCheck, RefreshCw, ArrowRightLeft } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
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

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.storage.from(bucketName).list();
      if (error) {
        // Se o bucket não existir, tentamos criar ou apenas avisamos
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
      console.error("Error fetching files:", error);
      toast({
        title: "Erro ao buscar arquivos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
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

  return (
    <MainLayout>
      <PageSEO title="Teste de Storage Externo" description="Validar upload/download no storage do Supabase externo." path="/admin/storage-test" noIndex />
      <div className="container mx-auto py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Teste de Storage Externo</h1>
            <p className="text-muted-foreground">
              Verifique se as credenciais externas permitem operações de arquivos.
            </p>
          </div>
          <Badge variant="outline" className="h-fit py-1 px-3 gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            Supabase Externo
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload de Teste
              </CardTitle>
              <CardDescription>
                Selecione um arquivo para enviar ao bucket <code>{bucketName}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="test-file">Arquivo</Label>
                <Input 
                  id="test-file" 
                  type="file" 
                  onChange={handleUpload} 
                  disabled={uploading}
                />
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando para o servidor externo...
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Arquivos no Bucket
                  </CardTitle>
                  <CardDescription>
                    Listagem de arquivos no seu Supabase externo.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchFiles} disabled={loadingFiles}>
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                {loadingFiles ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Buscando arquivos...</p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center space-y-2">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado no bucket.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div key={file.id || file.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />
                          <span className="text-sm font-medium truncate">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {(file.metadata?.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleDownload(file.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
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
                <h3 className="font-semibold text-blue-500">Configuração de Segurança (CORS)</h3>
                <p className="text-sm text-muted-foreground">
                  Se você encontrar erros de "Network Error" ou bloqueios de CORS ao fazer upload, certifique-se de que o seu Supabase externo tenha as configurações de CORS liberadas para o domínio desta aplicação (<code>{window.location.origin}</code>).
                </p>
                <div className="p-3 bg-black/40 rounded-lg font-mono text-xs text-blue-400/80">
                  Dashboard Supabase -> Storage -> Settings -> CORS Configuration
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}