/**
 * SavedViewsManager — salva/aplica combinações de filtros do módulo de tendências.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bookmark, Plus, Trash2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  created_at: string;
}

export function SavedViewsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  const { data: views = [] } = useQuery({
    queryKey: ['saved-trends-views', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SavedView[]> => {
      const { data, error } = await supabase
        .from('saved_trends_views' as never)
        .select('id, name, filters, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavedView[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (viewName: string) => {
      if (!user) throw new Error('Não autenticado');
      const filters: Record<string, string> = {};
      params.forEach((v, k) => {
        filters[k] = v;
      });
      const { error } = await supabase
        .from('saved_trends_views' as never)
        .insert({ user_id: user.id, name: viewName, filters } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-trends-views'] });
      toast({
        title: 'Visão salva',
        description: 'Você pode aplicá-la novamente a qualquer momento.',
      });
      setName('');
      setOpen(false);
    },
    onError: () =>
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a visão.',
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_trends_views' as never)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-trends-views'] }),
  });

  const applyView = (view: SavedView) => {
    const sp = new URLSearchParams();
    Object.entries(view.filters).forEach(([k, v]) => sp.set(k, v));
    navigate(`/tendencias?${sp}`, { replace: true });
    toast({ title: 'Visão aplicada', description: view.name });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="h-3.5 w-3.5" />
          Visões {views.length > 0 && <span className="text-xs">({views.length})</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Minhas visões salvas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nenhuma visão salva ainda
          </p>
        ) : (
          views.map((v) => (
            <DropdownMenuItem
              key={v.id}
              className="flex items-center justify-between gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <button
                onClick={() => applyView(v)}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <Check className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{v.name}</span>
              </button>
              <button
                onClick={() => deleteMutation.mutate(v.id)}
                className="p-1 text-destructive hover:text-destructive/80"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer gap-2">
              <Plus className="h-3.5 w-3.5" />
              Salvar visão atual
            </DropdownMenuItem>
          </PopoverTrigger>
          <PopoverContent side="left" className="w-56 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) saveMutation.mutate(name.trim());
              }}
              className="space-y-2"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Visão semanal"
                autoFocus
                className="h-8 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={!name.trim() || saveMutation.isPending}
              >
                Salvar
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
