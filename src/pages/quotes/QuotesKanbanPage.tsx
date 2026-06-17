import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { QuoteKanbanBoard } from '@/components/quotes/QuoteKanbanBoard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, LayoutGrid, List, BarChart3, Building2 } from 'lucide-react';
import { useQuotes } from '@/hooks/quotes';
import { selectCrm } from '@/lib/crm-db';
import { Badge } from '@/components/ui/badge';

interface Client {
  id: string;
  name: string;
}

export default function QuotesKanbanPage() {
  const navigate = useNavigate();
  const { quotes, isLoading } = useQuotes();
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [clients, setClients] = useState<Client[]>([]);

  // Fetch clients for filter via CRM bridge
  useEffect(() => {
    let cancelled = false;
    const fetchClients = async () => {
      try {
        const companies = await selectCrm<{
          id: string;
          razao_social: string;
          nome_fantasia: string;
        }>('companies', {
          select: 'id, razao_social, nome_fantasia',
          orderBy: { column: 'nome_fantasia', ascending: true },
          limit: 500,
        });
        if (!cancelled) {
          setClients(
            companies.map((c) => ({ id: c.id, name: c.nome_fantasia || (c.razao_social ?? '') })),
          );
        }
      } catch {
        // CRM bridge may be unavailable — clients will fall back to quotesClients
      }
    };
    fetchClients();
    return () => {
      cancelled = true;
    };
  }, []);

  // Get unique clients from quotes
  const quotesClients = useMemo(() => {
    const clientMap = new Map<string, string>();
    quotes.forEach((q) => {
      if (q.client_id && q.client_name) {
        clientMap.set(q.client_id, q.client_name);
      }
    });
    return Array.from(clientMap, ([id, name]) => ({ id, name }));
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    if (selectedClientId === 'all') return quotes;
    return quotes.filter((q) => q.client_id === selectedClientId);
  }, [quotes, selectedClientId]);

  const selectedClientName = useMemo(() => {
    if (selectedClientId === 'all') return null;
    return (
      clients.find((c) => c.id === selectedClientId)?.name ||
      quotesClients.find((c) => c.id === selectedClientId)?.name ||
      null
    );
  }, [selectedClientId, clients, quotesClients]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4 overflow-x-auto">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[500px] min-w-[280px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageSEO
        title="Kanban de Orçamentos"
        description="Visualize e gerencie orçamentos no formato Kanban."
        path="/orcamentos/kanban"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              onClick={() => navigate('/orcamentos')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1
                data-testid="page-title-orcamentos-funil"
                className="font-display text-2xl font-bold text-foreground"
              >
                Funil de Orçamentos
              </h1>
              <p className="text-muted-foreground">Arraste os cartões para alterar o status</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Client Filter */}
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[200px]">
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {(clients.length > 0 ? clients : quotesClients).map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Switchers */}
            <Button variant="outline" size="sm" onClick={() => navigate('/orcamentos')}>
              <List className="mr-2 h-4 w-4" />
              Lista
            </Button>
            <Button variant="secondary" size="sm" disabled>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Kanban
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/orcamentos/dashboard')}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard
            </Button>

            <Button onClick={() => navigate('/orcamentos/novo')}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Orçamento
            </Button>
          </div>
        </div>

        {/* Active Client Filter Badge */}
        {selectedClientName && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-2 px-3 py-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Filtrando por: {selectedClientName}
              <button
                onClick={() => setSelectedClientId('all')}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          </div>
        )}

        {/* Kanban Board */}
        <QuoteKanbanBoard quotes={filteredQuotes} />

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-muted/50" />
            <span>Rascunho → Pendente/Enviado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-amber-500/50" />
            <span>Aguardando Aprovação (desconto acima do limite)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-warning/50" />
            <span>Pendente → Rascunho/Enviado/Expirado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-info/50" />
            <span>Enviado → Aprovado/Rejeitado/Pendente/Expirado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-success/50" />
            <span>Aprovado/Rejeitado → Enviado (reverter)</span>
          </div>
        </div>
      </div>
    </>
  );
}
