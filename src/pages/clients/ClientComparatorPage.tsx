/**
 * ClientComparatorPage — comparação lado-a-lado de até 3 clientes do BI.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitCompare, ArrowLeft, Plus } from 'lucide-react';
import { ClientSelector } from '@/components/bi/ClientSelector';
import { ClientComparator } from '@/components/bi/ClientComparator';

const MAX_CLIENTS = 3;

export default function ClientComparatorPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get('ids') ?? '').split(',').filter(Boolean);
  const [clientIds, setClientIds] = useState<string[]>(initial.slice(0, MAX_CLIENTS));
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (clientIds.length > 0) {
      setSearchParams({ ids: clientIds.join(',') });
    } else {
      setSearchParams({});
    }
  }, [clientIds, setSearchParams]);

  const addClient = (id: string | null) => {
    if (!id || clientIds.includes(id) || clientIds.length >= MAX_CLIENTS) return;
    setClientIds([...clientIds, id]);
    setAdding(null);
  };

  const removeClient = (id: string) => {
    setClientIds(clientIds.filter((c) => c !== id));
  };

  return (
    <>
      <PageSEO
        title="Comparador de clientes · BI"
        description="Compare lado a lado até 3 clientes da carteira: Health Score, LTV, ticket, sazonalidade."
        path="/ferramentas/bi/comparar"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/ferramentas/bi')}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-700 shadow-lg shadow-violet-500/25">
                <GitCompare className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1
                  data-testid="page-title-client-comparator"
                  className="font-display text-lg font-bold"
                >
                  Comparador de clientes
                </h1>
                <p className="text-xs text-muted-foreground">
                  Lado a lado · até {MAX_CLIENTS} clientes da sua carteira
                </p>
              </div>
            </div>
          </div>
        </div>

        {clientIds.length < MAX_CLIENTS && (
          <Card className="border-[1.5px] border-dashed">
            <CardContent className="space-y-3 p-4">
              <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Plus className="h-3.5 w-3.5" />
                Adicionar cliente ({clientIds.length}/{MAX_CLIENTS})
              </label>
              <ClientSelector value={adding} onChange={addClient} />
              {clientIds.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Já em comparação: {clientIds.length}{' '}
                  {clientIds.length === 1 ? 'cliente' : 'clientes'}.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {clientIds.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/5 p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-700/20">
              <GitCompare className="h-7 w-7 text-violet-400" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold">Nenhum cliente selecionado</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Selecione acima pelo menos um cliente da sua carteira para iniciar a comparação lado a
              lado.
            </p>
            <p className="text-xs text-muted-foreground">
              Você pode comparar até {MAX_CLIENTS} clientes simultaneamente.
            </p>
          </div>
        ) : (
          <ClientComparator clientIds={clientIds} onRemove={removeClient} />
        )}
      </div>
    </>
  );
}
