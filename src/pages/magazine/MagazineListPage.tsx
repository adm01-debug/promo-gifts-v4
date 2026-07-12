/**
 * MagazineListPage — /magazine
 * Grid de rascunhos + publicações do usuário, com CTA para criar novo.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { magazineService } from '@/services/magazineService';
import type { Magazine } from '@/types/magazine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSEO } from '@/components/seo/PageSEO';
import { getTemplate } from './components/templates/TemplateRegistry';

export default function MagazineListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [magazines, setMagazines] = useState<Magazine[]>([]);

  const refresh = () => {
    if (!user) return;
    setMagazines(magazineService.list(user.id));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const empty = magazines.length === 0;
  const created = useMemo(() => magazines, [magazines]);

  const handleCreate = () => {
    if (!user) return;
    const mag = magazineService.create({ ownerId: user.id, organizationId: null });
    navigate(`/magazine/${mag.id}`);
  };

  const handleDuplicate = (id: string) => {
    const cloned = magazineService.duplicate(id);
    if (cloned) {
      toast.success('Revista duplicada.');
      refresh();
    }
  };

  const handleDelete = (id: string) => {
    magazineService.delete(id);
    toast.success('Revista excluída.');
    refresh();
  };

  return (
    <>
      <PageSEO
        title="Magazine — Revistas de Produtos"
        description="Monte revistas e catálogos personalizados com o nosso catálogo em minutos."
        path="/magazine"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
        <h1 data-testid="page-title-magazine" className="sr-only">
          Magazine
        </h1>

        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Magazine</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie revistas de produtos com 10 templates de design e branding do cliente.
              </p>
            </div>
          </div>
          <Button size="lg" onClick={handleCreate} data-testid="magazine-create-btn">
            <Plus className="mr-2 h-5 w-5" />
            Nova revista
          </Button>
        </header>

        {empty ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <BookOpen className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Nenhuma revista ainda</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Monte sua primeira revista escolhendo produtos do catálogo, ajustando os campos exibidos e
                selecionando um dos 10 templates de design.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" /> Criar primeira revista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {created.map((m) => {
              const template = getTemplate(m.templateId);
              return (
                <Card
                  key={m.id}
                  className="group cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => navigate(`/magazine/${m.id}`)}
                  data-testid={`magazine-card-${m.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-1 text-base">{m.title}</CardTitle>
                      {m.status === 'published' ? (
                        <Badge variant="default" className="shrink-0">
                          Publicada
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          Rascunho
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{template.name}</span>
                      <span>{m.items.length} produto{m.items.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex items-center gap-2 border-t pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(m.id);
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Duplicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(m.id);
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
