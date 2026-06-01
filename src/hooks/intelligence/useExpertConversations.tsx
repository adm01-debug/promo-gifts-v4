import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ExpertConversation {
  id: string;
  seller_id: string;
  client_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ExpertMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export function useExpertConversations(clientId?: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ExpertConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('expert_conversations')
        .select('*')
        .eq('seller_id', user.id)
        .order('updated_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = async (title: string = 'Nova conversa'): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('expert_conversations')
        .insert({
          seller_id: user.id,
          client_id: clientId || null,
          title,
        })
        .select()
        .single();

      if (error) throw error;

      setConversations((prev) => [data, ...prev]);
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Erro ao criar conversa');
      return null;
    }
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('expert_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, title, updated_at: new Date().toISOString() } : c,
        ),
      );
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('expert_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      toast.success('Conversa excluída');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erro ao excluir conversa');
    }
  };

  const fetchMessages = async (conversationId: string): Promise<ExpertMessage[]> => {
    try {
      const { data, error } = await supabase
        .from('expert_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ExpertMessage[];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const saveMessage = async (
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ) => {
    try {
      const { error } = await supabase.from('expert_messages').insert({
        conversation_id: conversationId,
        role,
        content,
      });

      if (error) throw error;

      // Update conversation updated_at
      await supabase
        .from('expert_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  return {
    conversations,
    isLoading,
    createConversation,
    updateConversationTitle,
    deleteConversation,
    fetchMessages,
    saveMessage,
    refreshConversations: fetchConversations,
  };
}
