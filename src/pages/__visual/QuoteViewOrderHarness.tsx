/**
 * Dev-only visual harness para validar a disposição do QuoteViewPage:
 *   1) QuoteStatusTimeline renderiza ANTES do cabeçalho.
 *   2) Cabeçalho (h1 + botões) fica ACIMA do container do orçamento.
 *
 * Rota: `/__visual/quote-view-order` (somente em `import.meta.env.DEV`).
 * Tema: `?theme=dark` adiciona `.dark` no `<html>`; default = light.
 *
 * Espelha a marcação real de `src/pages/quotes/QuoteViewPage.tsx` (wrapper +
 * timeline + header + Card). Marcação 1:1 — se uma mudar, a outra DEVE mudar
 * junto. A duplicação é intencional: permite snapshots determinísticos sem
 * Supabase/router/auth e sem seed de orçamentos.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Edit2, Eye, History, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuoteStatusTimeline } from '@/components/quotes/QuoteStatusTimeline';

export default function QuoteViewOrderHarness() {
  const navigate = useNavigate();
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme');
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    return () => {
      root.classList.remove('dark');
    };
  }, []);

  const handleDelete = () => {
    const ok = window.confirm(
      'Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.',
    );
    if (!ok) return;
    // Stub determinístico: simula sucesso de delete e roteamento.
    setDeleted(true);
    toast.success('Orçamento excluído');
    navigate('/orcamentos');
  };

  return (
    <main
      data-testid="quote-view-order-harness"
      data-deleted={deleted ? 'true' : 'false'}
      className="min-h-dvh bg-background"
    >
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-2.5 px-3 py-2.5 pb-24 sm:space-y-3 sm:px-4 sm:py-3 md:pb-5 lg:px-6 xl:px-8">
        {/* 1) Timeline no topo, sem moldura */}
        <div className="w-full">
          <QuoteStatusTimeline
            status="pending"
            createdAt="2026-06-01T10:00:00Z"
            updatedAt="2026-06-02T11:30:00Z"
          />
        </div>

        {/* 2) Header acima do container */}
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Voltar"
              className="h-8 w-8 rounded-full border-primary/40 hover:border-primary hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4 text-primary" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  data-testid="page-title-quote-view"
                  className="font-display text-base font-semibold leading-tight tracking-tight"
                >
                  Orçamento ORC-2026-0042
                </h1>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Pendente
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Criado em 01/06/2026</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              data-testid="pdf-preview-trigger"
              aria-label="Abrir preview da proposta"
              className="h-7 rounded-full border-primary/40 px-2.5 text-[11px]"
            >
              <Eye className="mr-1 h-3 w-3 text-primary" />
              Preview
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Mais opções"
                  data-testid="quote-actions-trigger"
                  className="h-7 w-7 rounded-full border-primary/40"
                >
                  <MoreHorizontal className="h-4 w-4 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" data-testid="quote-actions-menu">
                <DropdownMenuItem>
                  <Edit2 className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="quote-actions-delete"
                  onSelect={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <History className="mr-2 h-4 w-4" /> Histórico
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>


        {/* 3) Container do orçamento — sem moldura (paridade com QuoteViewPage) */}
        <Card
          data-testid="quote-content-card"
          className="border-0 bg-transparent shadow-none"
        >
          <CardContent className="space-y-4 pt-4">
            <div className="text-sm text-foreground">
              Cliente · Empresa Demonstração LTDA
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground">
              [conteúdo do orçamento ocultado no harness]
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
