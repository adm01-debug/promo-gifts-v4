import { useEffect } from 'react';
import { useDropboxFiles } from '@/hooks/intelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Folder, File, ArrowUp, Image, RefreshCw, Cloud } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageSEO } from '@/components/seo/PageSEO';
import { EdgeFallback } from '@/components/shared/EdgeFallback';

export default function DropboxBrowserPage() {
  const {
    entries,
    isLoading,
    isConnected,
    currentPath,
    error,
    checkConnection,
    listFiles,
    navigateToFolder,
    navigateUp,
    retry,
  } = useDropboxFiles();

  useEffect(() => {
    checkConnection().then((connected) => {
      if (connected) listFiles('');
    });
  }, [checkConnection, listFiles]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  if (isConnected === false) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <PageSEO
          title="Navegador de Arquivos"
          description="Navegue e gerencie arquivos do Dropbox integrado."
          path="/dropbox"
          noIndex
        />
        <EdgeFallback
          variant="disconnected"
          title="Dropbox não conectado"
          description="Configure a integração do Dropbox nas conexões do painel administrativo para navegar seus arquivos por aqui."
          tip="Se você é administrador, valide o token em Admin › Conexões."
          onRetry={retry}
          retryLabel="Verificar novamente"
          isRetrying={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1
            data-testid="page-title-dropbox"
            className="flex items-center gap-2 font-display text-2xl font-bold text-foreground"
          >
            <Cloud className="h-6 w-6" />
            Dropbox
          </h1>
          <p className="text-muted-foreground">Navegue pelos arquivos do Dropbox</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => listFiles(currentPath)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Breadcrumb */}
      <Card>
        <CardContent className="pb-4 pt-4">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => listFiles('')}>
              Raiz
            </Button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => listFiles(`/${pathParts.slice(0, i + 1).join('/')}`)}
                >
                  {part}
                </Button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Arquivos</CardTitle>
          {currentPath && (
            <Button variant="ghost" size="sm" onClick={navigateUp}>
              <ArrowUp className="mr-1 h-4 w-4" /> Voltar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <EdgeFallback
              variant="error"
              title="Não foi possível listar os arquivos"
              error={error}
              tip="Verifique sua conexão ou tente novamente em alguns instantes."
              onRetry={retry}
              isRetrying={isLoading}
            />
          ) : entries.length === 0 ? (
            <EdgeFallback
              variant="empty"
              title="Pasta vazia"
              description="Nenhum arquivo ou subpasta nesta localização."
              onRetry={retry}
              retryLabel="Recarregar"
              isRetrying={isLoading}
            />
          ) : (
            <div className="divide-y">
              {entries
                .sort((a, b) => {
                  if (a['.tag'] === 'folder' && b['.tag'] !== 'folder') return -1;
                  if (a['.tag'] !== 'folder' && b['.tag'] === 'folder') return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                    onClick={() => {
                      if (entry['.tag'] === 'folder') navigateToFolder(entry.path_lower);
                    }}
                  >
                    {entry['.tag'] === 'folder' ? (
                      <Folder className="h-5 w-5 shrink-0 text-primary" />
                    ) : entry.thumbnail_url ? (
                      <img
                        src={entry.thumbnail_url}
                        alt={entry.name}
                        className="h-10 w-10 shrink-0 rounded border object-cover"
                        loading="lazy"
                      />
                    ) : /\.(jpg|jpeg|png|gif|svg)$/i.test(entry.name) ? (
                      <Image className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <File className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.name}</p>
                      {entry.server_modified && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.server_modified).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    {entry.size !== undefined && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {formatSize(entry.size)}
                      </Badge>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
