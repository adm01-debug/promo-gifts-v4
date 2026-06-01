/**
 * Tipos do módulo de gestão de usuários.
 *
 * A configuração visual de roles foi movida para `@/lib/roles`
 * (use `RoleBadge` ou `getRoleVisual` em vez de `roleConfig`).
 */
import { ROLE_VISUAL, type AppRole } from '@/lib/roles';

export type { AppRole };

export interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: AppRole;
  created_at: string;
  is_active: boolean | null;
}

/** @deprecated Use `RoleBadge` ou `getRoleVisual` de `@/lib/roles`. */
export const roleConfig = ROLE_VISUAL;
