import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { untypedFrom } from '@/lib/supabase-untyped';

export type AuditAction = 'DELETE' | 'INSERT' | 'UPDATE';

export type AuditEntityType =
  | 'categories'
  | 'color_variations'
  | 'companies'
  | 'company_contacts'
  | 'material_types'
  | 'order_items'
  | 'orders'
  | 'product_images'
  | 'product_variants'
  | 'product_videos'
  | 'products'
  | 'quote_items'
  | 'quotes'
  | 'suppliers';

interface AuditLogParams {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

/**
 * Hook para registrar ações de auditoria no sistema.
 * Registra INSERT, UPDATE e DELETE em entidades importantes.
 */
export function useAuditLog() {
  const { user } = useAuth();

  /**
   * Registra uma ação no log de auditoria
   */
  const logAction = async ({
    action,
    entityType,
    entityId,
    oldValues = null,
    newValues = null,
  }: AuditLogParams): Promise<{ success: boolean; error?: Error }> => {
    try {
      const { error } = await untypedFrom<AuditLogEntry>('audit_log').insert({
        user_id: user?.id || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      if (error) {
        logger.error('Erro ao registrar audit log:', error);
        return { success: false, error: new Error(error.message) };
      }

      return { success: true };
    } catch (error) {
      logger.error('Erro ao registrar audit log:', error);
      return { success: false, error: error as Error };
    }
  };

  /**
   * Helper para calcular apenas os campos alterados em um UPDATE
   */
  const getChangedFields = (
    oldRecord: Record<string, unknown>,
    newRecord: Record<string, unknown>,
  ): { oldFields: Record<string, unknown>; newFields: Record<string, unknown> } => {
    const oldFields: Record<string, unknown> = {};
    const newFields: Record<string, unknown> = {};

    Object.keys(newRecord).forEach((key) => {
      // Ignorar campos de timestamp que mudam automaticamente
      if (['updated_at', 'created_at'].includes(key)) return;

      const oldValue = oldRecord[key];
      const newValue = newRecord[key];

      // Comparar valores (convertendo para JSON para comparar objetos/arrays)
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        oldFields[key] = oldValue;
        newFields[key] = newValue;
      }
    });

    return { oldFields, newFields };
  };

  /**
   * Wrapper para CREATE com auditoria automática
   */
  const auditedInsert = async <T extends Record<string, unknown>>(
    table: AuditEntityType,
    data: T,
    insertFn: () => Promise<{ data: (T & { id: string }) | null; error: Error | null }>,
  ): Promise<{ data: (T & { id: string }) | null; error: Error | null }> => {
    const result = await insertFn();

    if (result.data && !result.error) {
      await logAction({
        action: 'INSERT',
        entityType: table,
        entityId: result.data.id,
        oldValues: null,
        newValues: data,
      });
    }

    return result;
  };

  /**
   * Wrapper para UPDATE com auditoria automática
   */
  const auditedUpdate = async <T extends Record<string, unknown>>(
    table: AuditEntityType,
    entityId: string,
    oldRecord: T,
    updates: Partial<T>,
    updateFn: () => Promise<{ data: T | null; error: Error | null }>,
  ): Promise<{ data: T | null; error: Error | null }> => {
    const result = await updateFn();

    if (result.data && !result.error) {
      const { oldFields, newFields } = getChangedFields(oldRecord, updates);

      // Só registra se houve mudanças reais
      if (Object.keys(newFields).length > 0) {
        await logAction({
          action: 'UPDATE',
          entityType: table,
          entityId,
          oldValues: oldFields,
          newValues: newFields,
        });
      }
    }

    return result;
  };

  /**
   * Wrapper para DELETE com auditoria automática
   */
  const auditedDelete = async <T extends Record<string, unknown>>(
    table: AuditEntityType,
    entityId: string,
    oldRecord: T,
    deleteFn: () => Promise<{ error: Error | null }>,
  ): Promise<{ error: Error | null }> => {
    const result = await deleteFn();

    if (!result.error) {
      await logAction({
        action: 'DELETE',
        entityType: table,
        entityId,
        oldValues: oldRecord,
        newValues: null,
      });
    }

    return result;
  };

  return {
    logAction,
    getChangedFields,
    auditedInsert,
    auditedUpdate,
    auditedDelete,
  };
}

/**
 * Busca histórico de auditoria para uma entidade específica
 */
export async function fetchAuditHistory(
  entityType: AuditEntityType,
  entityId: string,
): Promise<AuditLogEntry[]> {
  const { data, error } = await untypedFrom<AuditLogEntry>('audit_log')
    .select(
      `
      *,
      profiles:user_id (
        full_name,
        email
      )
    `,
    )
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Erro ao buscar histórico de auditoria:', error);
    return [];
  }

  return (data || []) as AuditLogEntry[];
}

/**
 * Busca todos os logs de auditoria (para admin)
 */
export async function fetchAllAuditLogs(
  filters?: {
    entityType?: AuditEntityType;
    action?: AuditAction;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  },
  limit = 100,
): Promise<AuditLogEntry[]> {
  let query = untypedFrom<AuditLogEntry>('audit_log')
    .select(
      `
      *,
      profiles:user_id (
        full_name,
        email
      )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }
  if (filters?.action) {
    query = query.eq('action', filters.action);
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate.toISOString());
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Erro ao buscar logs de auditoria:', error);
    return [];
  }

  return (data || []) as AuditLogEntry[];
}
