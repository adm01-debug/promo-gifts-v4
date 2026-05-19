import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type AppRole, type UserWithRole } from "./types";

export function useUserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("id, user_id, full_name, email, avatar_url, is_active, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          role: (userRole?.role as AppRole) || "vendedor",
          created_at: profile.created_at,
          is_active: profile.is_active,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
      if (error) throw error;

      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u)));
      const label =
        newRole === "dev" ? "Dev"
        : newRole === "supervisor" || newRole === "admin" || newRole === "manager" ? "Supervisor"
        : "Agente";
      toast.success(`Usuário alterado para ${label}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar permissão");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateUser = async (form: { full_name: string; email: string; password: string; role: AppRole }) => {
    if (!form.email || !form.password) {
      toast.error("Email e senha são obrigatórios");
      return false;
    }
    if (form.password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return false;
    }
    if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password) || !/[!@#$%^&*(),.?":{}|<>]/.test(form.password)) {
      toast.error("A senha deve conter maiúscula, minúscula, número e caractere especial");
      return false;
    }
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), role: form.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado com sucesso");
      await fetchUsers();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes("already been registered") || msg.toLowerCase().includes("already exists")) {
        toast.error("Este e-mail já está cadastrado", { description: "Já existe um usuário com este e-mail no sistema." });
      } else {
        toast.error("Erro ao criar usuário", { description: msg });
      }
      return false;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário excluído com sucesso");
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      return true;
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      toast.error("Erro ao excluir usuário", { description: error instanceof Error ? error.message : String(error) });
      return false;
    }
  };

  const handleSaveEdit = async (userId: string, form: { full_name: string; email: string; is_active: boolean }) => {
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name.trim() || null,
        email: form.email.trim() || null,
        is_active: form.is_active,
      }).eq("user_id", userId);
      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId
            ? { ...u, full_name: form.full_name.trim() || null, email: form.email.trim() || null, is_active: form.is_active }
            : u
        )
      );
      toast.success("Usuário atualizado com sucesso");
      return true;
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      toast.error("Erro ao atualizar usuário", { description: error instanceof Error ? error.message : String(error) });
      return false;
    }
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return null;
    }
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", userId);
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, avatar_url: publicUrl } : u));
      toast.success("Foto atualizada com sucesso");
      return publicUrl;
    } catch (error: unknown) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao enviar foto", { description: error instanceof Error ? error.message : String(error) });
      return null;
    }
  };

  const handleRemoveAvatar = async (userId: string) => {
    try {
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", userId);
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, avatar_url: null } : u));
      toast.success("Foto removida");
      return true;
    } catch {
      toast.error("Erro ao remover foto");
      return false;
    }
  };

  return {
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
  };
}
