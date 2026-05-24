import { useState, useEffect } from 'react';
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
import { PageSEO } from "@/components/seo/PageSEO";

type AppRole = Database['public']['Enums']['app_role'];

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

interface RolePermission {
  id: string;
  role: AppRole;
  permission_id: string;
}

const ROLES: { value: AppRole; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'supervisor',
    label: 'Supervisor',
    description: 'Gestão comercial, descontos e cadastros',
    icon: <Shield className="h-5 w-5 text-primary" />
  },
  {
    value: 'vendedor',
    label: 'Agente',
    description: 'Acesso somente aos próprios dados',
    icon: <Users className="h-5 w-5 text-primary" />
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

  useEffect(() => {
    // Guarda de cancelamento: evita setState após o unmount (em testes, o
    // await pode resolver depois do teardown e vazar "window is not defined").
    let cancelled = false;
    fetchData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = async (isCancelled: () => boolean = () => false) => {
    try {
      const [permRes, rolePermRes] = await Promise.all([
        supabase.from('permissions').select('*').order('category'),
        supabase.from('role_permissions').select('*'),
      ]);

      if (isCancelled()) return;
      if (permRes.error) throw permRes.error;
      if (rolePermRes.error) throw rolePermRes.error;

      setPermissions(permRes.data || []);
      setRolePermissions(rolePermRes.data || []);
    } catch (error: unknown) {
      if (isCancelled()) return;
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } finally {
      if (!isCancelled()) setIsLoading(false);
    }
  };

  const hasPermission = (permissionId: string, role: AppRole): boolean => {
    const key = `${role}-${permissionId}`;
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key)!;
    }
    return rolePermissions.some(rp => rp.role === role && rp.permission_id === permissionId);
  };

  const togglePermission = (permissionId: string, role: AppRole) => {
    const key = `${role}-${permissionId}`;
    const currentValue = hasPermission(permissionId, role);
    
    const newChanges = new Map(pendingChanges);
    const originalValue = rolePermissions.some(rp => rp.role === role && rp.permission_id === permissionId);
    
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
      const toAdd: { role: AppRole; permission_id: string }[] = [];
      const toRemove: { role: AppRole; permission_id: string }[] = [];

      pendingChanges.forEach((shouldHave, key) => {
        const [role, permissionId] = key.split('-') as [AppRole, string];
        if (shouldHave) {
          toAdd.push({ role, permission_id: permissionId });
        } else {
          toRemove.push({ role, permission_id: permissionId });
        }
      });

      // Remove permissions
      for (const item of toRemove) {
        await supabase
          .from('role_permissions')
          .delete()
          .eq('role', item.role)
          .eq('permission_id', item.permission_id);
      }

      // Add permissions
      if (toAdd.length > 0) {
        await supabase.from('role_permissions').insert(toAdd);
      }

      toast({ title: 'Permissões atualizadas com sucesso!' });
      setPendingChanges(new Map());
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectAllForRole = (role: AppRole, category?: string) => {
    const newChanges = new Map(pendingChanges);
    const permsToSelect = category 
      ? permissions.filter(p => p.category === category)
      : permissions;
    
    permsToSelect.forEach(perm => {
      const key = `${role}-${perm.id}`;
      const alreadyHas = rolePermissions.some(rp => rp.role === role && rp.permission_id === perm.id);
      if (!alreadyHas) {
        newChanges.set(key, true);
      }
    });
    
    setPendingChanges(newChanges);
  };

  const deselectAllForRole = (role: AppRole, category?: string) => {
    const newChanges = new Map(pendingChanges);
    const permsToDeselect = category 
      ? permissions.filter(p => p.category === category)
      : permissions;
    
    permsToDeselect.forEach(perm => {
      const key = `${role}-${perm.id}`;
      const alreadyHas = rolePermissions.some(rp => rp.role === role && rp.permission_id === perm.id);
      if (alreadyHas) {
        newChanges.set(key, false);
      } else {
        newChanges.delete(key);
      }
    });
    
    setPendingChanges(newChanges);
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getCategoryStats = (category: string, role: AppRole) => {
    const categoryPerms = groupedPermissions[category] || [];
    const assigned = categoryPerms.filter(p => hasPermission(p.id, role)).length;
    return { assigned, total: categoryPerms.length };
  };

  const getTotalStats = (role: AppRole) => {
    const assigned = permissions.filter(p => hasPermission(p.id, role)).length;
    return { assigned, total: permissions.length };
  };

  return (
    <div className="space-y-6">
      <PageSEO title="Permissões por Role" description="Configure permissões associadas a cada perfil de acesso." path="/admin/role-permissoes" noIndex />
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 -mx-3 sm:-mx-4 lg:-mx-6 -mt-3 sm:-mt-4 lg:-mt-6 mb-6">
        <BackButton fallbackPath="/admin" />
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold">Gerenciamento de Permissões por Role</h1>
            <p className="text-sm text-muted-foreground">Configure quais permissões cada role possui</p>
          </div>
          {pendingChanges.size > 0 && (
            <Button onClick={saveChanges} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Salvando...' : `Salvar ${pendingChanges.size} alteração(ões)`}
            </Button>
          )}
        </div>
      </header>
      
      <main className="max-w-[1920px] mx-auto animate-fade-in">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Role Cards Overview */}
              <div className="grid gap-4 md:grid-cols-2">
                {ROLES.map(role => {
                  const stats = getTotalStats(role.value);
                  return (
                    <Card 
                      key={role.value} 
                      className={`cursor-pointer transition-all ${selectedRole === role.value ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
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
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                      <CardTitle>Permissões para: {ROLES.find(r => r.value === selectedRole)?.label}</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => selectAllForRole(selectedRole)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar Todas
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deselectAllForRole(selectedRole)}>
                        <XCircle className="h-4 w-4 mr-1" />
                        Desmarcar Todas
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : (
                    <Tabs defaultValue={Object.keys(groupedPermissions)[0]} className="w-full">
                      <TabsList className="flex-wrap h-auto gap-1 mb-4">
                        {Object.keys(groupedPermissions).map(category => {
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
                          <div className="border rounded-lg">
                            <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
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
                                {perms.map(perm => {
                                  const isChecked = hasPermission(perm.id, selectedRole);
                                  const key = `${selectedRole}-${perm.id}`;
                                  const hasChange = pendingChanges.has(key);
                                  
                                  return (
                                    <div 
                                      key={perm.id} 
                                      className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors ${hasChange ? 'bg-primary/5' : ''}`}
                                    >
                                      <Checkbox 
                                        id={perm.id}
                                        checked={isChecked}
                                        onCheckedChange={() => togglePermission(perm.id, selectedRole)}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <label 
                                          htmlFor={perm.id}
                                          className="font-medium cursor-pointer block"
                                        >
                                          {perm.name}
                                        </label>
                                        <p className="text-sm text-muted-foreground truncate">
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
                          <th className="text-left py-2 px-3 font-medium">Permissão</th>
                          {ROLES.map(role => (
                            <th key={role.value} className="text-center py-2 px-3 font-medium">
                              {role.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {permissions.map(perm => (
                          <tr key={perm.id} className="hover:bg-muted/30">
                            <td className="py-2 px-3">
                              <div className="font-medium">{perm.name}</div>
                              <div className="text-xs text-muted-foreground">{perm.code}</div>
                            </td>
                            {ROLES.map(role => {
                              const has = hasPermission(perm.id, role.value);
                              const key = `${role.value}-${perm.id}`;
                              const hasChange = pendingChanges.has(key);
                              
                              return (
                                <td key={role.value} className="text-center py-2 px-3">
                                  <Checkbox 
                                    checked={has}
                                    onCheckedChange={() => togglePermission(perm.id, role.value)}
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
