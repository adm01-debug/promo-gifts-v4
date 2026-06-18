import { useState, useEffect } from 'react';
import { useExternalCompanies, useExternalProducts } from '@/hooks/intelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  Building2,
  Package,
  RefreshCw,
} from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';

export default function ExternalDatabaseTest() {
  const [activeTab, setActiveTab] = useState('companies');

  // Usar os hooks corretamente (sem parâmetros)
  const companiesHook = useExternalCompanies();
  const productsHook = useExternalProducts();

  const {
    data: companies,
    isLoading: loadingCompanies,
    error: companiesError,
    fetchAll: fetchCompanies,
  } = companiesHook;

  const {
    data: products,
    isLoading: loadingProducts,
    error: productsError,
    fetchAll: fetchProducts,
  } = productsHook;

  // Carregar dados ao montar o componente
  useEffect(() => {
    fetchCompanies({ limit: 10 });
    fetchProducts({ limit: 10 });
  }, [fetchCompanies, fetchProducts]);

  const handleRefetchCompanies = async () => {
    await fetchCompanies({ limit: 10 });
  };

  const handleRefetchProducts = async () => {
    await fetchProducts({ limit: 10 });
  };

  const ConnectionStatus = ({
    isLoading,
    error,
    data,
  }: {
    isLoading: boolean;
    error: string | null;
    data: unknown[] | null;
  }) => {
    if (isLoading) {
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Conectando...
        </Badge>
      );
    }
    if (error) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Erro na conexão
        </Badge>
      );
    }
    if (data?.length) {
      return (
        <Badge variant="default" className="gap-1 bg-success">
          <CheckCircle2 className="h-3 w-3" />
          Conectado ({data.length} registros)
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        Aguardando...
      </Badge>
    );
  };

  return (
    <>
      <PageSEO
        title="Teste de Banco Externo"
        description="Teste de conexão com banco de dados externo."
        path="/external-db-test"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <h1
                data-testid="page-title-external-db-test"
                className="font-display text-2xl font-bold"
              >
                Teste de Conexão - Banco Externo
              </h1>
              <p className="text-muted-foreground">Verificando conexão com o Supabase externo</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  Empresas (Somente Leitura)
                </CardTitle>
                <ConnectionStatus
                  isLoading={loadingCompanies}
                  error={companiesError}
                  data={companies}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefetchCompanies}
                disabled={loadingCompanies}
                className="mb-3"
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', loadingCompanies && 'animate-spin')} />
                Recarregar
              </Button>
              {companiesError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {companiesError}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" />
                  Produtos (CRUD Completo)
                </CardTitle>
                <ConnectionStatus
                  isLoading={loadingProducts}
                  error={productsError}
                  data={products}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefetchProducts}
                disabled={loadingProducts}
                className="mb-3"
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', loadingProducts && 'animate-spin')} />
                Recarregar
              </Button>
              {productsError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {productsError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Empresas
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <CardTitle>Dados das Empresas (CRM)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {loadingCompanies ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : companies && companies.length > 0 ? (
                    <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
                      {JSON.stringify(companies, null, 2)}
                    </pre>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      Nenhum dado encontrado ou erro na conexão
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Dados dos Produtos (products)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {loadingProducts ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : products && products.length > 0 ? (
                    <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
                      {JSON.stringify(products, null, 2)}
                    </pre>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      Nenhum dado encontrado ou erro na conexão
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
