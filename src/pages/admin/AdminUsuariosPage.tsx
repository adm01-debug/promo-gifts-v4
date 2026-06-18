import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageSEO } from '@/components/seo/PageSEO';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  UserCog,
  Loader2,
  KeyRound,
  Plus,
  Search,
  Percent,
  ArrowUpCircle,
  History,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PasswordResetApproval } from '@/components/admin/PasswordResetApproval';
import { DiscountManagementPanel } from '@/components/admin/DiscountManagementPanel';
import { usePasswordResetRequests } from '@/hooks/auth';

import { useUserManagement } from '@/components/admin/users/useUserManagement';
import { UserStatsCards } from '@/components/admin/users/UserStatsCards';
import { UserTable } from '@/components/admin/users/UserTable';
import { RoleChangeDialog } from '@/components/admin/users/RoleChangeDialog';
import { EditUserDialog } from '@/components/admin/users/EditUserDialog';
import { CreateUserDialog } from '@/components/admin/users/CreateUserDialog';
import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';
import { PromotionDialog } from '@/components/admin/users/PromotionDialog';
import { RoleAuditLogPanel } from '@/components/admin/users/RoleAuditLogPanel';
import { DevAccessAuditAlert } from '@/components/admin/DevAccessAuditAlert';
import { type UserWithRole } from '@/components/admin/users/types';

const VALID_TABS = ['users', 'password-reset', 'discounts', 'audit'] as const;
type TabValue = (typeof VALID_TABS)[number];

export default function AdminUsuariosPage() {
  const { user, isAdmin, isDev } = useAuth();
  const { pendingCount } = usePasswordResetRequests();
  const {
    users,
    isLoading,
    updatingUserId,
    fetchUsers,
    handleRoleChange,
    handleCreateUser,
    handleDeleteUser,
    handleSaveEdit,
    handleAvatarUpload,
    handleRemoveAvatar,
  } = useUserManagement();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: TabValue = (VALID_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as TabValue)
    : 'users';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    const next = new URLSearchParams(searchParams);
    if (value === 'users') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  // Pending discount approvals badge
  const { data: pendingDiscountCount = 0 } = useQuery({
    queryKey: ['pending-discount-approvals-count'],
    queryFn: async () => {
      const { count } = await supabase
        // rls-allow: admin-only; RLS filtra
        .from('discount_approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count ?? 0;
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<UserWithRole | null>(null);
  const [editDialogUser, setEditDialogUser] = useState<UserWithRole | null>(null);
  const [deleteDialogUser, setDeleteDialogUser] = useState<UserWithRole | null>(null);
  const [promoteDialogUser, setPromoteDialogUser] = useState<UserWithRole | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const devCount = useMemo(() => users.filter((u) => u.role === 'dev').length, [users]);
  const supervisorCount = useMemo(
    () =>
      users.filter((u) => u.role === 'supervisor' || u.role === 'admin' || u.role === 'manager')
        .length,
    [users],
  );
  const agenteCount = useMemo(() => users.filter((u) => u.role === 'vendedor').length, [users]);

  const filteredUsers = useMemo(
    () =>
      users
        .sort((a, b) =>
          (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR', { sensitivity: 'base' }),
        )
        .filter((u) => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            (u.full_name ?? '').toLowerCase().includes(q) ||
            (u.email ?? '').toLowerCase().includes(q)
          );
        }),
    [users, searchQuery],
  );

  return (
    <>
      <PageSEO
        title="Gerenciar Usuários"
        description="Administre usuários, permissões e roles do sistema."
        path="/admin/usuarios"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <UserCog className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1
              data-testid="page-title-usuarios"
              className="font-display text-3xl font-bold tracking-tight"
            >
              Usuários
            </h1>
            <p className="text-muted-foreground">
              Gerencie usuários, roles e aprovações de reset de senha
            </p>
          </div>
        </div>

        <DevAccessAuditAlert />

        <UserStatsCards
          total={users.length}
          devCount={devCount}
          supervisorCount={supervisorCount}
          agenteCount={agenteCount}
          pendingCount={pendingCount}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários & Roles
            </TabsTrigger>
            <TabsTrigger value="password-reset" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Reset de Senha
              {pendingCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
                >
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="discounts" className="gap-2">
                <Percent className="h-4 w-4" />
                Gestão de Descontos
                {pendingDiscountCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
                  >
                    {pendingDiscountCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {isDev && (
              <TabsTrigger value="audit" className="gap-2">
                <History className="h-4 w-4" />
                Auditoria de Roles
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Gerenciamento de Usuários e Roles</CardTitle>
                  <CardDescription>
                    Atribua roles aos usuários: Dev (técnico), Supervisor (gestão comercial) ou
                    Agente (acesso básico)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" className="gap-2">
                    <Link to="/admin/usuarios/promover">
                      <ArrowUpCircle className="h-4 w-4" />
                      Promover Agente
                    </Link>
                  </Button>
                  <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Usuário
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    {searchQuery
                      ? 'Nenhum usuário encontrado para esta busca'
                      : 'Nenhum usuário encontrado'}
                  </div>
                ) : (
                  <UserTable
                    users={filteredUsers}
                    currentUserId={user?.id}
                    updatingUserId={updatingUserId}
                    onEditUser={setEditDialogUser}
                    onChangeRole={setRoleDialogUser}
                    onDeleteUser={setDeleteDialogUser}
                    onPromoteUser={setPromoteDialogUser}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password-reset">
            <PasswordResetApproval />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="discounts">
              <DiscountManagementPanel />
            </TabsContent>
          )}

          {isDev && (
            <TabsContent value="audit">
              <RoleAuditLogPanel />
            </TabsContent>
          )}
        </Tabs>

        {/* Dialogs */}
        <RoleChangeDialog
          user={roleDialogUser}
          onClose={() => setRoleDialogUser(null)}
          onConfirm={handleRoleChange}
        />
        <EditUserDialog
          user={editDialogUser}
          onClose={() => setEditDialogUser(null)}
          onSave={handleSaveEdit}
          onUploadAvatar={handleAvatarUpload}
          onRemoveAvatar={handleRemoveAvatar}
        />
        <CreateUserDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onCreate={handleCreateUser}
        />
        <DeleteUserDialog
          user={deleteDialogUser}
          onClose={() => setDeleteDialogUser(null)}
          onConfirm={handleDeleteUser}
        />
        <PromotionDialog
          user={promoteDialogUser}
          targetRole="supervisor"
          open={!!promoteDialogUser}
          onOpenChange={(open) => {
            if (!open) setPromoteDialogUser(null);
          }}
          onSuccess={() => {
            void fetchUsers();
          }}
        />
      </div>
    </>
  );
}
