import { useState, useEffect, useCallback, useMemo } from 'react';
import { BackButton } from '@/components/common/BackButton';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/ui';
import { Shield, Key, Save, Users, CheckCircle2, XCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { PageSEO } from '@/components/seo/PageSEO';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { cn } from '@/lib/utils';

type AppRole = Database['public']['Enums']['app_role'];

interface Permission {
  code: string;
  label: string;
  description: string | null;
  category: string;
  created_at: string;
}

interface RolePermission {
  id: string;
  role: AppRole;
  permission_code: string;
}

const ROLES: Array<{ value: AppRole; label: string; description: string; icon: React.ReactNode }> =
  [
    {
      value: 'supervisor',
      label: 'Supervisor',
      description: 'Gestão comercial, descontos e cadastros',
      icon: <Shield className="h-5 w-5 text-primary" />,
    },
    {
      value: 'vendedor',
      label: 'Agente',
      description: 'Acesso somente aos próprios dados',
      icon: <Users className="h-5 w-5 text-primary" />,
    },
  ];

export default function RolePermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<AppRole>('supervisor');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const { toast } = useToast();

  const fetchData = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const [permRes, rolePermRes] = await Promise.all([
          supabase.from('permissions').select('*').order('category'),
          supabase.from('role_permissions').select('*'),
        ]);

        if (isCancelled()) return;
        if (permRes.error) throw permRes.error;
        if (rolePermRes.error) throw rolePermRes.error;

        setPermissions(permRes.data ?? []);
        setRolePermissions(rolePermRes.data ?? []);
      } catch (error: unknown) {
        if (isCancelled()) return;
        toast({
          title: 'Erro ao carregar dados',
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
    void fetchData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const hasPermission = (permissionId: string, role: AppRole): boolean => {
    const key = `${role}-${permissionId}`;
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key) ?? false;
    }
    return rolePermissions.some((rp) => rp.role === role && rp.permission_code === permissionId);
  };

  const togglePermission = (permissionId: string, role: AppRole) => {
    const key = `${role}-${permissionId}`;
    const currentValue = hasPermission(permissionId, role);

    const newChanges = new Map(pendingChanges);
    const originalValue = rolePermissions.some(
      (rp) => rp.role === role && rp.permission_code === permissionId,
    );

    if (currentValue === originalValue) {
      newChanges.set(key, !currentValue);
    } else {
      newChanges.delete(key);
    }

    setPendingChanges(newChanges);
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setIsSaving(true);
    try {
      const toAdd: Array<{ role: AppRole; permission_code: string }> = [];
      const toRemove: Array<{ role: AppRole; permission_code: string }> = [];

      pendingChanges.forEach((shouldHave, key) => {
        const [role, permissionId] = key.split('-') as [AppRole, string];
        if (shouldHave) {
          toAdd.push({ role, permission_code: permissionId });
        } else {
          toRemove.push({ role, permission_code: permissionId });
        }
      });

      // Remove permissions
      for (const item of toRemove) {
        await supabase
          .from('role_permissions')
          .delete()
          .eq('role', item.role)
          .eq('permission_code', item.permission_code);
      }

      // Add permissions
      if (toAdd.length > 0) {
        await supabase.from('role_permissions').insert(toAdd);
      }

      toast({ title: 'Permissões atualizadas com sucesso!' });
      setPendingChanges(new Map());
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Erro ao salvar', description: sanitizeError(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectAllForRole = (role: AppRole, category?: string) => {
    const newChanges = new Map(pendingChanges);
    const permsToSelect = category
      ? permissions.filter((p) => p.category === category)
      : permissions;

    permsToSelect.forEach((perm) => {
      const key = `${role}-${perm.code}`;
      const alreadyHas = rolePermissions.some(
        (rp) => rp.role === role && rp.permission_code === perm.code,
      );
      if (!alreadyHas) {
        newChanges.set(key, true);
      }
    });

    setPendingChanges(newChanges);
  };

  const deselectAllForRole = (role: AppRole, category?: string) => {
    const newChanges = new Map(pendingChanges);
    const permsToDeselect = category
      ? permissions.filter((p) => p.category === category)
      : permissions;

    permsToDeselect.forEach((perm) => {
      const key = `${role}-${perm.code}`;
      const alreadyHas = rolePermissions.some(
        (rp) => rp.role === role && rp.permission_code === perm.code,
      );
      if (alreadyHas) {
        newChanges.set(key, false);
      } else {
        newChanges.delete(key);
      }
    });

    setPendingChanges(newChanges);
  };

  const groupedPermissions = useMemo(
    () =>
      permissions.reduce(
        (acc, perm) => {
          if (!acc[perm.category]) acc[perm.category] = [];
          acc[perm.category].push(perm);
          return acc;
        },
        {} as Record<string, Permission[]>,
      ),
    [permissions],
  );

  const getCategoryStats = (category: string, role: AppRole) => {
    const categoryPerms = groupedPermissions[category] ?? [];
    const assigned = categoryPerms.filter((p) => hasPermission(p.code, role)).length;
    return { assigned, total: categoryPerms.length };
  };

  const getTotalStats = (role: AppRole) => {
    const assigned = permissions.filter((p) => hasPermission(p.code, role)).length;
    return { assigned, total: permissions.length };
  };

  return (
    <div className="space-y-6">
      <PageSEO
        title="Permissões por Role"
        description="Configure permissões associadas a cada perfil de acesso."
        path="/admin/role-permissoes"
        noIndex
      />
      <header className="-mx-3 -mt-3 mb-6 flex h-16 shrink-0 items-center gap-2 border-b px-4 sm:-mx-4 sm:-mt-4 lg:-mx-6 lg:-mt-6">
        <BackButton fallbackPath="/admin" />
        <div className="flex flex-1 items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold">
              Gerenciamento de Permissões por Role
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure quais permissões cada role possui
            </p>
          </div>
          {pendingChanges.size > 0 && (
            <Button onClick={saveChanges} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Salvando...' : `Salvar ${pendingChanges.size} alteração(ões)`}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1920px] animate-fade-in">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Role Cards Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            {ROLES.map((role) => {
              const stats = getTotalStats(role.value);
              return (
                <Card
                  key={role.value}
                  className={cn(
                    'cursor-pointer transition-all',
                    selectedRole === role.value ? 'ring-2 ring-primary' : 'hover:border-primary/50',
                  )}
                  onClick={() => setSelectedRole(role.value)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {role.icon}
                        <div>
                          <CardTitle className="text-base">{role.label}</CardTitle>
                          <CardDescription className="text-xs">{role.description}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={selectedRole === role.value ? 'default' : 'secondary'}>
                        {stats.assigned}/{stats.total}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(stats.assigned / stats.total) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Permissions Matrix */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  <CardTitle>
                    Permissões para: {ROLES.find((r) => r.value === selectedRole)?.label}
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllForRole(selectedRole)}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Marcar Todas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deselectAllForRole(selectedRole)}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Desmarcar Todas
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : (
                <Tabs defaultValue={Object.keys(groupedPermissions)[0]} className="w-full">
                  <TabsList className="mb-4 h-auto flex-wrap gap-1">
                    {Object.keys(groupedPermissions).map((category) => {
                      const stats = getCategoryStats(category, selectedRole);
                      return (
                        <TabsTrigger key={category} value={category} className="capitalize">
                          {category}
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {stats.assigned}/{stats.total}
                          </Badge>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <TabsContent key={category} value={category}>
                      <div className="rounded-lg border">
                        <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
                          <span className="font-medium capitalize">{category}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => selectAllForRole(selectedRole, category)}
                            >
                              Marcar Categoria
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deselectAllForRole(selectedRole, category)}
                            >
                              Desmarcar Categoria
                            </Button>
                          </div>
                        </div>
                        <ScrollArea className="max-h-[400px]">
                          <div className="divide-y">
                            {perms.map((perm) => {
                              const isChecked = hasPermission(perm.code, selectedRole);
                              const key = `${selectedRole}-${perm.code}`;
                              const hasChange = pendingChanges.has(key);

                              return (
                                <div
                                  key={perm.code}
                                  className={cn(
                                    'flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30',
                                    hasChange && 'bg-primary/5',
                                  )}
                                >
                                  <Checkbox
                                    id={perm.code}
                                    checked={isChecked}
                                    onCheckedChange={() =>
                                      togglePermission(perm.code, selectedRole)
                                    }
                                  />
                                  <div className="min-w-0 flex-1">
                                    <label
                                      htmlFor={perm.code}
                                      className="block cursor-pointer font-medium"
                                    >
                                      {perm.label}
                                    </label>
                                    <p className="truncate text-sm text-muted-foreground">
                                      {perm.description || perm.code}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="shrink-0">
                                    {perm.code}
                                  </Badge>
                                  {hasChange && (
                                    <Badge variant="secondary" className="shrink-0 text-xs">
                                      modificado
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Comparison View */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparação de Permissões por Role</CardTitle>
              <CardDescription>Visualize rapidamente as diferenças entre roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Permissão</th>
                      {ROLES.map((role) => (
                        <th key={role.value} className="px-3 py-2 text-center font-medium">
                          {role.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {permissions.map((perm) => (
                      <tr key={perm.code} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{perm.label}</div>
                          <div className="text-xs text-muted-foreground">{perm.code}</div>
                        </td>
                        {ROLES.map((role) => {
                          const has = hasPermission(perm.code, role.value);
                          const key = `${role.value}-${perm.code}`;
                          const hasChange = pendingChanges.has(key);

                          return (
                            <td key={role.value} className="px-3 py-2 text-center">
                              <Checkbox
                                checked={has}
                                onCheckedChange={() => togglePermission(perm.code, role.value)}
                                className={hasChange ? 'border-primary' : ''}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
