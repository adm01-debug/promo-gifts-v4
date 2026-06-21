/**
 * useKitCollaboration — colaboradores e comentários do kit (com realtime).
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { logger } from '@/lib/logger';

export interface KitCollaboratorRow {
  id: string;
  kit_id: string;
  user_id: string;
  permission: 'edit' | 'view';
  invited_email: string | null;
  created_at: string;
}

export interface KitCommentRow {
  id: string;
  kit_id: string;
  author_id: string;
  parent_id: string | null;
  item_anchor: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
}

export function useKitCollaborators(kitId: string | undefined) {
  const qc = useQueryClient();
  const key = ['kit-collaborators', kitId] as const;

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!kitId) return [];
      const { data, error } = await supabase
        .from('kit_collaborators')
        .select('*')
        .eq('kit_id', kitId);
      if (error) throw error;
      return (data || []) as unknown as KitCollaboratorRow[];
    },
    enabled: !!kitId,
  });

  const invite = useMutation({
    mutationFn: async ({ email, permission }: { email: string; permission: 'edit' | 'view' }) => {
      if (!kitId) throw new Error('Kit não definido');
      // Resolve email -> user_id via profiles
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile?.user_id) throw new Error('Usuário não encontrado para esse email');
      const { error } = await supabase.from('kit_collaborators').insert({
        kit_id: kitId,
        user_id: profile.user_id,
        permission,
        invited_email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success('Colaborador convidado');
    },
    onError: (e: Error) => toast.error('Operação falhou', { description: sanitizeError(e) }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kit_collaborators').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return { collaborators, isLoading, invite: invite.mutateAsync, remove: remove.mutateAsync };
}

export function useKitComments(kitId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['kit-comments', kitId] as const;

  const { data: comments = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!kitId) return [];
      const { data, error } = await supabase
        .from('kit_comments')
        .select('*')
        .eq('kit_id', kitId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as KitCommentRow[];
    },
    enabled: !!kitId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!kitId) return;
    const channel = supabase
      .channel(`kit-comments-${kitId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kit_comments', filter: `kit_id=eq.${kitId}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('[useKitCollaboration] realtime channel error', { status, err });
          qc.invalidateQueries({ queryKey: key });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitId, qc]);

  const post = useMutation({
    mutationFn: async ({
      body,
      parentId,
      anchor,
    }: {
      body: string;
      parentId?: string;
      anchor?: string;
    }) => {
      if (!kitId || !user?.id) throw new Error('Kit ou usuário inválido');
      const { error } = await supabase.from('kit_comments').insert({
        kit_id: kitId,
        author_id: user.id,
        parent_id: parentId ?? null,
        item_anchor: anchor ?? null,
        body,
      });
      if (error) throw error;
    },
    onError: (e: Error) => toast.error('Operação falhou', { description: sanitizeError(e) }),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('kit_comments').update({ resolved: true }).eq('id', id);
      if (error) throw error;
    },
  });

  return {
    comments,
    isLoading,
    postComment: post.mutateAsync,
    resolveComment: resolve.mutateAsync,
  };
}
