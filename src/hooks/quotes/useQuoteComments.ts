import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
export interface QuoteComment {
  id: string;
  quote_id: string;
  user_id: string;
  /** Client-side threading marker. The DB does not persist a parent reference. */
  parent_id: string | null;
  /** Maps to the DB `comment` column. */
  content: string;
  is_internal?: boolean | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  author_name: string | null;
  author_avatar: string | null;
  replies?: QuoteComment[];
}

export function useQuoteComments(quoteId: string | undefined) {
  const { user } = useAuth();
  const [comments, setComments] = useState<QuoteComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!quoteId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quote_comments')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch author profiles
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds);

        if (profiles) {
          profileMap = Object.fromEntries(
            profiles.map((p) => [p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }]),
          );
        }
      }

      const enriched: QuoteComment[] = (data || []).map((c) => ({
        id: c.id,
        quote_id: c.quote_id,
        user_id: c.user_id,
        parent_id: null,
        content: c.comment,
        is_internal: c.is_internal,
        is_edited: false,
        created_at: c.created_at ?? '',
        updated_at: c.updated_at ?? '',
        author_name: profileMap[c.user_id]?.full_name || 'Usuário',
        author_avatar: profileMap[c.user_id]?.avatar_url || null,
      }));

      // Build thread tree
      const topLevel = enriched.filter((c) => !c.parent_id);
      const childMap = new Map<string, QuoteComment[]>();
      enriched
        .filter((c) => c.parent_id)
        .forEach((c) => {
          if (!c.parent_id) return;
          const arr = childMap.get(c.parent_id) || [];
          arr.push(c);
          childMap.set(c.parent_id, arr);
        });

      topLevel.forEach((c) => {
        c.replies = childMap.get(c.id) || [];
      });

      setComments(topLevel);
    } catch (err) {
      logger.error('Error fetching comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = async (content: string, parentId?: string) => {
    if (!quoteId || !user) return;
    try {
      const { error } = await supabase.from('quote_comments').insert({
        quote_id: quoteId,
        user_id: user.id,
        comment: content,
      });

      if (error) throw error;

      // Create notification for other participants
      await createCommentNotification(quoteId, user.id, content, parentId);

      toast.success('Comentário adicionado');
      await fetchComments();
    } catch (err) {
      logger.error('Error adding comment:', err);
      toast.error('Erro ao adicionar comentário');
    }
  };

  const updateComment = async (commentId: string, content: string) => {
    try {
      const { error } = await supabase
        .from('quote_comments')
        .update({ comment: content, updated_at: new Date().toISOString() })
        .eq('id', commentId);

      if (error) throw error;
      toast.success('Comentário atualizado');
      await fetchComments();
    } catch (err) {
      logger.error('Error updating comment:', err);
      toast.error('Erro ao atualizar comentário');
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase.from('quote_comments').delete().eq('id', commentId);

      if (error) throw error;
      toast.success('Comentário removido');
      await fetchComments();
    } catch (err) {
      logger.error('Error deleting comment:', err);
      toast.error('Erro ao remover comentário');
    }
  };

  return { comments, isLoading, addComment, updateComment, deleteComment, refetch: fetchComments };
}

async function createCommentNotification(
  quoteId: string,
  authorId: string,
  content: string,
  parentId?: string,
) {
  try {
    // Get all participants in this quote's comments (except the author)
    // BUG-COMMENT-NOTIFY-SILENT-FAIL FIX: previously { error } was not destructured.
    // An RLS denial returned { data: null, error } silently — participants stayed null,
    // uniqueUsers was empty, and no notification was sent without any diagnostic trace.
    const { data: participants, error: participantsErr } = await supabase
      .from('quote_comments')
      .select('user_id')
      .eq('quote_id', quoteId);
    if (participantsErr) {
      logger.warn('Failed to fetch comment participants for notification:', participantsErr);
    }

    const uniqueUsers = [...new Set((participants || []).map((p) => p.user_id))].filter(
      (uid) => uid !== authorId,
    );

    if (uniqueUsers.length === 0) return;

    const preview = content.length > 60 ? `${content.slice(0, 60)}…` : content;
    const notifications = uniqueUsers.map((uid) => ({
      user_id: uid,
      title: parentId ? 'Nova resposta em orçamento' : 'Novo comentário em orçamento',
      message: preview,
      type: 'quote_comment',
      category: 'quotes',
      metadata: { quote_id: quoteId },
    }));

    // BUG-COMMENT-NOTIFY-SILENT-FAIL FIX: previously a bare `await supabase...` was used —
    // Supabase JS v2 never throws on DB errors, so any RLS denial or constraint violation
    // was silently swallowed and the notification was never sent.
    const { error: notifyErr } = await supabase
      .from('workspace_notifications')
      .insert(notifications);
    if (notifyErr) logger.warn('Failed to send comment notifications:', notifyErr);
  } catch {
    // Non-blocking
  }
}
