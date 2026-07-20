/**
 * Dev-only visual harness para validar a disposição do QuoteViewPage:
 *   1) QuoteStatusTimeline renderiza ANTES do cabeçalho.
 *   2) Cabeçalho (h1 + botões) fica ACIMA do container do orçamento.
 *   3) DropdownMenu inclui "Excluir" entre "Duplicar" e "Histórico" com
 *      confirmação acessível (AlertDialog) e stub determinístico do delete.
 *
 * Rota: `/__visual/quote-view-order` (somente em `import.meta.env.DEV`).
 * Tema: `?theme=dark` adiciona `.dark` no `<html>`; default = light.
 *
 * Stub do delete: a função real fica em `window.__deleteQuoteSpy` (definida
 * pela spec via `addInitScript`) — se ausente, registra em
 * `window.__deleteQuoteCalls` para inspeção determinística no E2E.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Edit2, Eye, History, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { QuoteStatusTimeline } from '@/components/quotes/QuoteStatusTimeline';
import { QuoteItemDetailSheet } from '@/components/quotes/QuoteItemDetailSheet';
import { QuoteItemsTable, type QuoteItem } from '@/components/quotes/QuoteItemsTable';
import { qvSpacing, qvType } from '@/components/quotes/quote-view-typography';

/**
 * Fixtures determinísticos para validar QuoteItemsTable em E2E:
 *  - item sem personalização (0)
 *  - item com 1 personalização
 *  - item com 2+ personalizações (testa grid 2-col em md+)
 */
const HARNESS_TABLE_ITEMS: QuoteItem[] = [
  {
    id: 'fx-0',
    product_name: 'Abridor de garrafa aço',
    product_sku: '19049',
    color_name: 'AZUL',
    color_hex: '#1E88E5',
    quantity: 10,
    unit_price: 5.25,
    personalizations: [],
  },
  {
    id: 'fx-1',
    product_name: 'Caneta esferográfica plástica',
    product_sku: '88123',
    color_name: 'BRANCA',
    color_hex: '#FFFFFF',
    quantity: 100,
    unit_price: 1.2,
    personalizations: [
      {
        id: 'p1',
        technique_name: 'Tampografia | Plana',
        width_cm: 4,
        height_cm: 1,
        colors_count: 1,
        total_cost: 80,
        notes: 'Lado A — TAMPO-01 | 4x1cm',
      },
    ],
  },
  {
    id: 'fx-2',
    product_name: 'Garrafa esportiva em alumínio 400 ml',
    product_sku: '94297',
    color_name: 'PRETO',
    color_hex: '#111111',
    quantity: 200,
    unit_price: 23.4,
    personalizations: [
      {
        id: 'p2a',
        technique_name: 'Fiber Laser | Plana',
        width_cm: 3,
        height_cm: 12,
        colors_count: 1,
        total_cost: 470,
        notes: 'Lado A — FIBER-PL-01 | 3x12cm',
      },
      {
        id: 'p2b',
        technique_name: 'Impressão Digital UV | Plano | Metal',
        width_cm: 2.5,
        height_cm: 12,
        colors_count: 1,
        total_cost: 520,
        notes: 'Lado B — UV-METAL-02 | 2.5x12cm',
      },
    ],
  },
];

const HARNESS_QUOTE_ID = 'harness-quote-id-0042';

declare global {
  interface Window {
    __deleteQuoteSpy?: (id: string) => Promise<void> | void;
    __deleteQuoteCalls?: string[];
  }
}

export default function QuoteViewOrderHarness() {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme');
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    window.__deleteQuoteCalls ??= [];
    return () => {
      root.classList.remove('dark');
    };
  }, []);

  const handleConfirmDelete = async (e?: React.MouseEvent) => {
    // Radix fecha o AlertDialog ao clicar na Action — bloqueamos para manter
    // o estado de loading visível (botões disabled) durante o await.
    e?.preventDefault();
    if (isDeleting) return;
    setIsDeleting(true);
    window.__deleteQuoteCalls?.push(HARNESS_QUOTE_ID);
    try {
      await window.__deleteQuoteSpy?.(HARNESS_QUOTE_ID);
      setConfirmOpen(false);
      toast.success('Orçamento excluído');
      navigate('/orcamentos');
    } catch {
      toast.error('Não foi possível excluir o orçamento. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main
      data-testid="quote-view-order-harness"
      data-quote-id={HARNESS_QUOTE_ID}
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
                  className="font-display text-base font-semibold leading-tight tracking-tight text-foreground"
                >
                  Orçamento ORC-2026-0042
                </h1>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Pendente
                </Badge>
              </div>
              <p className={qvType.meta}>Criado em 01/06/2026</p>
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
                    setConfirmOpen(true);
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

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent
            data-testid="quote-delete-dialog"
            onOpenAutoFocus={(e) => {
              // Foco inicial no Cancelar (escolha mais segura para ações destrutivas).
              e.preventDefault();
              cancelRef.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="quote-delete-dialog-title">
                Excluir orçamento?
              </AlertDialogTitle>
              <AlertDialogDescription data-testid="quote-delete-dialog-description">
                Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                ref={cancelRef}
                disabled={isDeleting}
                data-testid="quote-delete-cancel"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                data-testid="quote-delete-confirm"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Excluindo…' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 3) Container do orçamento — sem moldura (paridade com QuoteViewPage) */}
        <Card data-testid="quote-content-card" className="border-0 bg-transparent shadow-none">
          <CardContent className={cn('pt-4', qvSpacing.sectionStack)}>
            <div className={qvType.blockTitle}>Cliente · Empresa Demonstração LTDA</div>
            <Separator />
            <div className={qvType.meta}>[conteúdo do orçamento ocultado no harness]</div>
            <Separator />
            <div data-testid="harness-item-row" className="flex items-center justify-between gap-2">
              <span className={qvType.productName}>Garrafa esportiva 400ml</span>
              <QuoteItemDetailSheet
                item={{
                  product_name: 'Garrafa esportiva 400ml',
                  product_sku: '94297',
                  color_name: 'LARANJA',
                  color_hex: '#FF7A1A',
                  quantity: 150,
                  unit_price: 20,
                  personalizations: [
                    {
                      technique_name: 'Fiber Laser | Plana',
                      technique_id: 'fiber-plana',
                      colors_count: 1,
                      width_cm: 3,
                      height_cm: 12,
                      setup_cost: 150.5,
                      total_cost: 470.85,
                      notes: 'Lado A — FIBER-PL-01 | 3x12cm',
                    },
                  ],
                }}
              />
            </div>

            <Separator />
            {/* Tabela com fixtures determinísticos (0/1/N personalizações) */}
            <div data-testid="quote-items-table-fixture">
              <QuoteItemsTable items={HARNESS_TABLE_ITEMS} />
            </div>

            <Separator />
            {/* Fixture com 8 itens para validar o scroll interno (>5). */}
            <div data-testid="quote-items-table-fixture-many">
              <QuoteItemsTable
                items={Array.from({ length: 8 }, (_, i) => ({
                  id: `fx-many-${i}`,
                  product_name: `Produto rolável ${i + 1}`,
                  product_sku: `SKU-${1000 + i}`,
                  quantity: 10 + i,
                  unit_price: 5 + i,
                  personalizations: [],
                }))}
              />
            </div>

            <Separator />
            <section
              data-testid="harness-quote-versions"
              aria-label="Versões do Orçamento"
              className="mt-6"
            >
              <h2 className="text-base font-semibold">Versões do Orçamento</h2>
              <p className="text-sm text-muted-foreground">v1 · v2 · v3 (stub)</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
