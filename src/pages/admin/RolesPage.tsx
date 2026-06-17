import { useState, useEffect, useCallback } from 'react';
import { type createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// 'roles' table not yet in generated schema — bypass type checking via raw client cast
const db = supabase as unknown as ReturnType<typeof createClient>;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Shield, Plus, Edit, Trash2, Users } from 'lucide-react';
import { BackButton } from '@/components/common/BackButton';
import { PageSEO } from '@/components/seo/PageSEO';
import { sanitizeError } from '@/lib/security/sanitize-error';

interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const { toast } = useToast();

  const fetchRoles = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const { data, error } = await db.from('roles').select('*').order('name');

        if (isCancelled()) return;
        if (error) throw error;
        setRoles(data ?? []);
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
    // Guarda de cancelamento: evita setState após o unmount (em testes, o
    // await pode resolver depois do teardown e vazar "window is not defined").
    let cancelled = false;
    void fetchRoles(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchRoles]);

  const handleSubmit = async () => {
    try {
      if (editingRole) {
        const { error } = await db
          .from('roles')
          .update({ name: formData.name, description: formData.description } as never)
          .eq('id', editingRole.id);
        if (error) throw error;
        toast({ title: 'Role atualizada com sucesso' });
      } else {
        const { error } = await db
          .from('roles')
          .insert({ name: formData.name, description: formData.description } as never);
        if (error) throw error;
        toast({ title: 'Role criada com sucesso' });
      }
      setIsDialogOpen(false);
      setEditingRole(null);
      setFormData({ name: '', description: '' });
      fetchRoles();
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: sanitizeError(error),
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await db.from('roles').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Role excluída com sucesso' });
      fetchRoles();
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: sanitizeError(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageSEO
        title="Roles"
        description="Gerencie perfis de acesso do sistema."
        path="/admin/roles"
        noIndex
      />
      <header className="-mx-3 -mt-3 mb-6 flex h-16 shrink-0 items-center gap-2 border-b px-4 sm:-mx-4 sm:-mt-4 lg:-mx-6 lg:-mt-6">
        <BackButton fallbackPath="/admin" />
        <div className="flex-1">
          <h1 className="font-display text-lg font-semibold">Gestão de Roles</h1>
        </div>
      </header>
      <main className="mx-auto max-w-[1920px] animate-fade-in">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Roles do Sistema
                </CardTitle>
                <CardDescription>Gerencie as roles de acesso do sistema</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingRole(null);
                      setFormData({ name: '', description: '' });
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingRole ? 'Editar Role' : 'Nova Role'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="ex: manager"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descrição da role..."
                      />
                    </div>
                    <Button onClick={handleSubmit} className="w-full">
                      {editingRole ? 'Atualizar' : 'Criar'}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <Badge variant="outline" className="flex w-fit items-center gap-1">
                            <Users className="h-3 w-3" />
                            {role.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {role.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Editar"
                              onClick={() => handleEdit(role)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Excluir"
                              onClick={() => handleDelete(role.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
