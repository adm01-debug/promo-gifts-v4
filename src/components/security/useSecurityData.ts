/**
 * useSecurityData — Hook que carrega métricas, logins e alertas de segurança
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { type createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// 'notifications' table not yet in generated schema — bypass type checking via raw client cast
const db = supabase as unknown as ReturnType<typeof createClient>;
import { use2FA } from '@/hooks/auth';
import { useAllowedIPs } from '@/hooks/admin';

import { logger } from '@/lib/logger';
export interface SecurityMetrics {
  score: number;
  mfaEnabled: boolean;
  ipRestrictionsActive: boolean;
  knownDevicesCount: number;
  recentLoginAttempts: number;
  failedLoginAttempts: number;
  securityAlerts: number;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  success: boolean;
  failure_reason: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SecurityNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const defaultMetrics: SecurityMetrics = {
  score: 0,
  mfaEnabled: false,
  ipRestrictionsActive: false,
  knownDevicesCount: 0,
  recentLoginAttempts: 0,
  failedLoginAttempts: 0,
  securityAlerts: 0,
};

export function useSecurityData(
  effectiveUserId: string | undefined,
  isManagingOther: boolean,
  selectedUserId: string | null,
) {
  const { is2FAEnabled, isLoading: is2FALoading } = use2FA(
    isManagingOther ? (selectedUserId ?? undefined) : undefined,
  );
  const { allowedIPs } = useAllowedIPs();
  const [metrics, setMetrics] = useState<SecurityMetrics>(defaultMetrics);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Guarda de montagem: evita setState após o unmount (await que resolve
  // após o teardown vaza "window is not defined" em testes).
  const mountedRef = useRef(true);

  const loadSecurityData = useCallback(async () => {
    if (!effectiveUserId) return;
    if (mountedRef.current) setIsLoading(true);
    try {
      const { data: attempts } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!mountedRef.current) return;
      setLoginAttempts((attempts as LoginAttempt[]) ?? []);

      const { count: devicesCount } = await supabase
        .from('user_known_devices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId);

      const { data: notifs } = await db
        .from('notifications')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('type', 'security')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!mountedRef.current) return;
      const typedNotifs = notifs as SecurityNotification[] | null;
      setNotifications(typedNotifs ?? []);

      const failedAttempts = attempts?.filter((a) => !a.success).length || 0;
      const unreadAlerts = typedNotifs?.filter((n) => !n.is_read).length || 0;

      let score = 40;
      if (is2FAEnabled) score += 30;
      if (allowedIPs.length > 0) score += 20;
      if (devicesCount && devicesCount > 0) score += 10;
      if (failedAttempts > 5) score -= 10;

      setMetrics({
        score: Math.min(100, Math.max(0, score)),
        mfaEnabled: is2FAEnabled,
        ipRestrictionsActive: allowedIPs.length > 0,
        knownDevicesCount: devicesCount || 0,
        recentLoginAttempts: attempts?.length || 0,
        failedLoginAttempts: failedAttempts,
        securityAlerts: unreadAlerts,
      });
    } catch (error) {
      if (!mountedRef.current) return;
      logger.error('Error loading security data:', error);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [effectiveUserId, is2FAEnabled, allowedIPs]);

  useEffect(() => {
    mountedRef.current = true;
    if (effectiveUserId) loadSecurityData();
    return () => {
      mountedRef.current = false;
    };
  }, [effectiveUserId, loadSecurityData]);

  return {
    metrics,
    loginAttempts,
    notifications,
    isLoading,
    is2FAEnabled,
    is2FALoading,
    allowedIPs,
  };
}

// Score helpers
export function getScoreColor(score: number) {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  if (score >= 40) return 'text-brand-primary';
  return 'text-destructive';
}

export function getScoreProgressColor(score: number) {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-warning';
  if (score >= 40) return 'bg-brand-primary';
  return 'bg-destructive';
}

export function getScoreLabel(score: number) {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bom';
  if (score >= 40) return 'Regular';
  return 'Crítico';
}
