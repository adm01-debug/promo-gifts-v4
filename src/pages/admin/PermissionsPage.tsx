import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/ui';
import { Key, Plus, Edit, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/common/BackButton';
import { PageSEO } from '@/components/seo/PageSEO';
import { sanitizeError } from '@/lib/security/sanitize-error';

interface Permission {
  code: string;
  label: string;
  description: string | null;
  category: string;
  created_at: string;
}

const CATEGORIES = [
  'geral',
  'produtos',
  'orcamentos',
  'pedidos',
  'clientes',
  'admin',
  'relatorios',
];

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    description: '',
    category: 'geral',
  });
  const { toast } = useToast();

  const fetchPermissions = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const { data, error } = await supabase
          .from('permissions')
          .select('*')
          .order('category', { ascending: true });

        if (isCancelled()) return;
        if (error) throw error;
        setPermissions(data ?? []);
      } catch (error: unknown) {
        if (isCancelled()) return;
        toast({
          title: 'Erro',
          description: sanitizeError(error),
          variant: 'destructive',
        });
      } finally {
        if (!isCancelled()) setIsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    // Guarda de cancelamento: evita setState após o unmount.
    let cancelled = false;
    void fetchPermissions(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchPermissions]);

  const handleSubmit = async () => {
    try {
      if (editingPermission) {
        const { error } = await supabase
          .from('permissions')
          .update(formData)
          .eq('code', editingPermission.code);
        if (error) throw error;
        toast({ title: 'Permissão atualizada com sucesso' });
      } else {
        const { error } = await supabase.from('permissions').insert(formData);
        if (error) throw error;
        toast({ title: 'Permissão criada com sucesso' });
      }
      setIsDialogOpen(false);
      setEditingPermission(null);
      setFormData({ code: '', label: '', description: '', category: 'geral' });
      fetchPermissions();
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: sanitizeError(error),
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (permission: Permission) => {
    setEditingPermission(permission);
    setFormData({
      code: permission.code,
      label: permission.label,
      description: permission.description ?? '',
      category: permission.category,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (code: string) => {
    try {
      const { error } = await supabase.from('permissions').delete().eq('code', code);
      if (error) throw error;
      toast({ title: 'Permissão excluída com sucesso' });
      fetchPermissions();
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: sanitizeError(error),
        variant: 'destructive',
      });
    }
  };

  const groupedPermissions = useMemo(
    () =>
      permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
      }, {}),
    [permissions],
  );

  return (
    <div className="space-y-6">
      <PageSEO
        title="Permissões"
        description="Gerencie permissões de acesso do sistema."
        path="/admin/permissoes"
        noIndex
      />
      <header className="-mx-3 -mt-3 mb-6 flex h-16 shrink-0 items-center gap-2 border-b px-4 sm:-mx-4 sm:-mt-4 lg:-mx-6 lg:-mt-6">
        <BackButton fallbackPath="/admin" />
        <div className="flex-1">
          <h1 className="font-display text-lg font-semibold">Gestão de Permissões</h1>
        </div>
      </header>
      <main className="mx-auto max-w-[1920px] animate-fade-in">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Permissões do Sistema
                </CardTitle>
                <CardDescription>Gerencie as permissões de acesso</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingPermission(null);
                      setFormData({ code: '', label: '', description: '', category: 'geral' });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Permissão
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingPermission ? 'Editar Permissão' : 'Nova Permissão'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Código</Label>
                      <Input
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="ex: view_products"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={formData.label}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        placeholder="ex: Visualizar Produtos"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(v) => setFormData({ ...formData, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descrição da permissão..."
                      />
                    </div>
                    <Button onClick={handleSubmit} className="w-full">
                      {editingPermission ? 'Atualizar' : 'Criar'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category}>
                      <h3 className="mb-2 font-display font-medium capitalize">{category}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {perms.map((perm) => (
                            <TableRow key={perm.code}>
                              <TableCell>
                                <Badge variant="secondary">{perm.code}</Badge>
                              </TableCell>
                              <TableCell>{perm.label}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {perm.description || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Editar"
                                    onClick={() => handleEdit(perm)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Excluir"
                                    onClick={() => handleDelete(perm.code)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
