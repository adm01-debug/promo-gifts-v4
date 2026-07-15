/**
 * MagazineListPage — /magazine
 * Grid + busca + filtro por status + ordenação + delete com Undo.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Copy,
  Plus,
  Search,
  SortAsc,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { magazineService } from '@/services/magazineService';
import type { Magazine } from '@/types/magazine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';
import { Clickable } from '@/components/shared/Clickable';
import { getTemplate } from './components/templates/TemplateRegistry';
import { MagazineCardThumbnail } from './components/MagazineCardThumbnail';
// FIX C12 (auditoria BD, 2026-07-12): migração one-shot do localStorage
// para o BD Gold via edge magazine-import-local. Ver hook para detalhes
// de idempotência e fallback gracioso.
import { useMagazineGoldImport } from './hooks/useMagazineGoldImport';

type SortMode = 'name-asc' | 'name-desc' | 'updated-asc' | 'updated-desc';
type StatusFilter = 'all' | 'draft' | 'published';

export default function MagazineListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortMode>('updated-desc');
  const [pendingDelete, setPendingDelete] = useState<Magazine | null>(null);

  // FIX C12: dispara a migração 1x por usuário, em background — não bloqueia
  // a renderização da lista (que continua lendo do localStorage normalmente
  // até o próximo passo do roadmap trocar magazineService por Supabase).
  useMagazineGoldImport(user?.id);

  const refresh = async () => {
    if (!user) return;
    const list = await magazineService.list(user.id);
    setMagazines(list);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = magazines.filter((m) => {
      if (status !== 'all' && m.status !== status) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        (m.branding.clientName ?? '').toLowerCase().includes(q)
      );
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case 'updated-asc':
          return a.updatedAt.localeCompare(b.updatedAt);
        case 'name-asc':
          return a.title.localeCompare(b.title, 'pt-BR');
        case 'name-desc':
          return b.title.localeCompare(a.title, 'pt-BR');
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
    return out;
  }, [magazines, query, status, sort]);

  const empty = magazines.length === 0;

  const handleCreate = async () => {
    if (!user) return;
    const mag = await magazineService.create({ ownerId: user.id, organizationId: null });
    navigate(`/magazine/${mag.id}`);
  };

  const handleDuplicate = async (id: string) => {
    const cloned = await magazineService.duplicate(id);
    if (cloned) {
      toast.success('Revista duplicada.');
      await refresh();
    }
  };

  const confirmDelete = (m: Magazine) => setPendingDelete(m);

  const executeDelete = async () => {
    if (!pendingDelete) return;
    const backup = pendingDelete;
    await magazineService.delete(backup.id);
    setPendingDelete(null);
    await refresh();
    toast('Revista excluída.', {
      description: backup.title,
      action: {
        label: 'Desfazer',
        onClick: () => {
          void (async () => {
            await magazineService.restore(backup);
            await refresh();
            toast.success('Revista restaurada.');
          })();
        },
      },
      duration: 8000,
    });
  };

  const openCard = (m: Magazine) => navigate(`/magazine/${m.id}`);

  return (
    <>
      <PageSEO
        title="Magazine — Revistas de Produtos"
        description="Monte revistas e catálogos personalizados com o nosso catálogo em minutos."
        path="/magazine"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <BookOpen className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <div>
              <h1
                data-testid="page-title-magazine"
                className="font-display text-3xl font-bold tracking-tight"
              >
                Magazine
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie revistas de produtos com 10 templates de design e branding do cliente.
              </p>
            </div>
          </div>
          <Button size="lg" onClick={handleCreate} data-testid="magazine-create-btn">
            <Plus className="mr-2 h-5 w-5" aria-hidden />
            Nova revista
          </Button>
        </header>

        {!empty && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título ou cliente…"
                className="pl-9"
                aria-label="Buscar revistas"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-40" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="draft">Rascunhos</SelectItem>
                <SelectItem value="published">Publicadas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger className="w-52" aria-label="Ordenar revistas">
                <div className="flex items-center gap-2">
                  <SortAsc className="h-4 w-4" aria-hidden />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-desc">Mais recentes primeiro</SelectItem>
                <SelectItem value="updated-asc">Mais antigas primeiro</SelectItem>
                <SelectItem value="name-asc">A → Z</SelectItem>
                <SelectItem value="name-desc">Z → A</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
              {filtered.length} revista{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {empty ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <BookOpen className="h-10 w-10 text-primary" aria-hidden />
              </div>
              <h2 className="text-xl font-semibold">Nenhuma revista ainda</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Monte sua primeira revista escolhendo produtos do catálogo, ajustando os campos exibidos e
                selecionando um dos 10 templates de design.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden /> Criar primeira revista
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma revista corresponde à busca.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => {
              const template = getTemplate(m.templateId);
              return (
                <Clickable
                  key={m.id}
                  as={Card}
                  aria-label={`Abrir revista ${m.title}`}
                  className={cn(
                    'group overflow-hidden transition-shadow hover:shadow-md',
                  )}
                  onClick={() => openCard(m)}
                  data-testid={`magazine-card-${m.id}`}
                >


                  <MagazineCardThumbnail magazine={m} />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-1 text-base">{m.title}</CardTitle>
                      {m.status === 'published' ? (
                        <Badge variant="default" className="shrink-0">Publicada</Badge>
                      ) : m.status === 'archived' ? (
                        <Badge variant="outline" className="shrink-0">Arquivada</Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">Rascunho</Badge>
                      )}
                    </div>
                    {m.branding.clientName && (
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {m.branding.clientName}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{template.name}</span>
                      <span>
                        {m.items.length} produto{m.items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Editada{' '}
                      {formatDistanceToNow(new Date(m.updatedAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                    <div className="flex items-center gap-2 border-t pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(m.id);
                        }}
                        aria-label={`Duplicar ${m.title}`}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" aria-hidden /> Duplicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(m);
                        }}
                        aria-label={`Excluir ${m.title}`}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir revista?</AlertDialogTitle>
            <AlertDialogDescription>
              A revista <strong>{pendingDelete?.title}</strong> será excluída. Você pode desfazer
              imediatamente pelo toast, mas depois disso a exclusão é permanente.
              {pendingDelete?.status === 'published' && (
                <span className="mt-2 block rounded-md bg-destructive/10 p-2 text-destructive">
                  Atenção: esta revista está <strong>publicada</strong> — o link público deixará de
                  funcionar.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
