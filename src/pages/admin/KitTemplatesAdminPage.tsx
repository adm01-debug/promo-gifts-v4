/**
 * Admin: gerenciar templates de kits sugeridos pelo sistema.
 */
import { useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import { Plus, Pencil, Trash2, EyeOff, Eye, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageSEO } from '@/components/seo/PageSEO';
import { useAdminKitTemplates } from '@/hooks/admin';
import type { KitTemplateRow } from '@/hooks/kit-builder';
import { formatCurrency } from '@/lib/kit-builder';
import { cn } from '@/lib/utils';

const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#22C55E', '#6366F1'];
const PRESET_ICONS = ['Package', 'Gift', 'Heart', 'Star', 'Crown', 'Sparkles', 'Briefcase', 'Coffee', 'Laptop', 'Leaf', 'Trophy', 'Users'];

interface FormState {
  id?: string;
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  tag: string;
  total_price: number;
  is_active: boolean;
}

const emptyForm: FormState = {
  name: '', description: '', category: 'Geral', color: '#3B82F6', icon: 'Package',
  tag: '', total_price: 0, is_active: true,
};

export default function KitTemplatesAdminPage() {
  const { templates, isLoading, upsert, isUpserting, remove, toggleActive } = useAdminKitTemplates();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const openCreate = () => setEditing({ ...emptyForm });
  const openEdit = (t: KitTemplateRow) => setEditing({
    id: t.id, name: t.name, description: t.description ?? '',
    category: t.category, color: t.color, icon: t.icon, tag: t.tag ?? '',
    total_price: Number(t.total_price), is_active: t.is_active,
  });

  const handleSave = async () => {
    if (!editing) return;
    await upsert({
      id: editing.id,
      name: editing.name,
      description: editing.description || null,
      category: editing.category || 'Geral',
      color: editing.color,
      icon: editing.icon,
      tag: editing.tag || null,
      total_price: Number(editing.total_price) || 0,
      is_active: editing.is_active,
      items_data: [],
      personalization_data: {},
    });
    setEditing(null);
  };

  return (
      <>
        <PageSEO title="Templates de Kits" description="Gestão de templates sugeridos pelo sistema." path="/admin/kit-templates" noIndex />
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 data-testid="page-title-kit-templates" className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-7 w-7 text-primary" /> Templates de Kits
              </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e mantenha o banco de kits sugeridos disponíveis para todos os vendedores.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo template
        </Button>
      </div>

      <Input
        placeholder="Buscar template…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          Nenhum template cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const Icon = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[t.icon] || Lucide.Package;
            return (
              <Card key={t.id} className={cn('overflow-hidden', !t.is_active && 'opacity-60')}>
                <div className="h-1.5 w-full" style={{ background: t.color }} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{ background: `${t.color}1A`, borderColor: `${t.color}40`, color: t.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-semibold truncate">{t.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(Number(t.total_price))}</p>
                      <p className="text-[10px] text-muted-foreground">{t.usage_count} uso(s)</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => toggleActive({ id: t.id, is_active: !t.is_active })}
                        aria-label={t.is_active ? 'Desativar' : 'Ativar'}
                      >
                        {t.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(t.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar template' : 'Novo template'}</DialogTitle>
            <DialogDescription>Os dados detalhados (caixa e itens) podem ser preenchidos depois clonando o template e editando como kit normal.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="tpl-name">Nome</Label>
                  <Input id="tpl-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-cat">Categoria</Label>
                  <Input id="tpl-cat" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-tag">Etiqueta</Label>
                  <Input id="tpl-tag" value={editing.tag} onChange={(e) => setEditing({ ...editing, tag: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="tpl-desc">Descrição</Label>
                  <Textarea id="tpl-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-price">Preço total estimado</Label>
                  <Input id="tpl-price" type="number" step="0.01" value={editing.total_price} onChange={(e) => setEditing({ ...editing, total_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <Label>Ativo</Label>
                  <div className="h-10 flex items-center">
                    <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c} type="button" aria-label={c}
                      onClick={() => setEditing({ ...editing, color: c })}
                      className={cn('w-7 h-7 rounded-full border-2', editing.color === c ? 'border-foreground ring-2 ring-primary/30' : 'border-border')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ícone</Label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_ICONS.map((name) => {
                    const Cmp = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
                    if (!Cmp) return null;
                    const active = editing.icon === name;
                    return (
                      <button
                        key={name} type="button" aria-label={name}
                        onClick={() => setEditing({ ...editing, icon: name })}
                        className={cn('h-9 rounded-md border flex items-center justify-center', active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}
                      >
                        <Cmp className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isUpserting || !editing?.name}>
              {isUpserting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação remove o template para todos os vendedores.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (deleteId) { await remove(deleteId); setDeleteId(null); } }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </>
  );
}
